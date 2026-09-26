import { describe, expect, it } from 'vitest';

import {
  PRODUCT_TRANSITIONS,
  canTransitionProduct,
  donationType,
  isProductOfferable,
  summariseDonation,
  validateDonationComposition,
  type DonationProductLine,
  type ProductStatus,
} from '../index.js';

const line = (overrides: Partial<DonationProductLine> = {}): DonationProductLine => ({
  campaignProductId: 'cp-1',
  productId: 'p-1',
  productName: 'School Kit',
  unitPrice: 90_000,
  quantity: 1,
  ...overrides,
});

describe('donationType', () => {
  it.each([
    [0, 0, 'custom'],
    [0, 50_000, 'custom'],
    [2, 0, 'product'],
    [2, 50_000, 'hybrid'],
  ])('with %i product lines and %i paise custom, reports %s', (lines, custom, expected) => {
    expect(donationType(lines, custom)).toBe(expected);
  });

  it('is custom when a donation is entirely empty', () => {
    // Not a fourth type. An empty donation is refused elsewhere; classifying it
    // as "custom of zero" keeps the type total rather than nullable.
    expect(donationType(0, 0)).toBe('custom');
  });
});

describe('summariseDonation', () => {
  it('multiplies each line and sums them', () => {
    const summary = summariseDonation([
      line({ quantity: 2 }),
      line({ campaignProductId: 'cp-2', unitPrice: 60_000, quantity: 3 }),
    ]);

    expect(summary.lines[0]?.totalAmount).toBe(180_000);
    expect(summary.lines[1]?.totalAmount).toBe(180_000);
    expect(summary.productTotal).toBe(360_000);
    expect(summary.total).toBe(360_000);
    expect(summary.itemCount).toBe(5);
    expect(summary.type).toBe('product');
  });

  it('adds a custom amount on top and reports the donation as hybrid', () => {
    const summary = summariseDonation([line({ quantity: 2 })], 50_000);

    expect(summary.productTotal).toBe(180_000);
    expect(summary.customAmount).toBe(50_000);
    expect(summary.total).toBe(230_000);
    expect(summary.type).toBe('hybrid');
  });

  /**
   * THE ONE THAT MATTERS.
   *
   * A negative quantity SUBTRACTS from a donation total. Left unclamped it is
   * how a ₹9,000 clinic day becomes a ₹1 donation — a line of -1 against a
   * line of +1 and a bit of arithmetic. The function must never return a total
   * that is wrong, whatever it is handed.
   */
  it('never lets a negative quantity reduce the total', () => {
    const summary = summariseDonation([
      line({ quantity: 1, unitPrice: 900_000 }),
      line({ campaignProductId: 'cp-2', quantity: -10, unitPrice: 900_000 }),
    ]);

    expect(summary.total).toBe(900_000);
    expect(summary.lines[1]?.quantity).toBe(0);
    expect(summary.lines[1]?.totalAmount).toBe(0);
  });

  it('never lets a negative custom amount reduce the total', () => {
    expect(summariseDonation([line()], -500_000).total).toBe(90_000);
  });

  it('truncates a fractional quantity rather than charging a fraction', () => {
    const summary = summariseDonation([line({ quantity: 2.9 })]);
    expect(summary.lines[0]?.quantity).toBe(2);
    expect(summary.total).toBe(180_000);
  });

  it('ignores zero-quantity lines in the count and the type', () => {
    const summary = summariseDonation([line({ quantity: 0 })], 0);
    expect(summary.total).toBe(0);
    expect(summary.itemCount).toBe(0);
    expect(summary.type).toBe('custom');
  });

  it('stays an exact integer across a large basket', () => {
    // Paise are integers all the way through (decision A2); nothing here may
    // introduce a float that drifts by a paisa at the fourth decimal place.
    const summary = summariseDonation(
      Array.from({ length: 97 }, (_, index) =>
        line({ campaignProductId: `cp-${index}`, unitPrice: 133_337, quantity: 7 }),
      ),
    );

    expect(summary.total).toBe(97 * 7 * 133_337);
    expect(Number.isInteger(summary.total)).toBe(true);
  });
});

describe('validateDonationComposition', () => {
  const rules = { minimumAmount: 1_000, allowCustomAmount: true };

  it('accepts an ordinary product donation', () => {
    expect(validateDonationComposition([line({ quantity: 2 })], 0, rules)).toEqual([]);
  });

  it('accepts a hybrid donation', () => {
    expect(validateDonationComposition([line()], 50_000, rules)).toEqual([]);
  });

  it('refuses an empty donation', () => {
    const issues = validateDonationComposition([], 0, rules);
    expect(issues.map((issue) => issue.code)).toContain('empty');
  });

  it('refuses a total below the campaign minimum', () => {
    const issues = validateDonationComposition([], 500, {
      ...rules,
      minimumAmount: 10_000,
    });
    expect(issues.map((issue) => issue.code)).toContain('below_minimum');
  });

  it('refuses a zero quantity with the line named', () => {
    const issues = validateDonationComposition([line({ quantity: 0 })], 0, rules);
    expect(issues).toContainEqual(
      expect.objectContaining({ field: 'items.0.quantity', code: 'not_positive' }),
    );
  });

  it('refuses a negative quantity', () => {
    const issues = validateDonationComposition([line({ quantity: -3 })], 0, rules);
    expect(issues.map((issue) => issue.code)).toContain('not_positive');
  });

  it('refuses a fractional quantity', () => {
    const issues = validateDonationComposition([line({ quantity: 1.5 })], 0, rules);
    expect(issues.map((issue) => issue.code)).toContain('not_integer');
  });

  it('enforces the per-line ceiling', () => {
    const issues = validateDonationComposition([line({ quantity: 20 })], 0, {
      ...rules,
      maxPerDonation: { 'cp-1': 10 },
    });
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'above_max', message: expect.stringContaining('10') }),
    );
  });

  /**
   * Two lines for the same product would each pass the per-line ceiling while
   * together exceeding it — the obvious way round a limit, and the reason the
   * duplicate check exists separately from the ceiling check.
   */
  it('refuses the same product appearing twice in one basket', () => {
    const issues = validateDonationComposition([line({ quantity: 6 }), line({ quantity: 6 })], 0, {
      ...rules,
      maxPerDonation: { 'cp-1': 10 },
    });
    expect(issues).toContainEqual(
      expect.objectContaining({ field: 'items.1.campaignProductId', code: 'duplicate' }),
    );
  });

  it('refuses a custom amount on a campaign that does not accept one', () => {
    const issues = validateDonationComposition([line()], 50_000, {
      ...rules,
      allowCustomAmount: false,
    });
    expect(issues.map((issue) => issue.code)).toContain('not_allowed');
  });

  it('refuses a fractional custom amount', () => {
    const issues = validateDonationComposition([], 500.5, rules);
    expect(issues.map((issue) => issue.code)).toContain('invalid');
  });
});

describe('product lifecycle', () => {
  it.each([
    ['active', 'inactive', true],
    ['active', 'archived', true],
    ['inactive', 'active', true],
    ['inactive', 'archived', true],
    ['archived', 'inactive', true],
    // An archived product does not go straight back on sale. It returns as
    // inactive and is turned on deliberately.
    ['archived', 'active', false],
    ['active', 'active', false],
  ])('%s → %s is %s', (from, to, allowed) => {
    expect(canTransitionProduct(from as ProductStatus, to as ProductStatus)).toBe(allowed);
  });

  it('never allows a transition out of the table', () => {
    for (const [from, targets] of Object.entries(PRODUCT_TRANSITIONS)) {
      for (const to of ['active', 'inactive', 'archived'] as ProductStatus[]) {
        expect(canTransitionProduct(from as ProductStatus, to)).toBe(targets.includes(to));
      }
    }
  });
});

describe('isProductOfferable', () => {
  /**
   * BOTH flags, and this is the table that says why.
   *
   * The catalogue answers "do we do this at all"; the campaign answers "are we
   * asking for it here". A product withdrawn centrally must disappear from
   * every campaign without anybody visiting each one.
   */
  it.each([
    ['active', true, true],
    ['active', false, false],
    ['inactive', true, false],
    ['inactive', false, false],
    ['archived', true, false],
    ['archived', false, false],
  ])('catalogue %s + campaign active=%s → %s', (status, campaignActive, expected) => {
    expect(isProductOfferable(status as ProductStatus, campaignActive)).toBe(expected);
  });
});
