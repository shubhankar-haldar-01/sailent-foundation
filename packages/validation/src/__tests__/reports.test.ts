import { describe, expect, it } from 'vitest';

import {
  EXPORT_DATASETS,
  EXPORT_DATASET_KEYS,
  MAX_REPORT_RANGE_DAYS,
  datasetPermission,
  exportRequestSchema,
  financialYearOf,
  financialYearRange,
  reportRangeSchema,
  taxReadinessQuerySchema,
} from '../index.js';

/**
 * Report ranges and export datasets.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO THINGS ARE WORTH TESTING HERE, AND NEITHER IS THE HAPPY PATH.
 *
 * 1. THE RANGE IS BOUNDED. §4.22 asks for an "arbitrary range", which is also
 *    how one request asks for every donation ever taken.
 *
 * 2. EVERY DATASET NAMES THE PERMISSION IT NEEDS. The reports module reads
 *    across every other one, so a dataset that forgot to declare its
 *    permission would be a way to read personal data without holding the
 *    permission for it — and it would look fine in a matrix.
 * ══════════════════════════════════════════════════════════════════════════
 */
describe('the report range', () => {
  it('accepts an ordinary month', () => {
    expect(reportRangeSchema.parse({ from: '2026-04-01', to: '2026-04-30' }).from).toBe(
      '2026-04-01',
    );
  });

  it('accepts a single day', () => {
    expect(reportRangeSchema.safeParse({ from: '2026-04-01', to: '2026-04-01' }).success).toBe(
      true,
    );
  });

  it('REFUSES a range that runs backwards', () => {
    expect(reportRangeSchema.safeParse({ from: '2026-12-31', to: '2026-01-01' }).success).toBe(
      false,
    );
  });

  it('REFUSES a range longer than the cap', () => {
    // "Arbitrary" is the requirement; unbounded is how it becomes an outage.
    expect(reportRangeSchema.safeParse({ from: '2000-01-01', to: '2030-01-01' }).success).toBe(
      false,
    );
  });

  it('accepts a range exactly at the cap', () => {
    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date(from.getTime() + MAX_REPORT_RANGE_DAYS * 86_400_000);
    expect(
      reportRangeSchema.safeParse({
        from: '2024-01-01',
        to: to.toISOString().slice(0, 10),
      }).success,
    ).toBe(true);
  });

  it('refuses a date written the way a person types it', () => {
    // `31-03-2026` is unambiguous to a human and meaningless to `Date.parse`.
    expect(reportRangeSchema.safeParse({ from: '31-03-2026', to: '2026-04-01' }).success).toBe(
      false,
    );
  });

  it('refuses a date that looks right and is not real', () => {
    expect(reportRangeSchema.safeParse({ from: '2026-02-31', to: '2026-03-01' }).success).toBe(
      false,
    );
  });

  it('requires both ends', () => {
    expect(reportRangeSchema.safeParse({ from: '2026-04-01' }).success).toBe(false);
    expect(reportRangeSchema.safeParse({}).success).toBe(false);
  });
});

describe('export datasets', () => {
  it('names a permission for every dataset carrying personal data', () => {
    expect(datasetPermission('donations')).toBe('donation.export');
    expect(datasetPermission('donors')).toBe('donor.export');
    expect(datasetPermission('volunteers')).toBe('volunteer.export');
  });

  it('requires nothing extra for figures that are already public', () => {
    // A campaign's totals are on its own page; an impact record's figure is
    // the thing the platform publishes.
    expect(datasetPermission('campaigns')).toBeNull();
    expect(datasetPermission('impact')).toBeNull();
  });

  it('describes every dataset, so nobody exports one to find out what it is', () => {
    for (const key of EXPORT_DATASET_KEYS) {
      expect(EXPORT_DATASETS[key].label.length).toBeGreaterThan(0);
      expect(EXPORT_DATASETS[key].description.length).toBeGreaterThan(10);
    }
  });

  it('REFUSES a dataset this platform does not export', () => {
    expect(
      exportRequestSchema.safeParse({ dataset: 'users', from: '2026-04-01', to: '2026-04-30' })
        .success,
    ).toBe(false);
  });

  it('refuses a table name somebody made up', () => {
    // A free-text dataset would be a way to name any table at all.
    expect(
      exportRequestSchema.safeParse({
        dataset: 'audit_logs',
        from: '2026-04-01',
        to: '2026-04-30',
      }).success,
    ).toBe(false);
  });

  it('applies the same range rules as a report', () => {
    expect(
      exportRequestSchema.safeParse({
        dataset: 'donations',
        from: '2000-01-01',
        to: '2030-01-01',
      }).success,
    ).toBe(false);
  });
});

describe('the Indian financial year', () => {
  it('runs 1 April to 31 March', () => {
    expect(financialYearRange(2025)).toEqual({
      from: '2025-04-01',
      to: '2026-03-31',
      label: '2025-2026',
    });
  });

  it('puts April in the year that starts then', () => {
    expect(financialYearOf(new Date('2026-04-01T00:00:00Z'))).toBe(2026);
  });

  it('puts March in the year BEFORE it', () => {
    // 31 March 2026 belongs to 2025-2026, which is the whole point.
    expect(financialYearOf(new Date('2026-03-31T00:00:00Z'))).toBe(2025);
  });

  it('puts January in the year before it', () => {
    expect(financialYearOf(new Date('2026-01-15T00:00:00Z'))).toBe(2025);
  });

  it('accepts a plausible year and refuses an implausible one', () => {
    expect(taxReadinessQuerySchema.safeParse({ financialYear: '2025' }).success).toBe(true);
    expect(taxReadinessQuerySchema.safeParse({ financialYear: 1500 }).success).toBe(false);
    expect(taxReadinessQuerySchema.safeParse({ financialYear: 3000 }).success).toBe(false);
  });

  it('is optional — the current year is the sensible default', () => {
    expect(taxReadinessQuerySchema.parse({}).financialYear).toBeUndefined();
  });
});
