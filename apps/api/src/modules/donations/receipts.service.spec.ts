import { describe, expect, it } from 'vitest';

import { financialYearOf, formatReceiptNumber } from './receipts.service.js';

/**
 * Receipt numbering.
 *
 * The gapless guarantee is enforced by the database — a counter row taken FOR
 * UPDATE inside the capture transaction, plus a unique index on
 * (financial_year, sequence). That half is exercised by the integration suite,
 * which is the only place it can be.
 *
 * What is testable here is the part that decides WHICH book a receipt belongs
 * in, and it is worth testing because it is off-by-one by nature: an Indian
 * financial year does not start in January, and a receipt issued in March
 * belongs to the year that started the previous April.
 */

describe('financialYearOf', () => {
  it.each([
    ['1 April 2026 — the first day of FY 2026-27', '2026-04-01T00:00:00+05:30', 2026],
    ['30 September 2026 — mid-year', '2026-09-30T12:00:00+05:30', 2026],
    ['31 December 2026 — still FY 2026-27', '2026-12-31T23:59:00+05:30', 2026],
    [
      '1 January 2027 — a NEW calendar year, the SAME financial year',
      '2027-01-01T00:00:00+05:30',
      2026,
    ],
    ['31 March 2027 — the last day of FY 2026-27', '2027-03-31T23:59:00+05:30', 2026],
    ['1 April 2027 — the book rolls over', '2027-04-01T00:00:00+05:30', 2027],
  ])('%s', (_label, iso, expected) => {
    expect(financialYearOf(new Date(iso))).toBe(expected);
  });

  /**
   * The bug this guards: using the calendar year would put January, February
   * and March of 2027 in a 2027 book while they belong to FY 2026-27 — the
   * same financial year the Form 10BD filing covers. The receipt book and the
   * filing would then disagree about which year a donation fell in.
   */
  /*
    THE BOUNDARY IN INDIA TIME, whatever the server's clock zone (Phase 11).
    Written as UTC instants: midnight on 1 April in India is 18:30 UTC on 31
    March. A server in UTC used to put 00:00–05:29 on 1 April in the old year.
    Run under `TZ=UTC` as well as locally — the result must not change.
  */
  it.each([
    ['31 Mar 23:59:59 IST', '2027-03-31T18:29:59.999Z', 2026],
    ['1 Apr 00:00:00 IST', '2027-03-31T18:30:00.000Z', 2027],
    ['1 Apr 01:30 IST — still 31 March in UTC', '2027-03-31T20:00:00.000Z', 2027],
    ['1 Apr 05:29 IST — the last minute a UTC server got wrong', '2027-03-31T23:59:00.000Z', 2027],
    ['1 Apr 05:30 IST — 1 April in UTC too', '2027-04-01T00:00:00.000Z', 2027],
  ])('puts %s in the right financial year', (_label, iso, expected) => {
    expect(financialYearOf(new Date(iso))).toBe(expected);
  });

  it('keeps January to March with the financial year that began the previous April', () => {
    const march = financialYearOf(new Date('2027-03-15T10:00:00+05:30'));
    const april = financialYearOf(new Date('2026-04-15T10:00:00+05:30'));
    expect(march).toBe(april);
  });
});

describe('formatReceiptNumber', () => {
  it('pads to six digits, so the book sorts as text', () => {
    expect(formatReceiptNumber(2026, 1)).toBe('SFL-2026-000001');
    expect(formatReceiptNumber(2026, 42)).toBe('SFL-2026-000042');
    expect(formatReceiptNumber(2026, 999_999)).toBe('SFL-2026-999999');
  });

  it('does not truncate past the padding width', () => {
    // A millionth receipt in one year is implausible, but silently dropping a
    // digit would issue a number that collides with an earlier one.
    expect(formatReceiptNumber(2026, 1_000_000)).toBe('SFL-2026-1000000');
  });

  it('starts each financial year at one', () => {
    expect(formatReceiptNumber(2027, 1)).toBe('SFL-2027-000001');
  });
});
