import { z } from 'zod';

/**
 * Reports and exports.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A DATE RANGE IS THE WHOLE INTERFACE, SO IT IS THE THING WORTH GUARDING.
 *
 * `product-requirements.md` §4.22 — "Finance can export donations for an
 * arbitrary range with payment state". Arbitrary is the requirement, but
 * arbitrary is also how a single request asks for every donation ever taken
 * and pulls it into memory to make a CSV.
 *
 * So the range is required, ordered, and bounded — not because Finance would
 * abuse it, but because a mistyped year is indistinguishable from one that
 * would, and the failure mode is an API that stops answering anybody.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Two years. Long enough for any financial year, short enough to bound the work. */
export const MAX_REPORT_RANGE_DAYS = 731;

/** Beyond this a CSV is a database dump. Narrow the range instead. */
export const MAX_EXPORT_ROWS = 50_000;

/**
 * A calendar date, checked by ROUND TRIP rather than by `Date.parse`.
 *
 * `Date.parse('2026-02-31T00:00:00Z')` does not fail — JavaScript rolls the
 * overflow forward and hands back 3 March. A range typed as 31 February would
 * therefore have been accepted and quietly shifted, which is worse than a
 * refusal: the report would be right about a period nobody asked for.
 *
 * So the parsed date is formatted back and compared. Only a real date survives.
 */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Write the date as 2026-03-31.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'That is not a real date.');

/**
 * `from` and `to`, inclusive, as plain dates.
 *
 * DATES, NOT TIMESTAMPS. Finance thinks in days, and a range typed as
 * `2026-04-01` to `2026-04-30` that silently excluded everything after
 * midnight on the 30th would under-report a month by a day and nobody would
 * notice until the totals were reconciled against a bank statement. The API
 * turns `to` into the end of that day.
 */
export const reportRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((value) => value.from <= value.to, {
    message: 'The start of the range must not be after its end.',
    path: ['from'],
  })
  .refine(
    (value) => {
      const days =
        (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / 86_400_000;
      return days <= MAX_REPORT_RANGE_DAYS;
    },
    {
      message: `A range is limited to ${MAX_REPORT_RANGE_DAYS} days. Ask for a shorter period.`,
      path: ['to'],
    },
  );

export type ReportRange = z.infer<typeof reportRangeSchema>;

/**
 * What can be exported.
 *
 * A CLOSED LIST, and each entry names the permission it additionally requires.
 * The reports module reads across every other module, so an export route that
 * accepted a free-text table name — or that required only `reports.export` —
 * would be a way to read donor records without `donor.export`. The API checks
 * both.
 */
export const EXPORT_DATASETS = {
  donations: {
    label: 'Donations',
    /** In addition to `reports.export`. */
    permission: 'donation.export',
    description: 'One row per donation, with its payment state.',
  },
  donors: {
    label: 'Donors',
    permission: 'donor.export',
    description: 'One row per donor who gave in the range. Contains personal data.',
  },
  volunteers: {
    label: 'Volunteers',
    permission: 'volunteer.export',
    description: 'One row per volunteer who applied in the range.',
  },
  campaigns: {
    label: 'Campaigns',
    /** No second permission: a campaign's totals are already public. */
    permission: null,
    description: 'One row per campaign, with what it raised in the range.',
  },
  impact: {
    label: 'Impact records',
    permission: null,
    description: 'One row per impact record in the range.',
  },
} as const;

export type ExportDataset = keyof typeof EXPORT_DATASETS;

export const EXPORT_DATASET_KEYS = Object.keys(EXPORT_DATASETS) as ExportDataset[];

/** The extra permission a dataset needs, beyond `reports.export`. */
export function datasetPermission(dataset: ExportDataset): string | null {
  return EXPORT_DATASETS[dataset].permission;
}

export const exportRequestSchema = z
  .object({
    dataset: z.enum(EXPORT_DATASET_KEYS as [ExportDataset, ...ExportDataset[]], {
      errorMap: () => ({ message: 'That is not something this platform exports.' }),
    }),
    from: isoDate,
    to: isoDate,
  })
  .refine((value) => value.from <= value.to, {
    message: 'The start of the range must not be after its end.',
    path: ['from'],
  })
  .refine(
    (value) => {
      const days =
        (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / 86_400_000;
      return days <= MAX_REPORT_RANGE_DAYS;
    },
    {
      message: `A range is limited to ${MAX_REPORT_RANGE_DAYS} days. Ask for a shorter period.`,
      path: ['to'],
    },
  );

export type ExportRequest = z.infer<typeof exportRequestSchema>;

/**
 * An Indian financial year, for the Form 10BD readiness view.
 *
 * 1 April to 31 March. Written as the year it starts: `2025` means
 * 2025-04-01 to 2026-03-31.
 */
export const financialYearStartSchema = z.coerce
  .number()
  .int()
  .min(2000, 'That is before this organisation existed.')
  .max(2100, 'That is not a year anybody is filing for.');

export function financialYearRange(startYear: number): { from: string; to: string; label: string } {
  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
    label: `${startYear}-${startYear + 1}`,
  };
}

/** The financial year a given date falls in. April starts it. */
export function financialYearOf(date: Date): number {
  const year = date.getUTCFullYear();
  // getUTCMonth() is zero-based, so March is 2 and April is 3.
  return date.getUTCMonth() >= 3 ? year : year - 1;
}

export const taxReadinessQuerySchema = z.object({
  financialYear: financialYearStartSchema.optional(),
});
