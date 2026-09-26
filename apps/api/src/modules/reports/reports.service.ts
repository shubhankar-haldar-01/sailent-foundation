import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, isNull, lte, sql, sum, type SQL } from 'drizzle-orm';

import {
  campaigns,
  donations,
  donors,
  impactUpdates,
  volunteers,
  type DatabaseClient,
} from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';
import {
  EXPORT_DATASETS,
  MAX_EXPORT_ROWS,
  datasetPermission,
  financialYearOf,
  financialYearRange,
  type ExportDataset,
  type ReportRange,
} from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { ForbiddenException, ValidationException } from '../../common/exceptions.js';
import { csvFilename, toCsv, type CsvValue } from '../../common/csv.js';

/**
 * Reports and exports.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS MODULE READS ACROSS EVERY OTHER ONE, WHICH MAKES IT A PERMISSION HOLE
 * UNLESS IT IS BUILT NOT TO BE.
 *
 * A single `reports.export` permission that could produce a donor CSV would be
 * a way to read personal data without `donor.export` — and it would look
 * entirely reasonable in a permission matrix. So every dataset names the
 * permission it ADDITIONALLY requires, and `assertMayExport` checks both.
 *
 * NOTHING HERE WRITES, with one exception: every export records an audit row
 * carrying the dataset, the range and the row count. §4.22 — "every export is
 * audited" — and a count is what makes an audit row answer "how much left the
 * building", which is the question afterwards.
 *
 * MONEY IS PAISE (A2). Every total below is an integer count of paise and is
 * returned as one; formatting belongs to whatever displays it.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class ReportsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.database.db;
  }

  /**
   * A date range, as SQL.
   *
   * `to` becomes the END of that day. Finance types `2026-04-01` to
   * `2026-04-30` meaning the whole of April, and a range that silently
   * excluded everything after midnight on the 30th would under-report the
   * month by a day — a discrepancy nobody finds until it is reconciled against
   * a bank statement.
   */
  private window(range: ReportRange): { start: Date; end: Date } {
    return {
      start: new Date(`${range.from}T00:00:00.000Z`),
      end: new Date(`${range.to}T23:59:59.999Z`),
    };
  }

  /** Donations are dated by when the DONOR gave, not when a row was written. */
  private inRange(range: ReportRange): SQL {
    const { start, end } = this.window(range);
    return and(gte(donations.donationDate, start), lte(donations.donationDate, end))!;
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  /**
   * Donations over a range, by payment state.
   *
   * THE STATE BREAKDOWN IS THE POINT. §4.22's acceptance criterion says "with
   * payment state", and a report that showed only successful donations would
   * be a report that cannot answer "why is the bank total lower than the
   * site's" — which is the question Finance actually has.
   */
  async donations(range: ReportRange) {
    const where = this.inRange(range);

    const [byStatus, totals, byCampaign, byDay] = await Promise.all([
      this.db
        .select({
          status: donations.status,
          count: count(),
          amount: sum(donations.amount).mapWith(Number),
        })
        .from(donations)
        .where(where)
        .groupBy(donations.status),

      this.db
        .select({
          count: count(),
          // Only captured money is money. A pending donation is an intention.
          amount: sql<number>`COALESCE(SUM(CASE WHEN ${donations.status} = 'successful' THEN ${donations.amount} ELSE 0 END), 0)::bigint`,
          donors: sql<number>`COUNT(DISTINCT ${donations.donorId})::int`,
        })
        .from(donations)
        .where(where),

      this.db
        .select({
          campaignId: donations.campaignId,
          title: campaigns.title,
          count: count(),
          amount: sql<number>`COALESCE(SUM(CASE WHEN ${donations.status} = 'successful' THEN ${donations.amount} ELSE 0 END), 0)::bigint`,
        })
        .from(donations)
        .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
        .where(where)
        .groupBy(donations.campaignId, campaigns.title)
        .orderBy(desc(sql`4`))
        .limit(20),

      this.db
        .select({
          day: sql<string>`to_char(${donations.donationDate} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          count: count(),
          amount: sql<number>`COALESCE(SUM(CASE WHEN ${donations.status} = 'successful' THEN ${donations.amount} ELSE 0 END), 0)::bigint`,
        })
        .from(donations)
        .where(where)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
    ]);

    return {
      range,
      totals: {
        donations: totals[0]?.count ?? 0,
        capturedPaise: Number(totals[0]?.amount ?? 0),
        distinctDonors: totals[0]?.donors ?? 0,
      },
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row.count,
        amountPaise: Number(row.amount ?? 0),
      })),
      byCampaign: byCampaign.map((row) => ({
        campaignId: row.campaignId,
        title: row.title ?? 'Unattributed',
        count: row.count,
        capturedPaise: Number(row.amount ?? 0),
      })),
      byDay: byDay.map((row) => ({
        day: row.day,
        count: row.count,
        capturedPaise: Number(row.amount ?? 0),
      })),
    };
  }

  /** Campaigns, with what each raised INSIDE the range rather than in total. */
  async campaigns(range: ReportRange) {
    const { start, end } = this.window(range);

    const rows = await this.db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        status: campaigns.status,
        goalPaise: campaigns.fundraisingGoal,
        lifetimePaise: campaigns.amountRaised,
        inRangePaise: sql<number>`COALESCE(SUM(CASE WHEN ${donations.status} = 'successful' THEN ${donations.amount} ELSE 0 END), 0)::bigint`,
        inRangeDonations: sql<number>`COUNT(${donations.id})::int`,
        inRangeDonors: sql<number>`COUNT(DISTINCT ${donations.donorId})::int`,
      })
      .from(campaigns)
      /*
        LEFT JOIN with the range in the JOIN CONDITION, not the WHERE.

        Putting the dates in the WHERE turns this into an inner join and drops
        every campaign that received nothing in the period — which are exactly
        the campaigns somebody running this report needs to see.
      */
      .leftJoin(
        donations,
        and(
          eq(donations.campaignId, campaigns.id),
          gte(donations.donationDate, start),
          lte(donations.donationDate, end),
        ),
      )
      .where(isNull(campaigns.deletedAt))
      .groupBy(
        campaigns.id,
        campaigns.title,
        campaigns.status,
        campaigns.fundraisingGoal,
        campaigns.amountRaised,
      )
      .orderBy(desc(sql`6`));

    return {
      range,
      items: rows.map((row) => ({
        ...row,
        goalPaise: Number(row.goalPaise ?? 0),
        lifetimePaise: Number(row.lifetimePaise ?? 0),
        inRangePaise: Number(row.inRangePaise ?? 0),
      })),
    };
  }

  /** Volunteers: who applied in the range, and what the standing picture is. */
  async volunteers(range: ReportRange) {
    const { start, end } = this.window(range);

    const [appliedByStatus, hours] = await Promise.all([
      this.db
        .select({ status: volunteers.status, count: count() })
        .from(volunteers)
        .where(and(gte(volunteers.createdAt, start), lte(volunteers.createdAt, end)))
        .groupBy(volunteers.status),

      this.db
        .select({
          active: sql<number>`COUNT(*) FILTER (WHERE ${volunteers.status} = 'active')::int`,
          total: count(),
          // Hours are a running total on the record, recomputed from
          // attendance — not summed from anything in this range.
          totalHours: sql<number>`COALESCE(SUM(${volunteers.totalHours}), 0)::int`,
        })
        .from(volunteers),
    ]);

    return {
      range,
      appliedInRange: appliedByStatus.map((row) => ({ status: row.status, count: row.count })),
      standing: {
        activeVolunteers: hours[0]?.active ?? 0,
        allVolunteers: hours[0]?.total ?? 0,
        verifiedHours: hours[0]?.totalHours ?? 0,
      },
    };
  }

  /** Impact records created in the range, and what they claim. */
  async impact(range: ReportRange) {
    const rows = await this.db
      .select({
        metricType: impactUpdates.metricType,
        records: count(),
        total: sql<number>`COALESCE(SUM(${impactUpdates.metricValue}), 0)::bigint`,
        published: sql<number>`COUNT(*) FILTER (WHERE ${impactUpdates.isPublic})::int`,
      })
      .from(impactUpdates)
      .where(
        and(gte(impactUpdates.impactDate, range.from), lte(impactUpdates.impactDate, range.to)),
      )
      .groupBy(impactUpdates.metricType)
      .orderBy(desc(sql`2`));

    return {
      range,
      items: rows.map((row) => ({
        metricType: row.metricType ?? 'unclassified',
        records: row.records,
        total: Number(row.total ?? 0),
        published: row.published,
      })),
    };
  }

  /**
   * Reconciliation: money the platform is not sure about.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * IT ANSWERS ONE QUESTION — WHAT IS STUCK?
   *
   * A donation sits `pending` between the donor pressing pay and a
   * signature-verified webhook moving it forward (decision A3). Most resolve in
   * seconds. The ones that do not are either an abandoned checkout or money
   * that arrived and was never recorded, and those look identical from here —
   * which is precisely why a human has to look.
   *
   * The partial index `donations_pending_idx` exists for this query and was
   * created in migration 0000 for this purpose.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async reconciliation(range: ReportRange) {
    const where = this.inRange(range);
    const stuckBefore = new Date(Date.now() - 60 * 60 * 1000);

    const [summary, oldest] = await Promise.all([
      this.db
        .select({
          pending: sql<number>`COUNT(*) FILTER (WHERE ${donations.status} IN ('pending','processing'))::int`,
          pendingPaise: sql<number>`COALESCE(SUM(${donations.amount}) FILTER (WHERE ${donations.status} IN ('pending','processing')), 0)::bigint`,
          // An hour is long enough that a slow webhook has arrived and short
          // enough that a real problem is still fresh.
          stuck: sql<number>`COUNT(*) FILTER (WHERE ${donations.status} IN ('pending','processing') AND ${donations.donationDate} < ${stuckBefore})::int`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${donations.status} = 'failed')::int`,
          /*
            A captured donation with no receipt should be impossible: the
            number is allocated inside the capture transaction. Counted anyway,
            because "impossible" is what a reconciliation view exists to check.
          */
          capturedWithoutReceipt: sql<number>`COUNT(*) FILTER (WHERE ${donations.status} = 'successful' AND ${donations.receiptId} IS NULL)::int`,
        })
        .from(donations)
        .where(where),

      this.db
        .select({
          id: donations.id,
          reference: donations.reference,
          status: donations.status,
          amountPaise: donations.amount,
          provider: donations.provider,
          donationDate: donations.donationDate,
        })
        .from(donations)
        .where(and(where, sql`${donations.status} IN ('pending','processing')`))
        .orderBy(donations.donationDate)
        .limit(50),
    ]);

    return {
      range,
      summary: {
        pending: summary[0]?.pending ?? 0,
        pendingPaise: Number(summary[0]?.pendingPaise ?? 0),
        stuckOverAnHour: summary[0]?.stuck ?? 0,
        failed: summary[0]?.failed ?? 0,
        capturedWithoutReceipt: summary[0]?.capturedWithoutReceipt ?? 0,
      },
      oldestUnresolved: oldest.map((row) => ({
        ...row,
        amountPaise: Number(row.amountPaise ?? 0),
      })),
    };
  }

  /**
   * Form 10BD readiness for a financial year.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * IT COUNTS WHAT WOULD BE MISSING, AND IT FILES NOTHING.
   *
   * A7: the receipt a donor already has is NOT their 80G certificate. The
   * organisation files Form 10BD by 31 May and the Income Tax Department then
   * issues Form 10BE. A donation without a donor tax ID cannot go on that
   * return, so the money is receipted but the donor gets no relief — and the
   * time to discover that is while the year is open, not in May.
   *
   * `donations.tax_id_captured` is denormalised for exactly this query, and
   * `donors_missing_tax_id_idx` is the partial index behind the donor half.
   *
   * GENERATING the return is NOT this. `form_10bd_exports` is documented and
   * deferred; §4.22 asks for the readiness VIEW, and that is what this is.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async taxReadiness(financialYear?: number) {
    const year = financialYear ?? financialYearOf(new Date());
    const fy = financialYearRange(year);
    const range: ReportRange = { from: fy.from, to: fy.to };
    const where = and(this.inRange(range), eq(donations.status, 'successful'))!;

    const [summary] = await this.db
      .select({
        eligible: count(),
        eligiblePaise: sql<number>`COALESCE(SUM(${donations.amount}), 0)::bigint`,
        ready: sql<number>`COUNT(*) FILTER (WHERE ${donations.taxIdCaptured})::int`,
        readyPaise: sql<number>`COALESCE(SUM(${donations.amount}) FILTER (WHERE ${donations.taxIdCaptured}), 0)::bigint`,
        missing: sql<number>`COUNT(*) FILTER (WHERE NOT ${donations.taxIdCaptured})::int`,
        missingPaise: sql<number>`COALESCE(SUM(${donations.amount}) FILTER (WHERE NOT ${donations.taxIdCaptured}), 0)::bigint`,
        donorsMissing: sql<number>`COUNT(DISTINCT ${donations.donorId}) FILTER (WHERE NOT ${donations.taxIdCaptured})::int`,
      })
      .from(donations)
      .where(where);

    return {
      financialYear: fy.label,
      range,
      /*
        The deadline is a fact about Indian tax law, not a setting. Stating it
        here is what turns a count into something somebody acts on.
      */
      filingDeadline: `${year + 1}-05-31`,
      eligible: summary?.eligible ?? 0,
      eligiblePaise: Number(summary?.eligiblePaise ?? 0),
      ready: summary?.ready ?? 0,
      readyPaise: Number(summary?.readyPaise ?? 0),
      missing: summary?.missing ?? 0,
      missingPaise: Number(summary?.missingPaise ?? 0),
      donorsMissingTaxId: summary?.donorsMissing ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  /**
   * The permission check that stops this module being a way round the others.
   *
   * `reports.export` alone is not enough for a dataset that has its own
   * permission. Without this, an operator who could export "a report" could
   * read every donor record without ever holding `donor.export`.
   */
  private assertMayExport(dataset: ExportDataset, actor: AuthenticatedActor): void {
    const extra = datasetPermission(dataset);
    if (extra && !actor.permissions.includes(extra)) {
      throw new ForbiddenException(
        `Exporting ${EXPORT_DATASETS[dataset].label.toLowerCase()} also needs ${extra}.`,
      );
    }
  }

  async exportCsv(
    input: { dataset: ExportDataset; from: string; to: string },
    actor: AuthenticatedActor,
    context: AuditContext,
  ): Promise<{ filename: string; csv: string; rowCount: number }> {
    this.assertMayExport(input.dataset, actor);

    const range: ReportRange = { from: input.from, to: input.to };
    const { headers, rows } = await this.rowsFor(input.dataset, range);

    if (rows.length > MAX_EXPORT_ROWS) {
      /*
        Refused rather than truncated. A CSV silently missing its last hundred
        thousand rows is worse than no CSV: it looks complete, it reconciles
        against nothing, and whoever reads it has no way to tell.
      */
      throw new ValidationException(
        [
          {
            code: 'too_many_rows',
            field: 'to',
            message: `That range holds ${rows.length.toLocaleString()} rows, over the ${MAX_EXPORT_ROWS.toLocaleString()} limit. Ask for a shorter period.`,
          },
        ],
        'That export is too large.',
      );
    }

    /*
      AUDITED WITH THE ROW COUNT. §4.22 — "every export is audited" — and the
      count is what makes the row answer the question somebody actually has
      afterwards, which is how much data left the building.
    */
    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'report.export',
      entityType: 'report',
      // An export is not about one row. The dataset and range are in `newValues`.
      newValues: {
        dataset: input.dataset,
        from: input.from,
        to: input.to,
        rowCount: rows.length,
      },
      // An export of personal data is not routine.
      severity: datasetPermission(input.dataset) ? 'warning' : 'info',
      ...context,
    });

    return {
      filename: csvFilename(input.dataset, input.from, input.to),
      csv: toCsv(headers, rows),
      rowCount: rows.length,
    };
  }

  /** The rows for one dataset. Column sets are explicit, never `SELECT *`. */
  private async rowsFor(
    dataset: ExportDataset,
    range: ReportRange,
  ): Promise<{ headers: string[]; rows: CsvValue[][] }> {
    const { start, end } = this.window(range);
    const limit = MAX_EXPORT_ROWS + 1; // One over, so "too many" is detectable.

    if (dataset === 'donations') {
      const rows = await this.db
        .select({
          reference: donations.reference,
          date: donations.donationDate,
          status: donations.status,
          amount: donations.amount,
          currency: donations.currency,
          campaign: campaigns.title,
          donorName: sql<string>`COALESCE(${donors.firstName} || ' ' || COALESCE(${donors.lastName}, ''), '')`,
          donorEmail: donors.email,
          anonymous: donations.anonymous,
          taxIdCaptured: donations.taxIdCaptured,
          provider: donations.provider,
          providerTransactionId: donations.providerTransactionId,
          completedAt: donations.completedAt,
        })
        .from(donations)
        .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
        .leftJoin(donors, eq(donors.id, donations.donorId))
        .where(this.inRange(range))
        .orderBy(donations.donationDate)
        .limit(limit);

      return {
        /*
          `anonymous` is a COLUMN, not a reason to withhold the name.

          The schema says it plainly: "Public display only. Finance can always
          identify the donor." A 10BD return needs the real person. What the
          column does is tell whoever opens this file that the name must not be
          published — which a blank cell would not.
        */
        headers: [
          'reference',
          'date',
          'status',
          'amount_paise',
          'currency',
          'campaign',
          'donor_name',
          'donor_email',
          'anonymous_in_public',
          'tax_id_captured',
          'provider',
          'provider_transaction_id',
          'completed_at',
        ],
        rows: rows.map((row) => [
          row.reference,
          row.date,
          row.status,
          Number(row.amount ?? 0),
          row.currency,
          row.campaign,
          row.donorName?.trim() ?? '',
          row.donorEmail,
          row.anonymous,
          row.taxIdCaptured,
          row.provider,
          row.providerTransactionId,
          row.completedAt,
        ]),
      };
    }

    if (dataset === 'donors') {
      const rows = await this.db
        .selectDistinctOn([donors.id], {
          id: donors.id,
          firstName: donors.firstName,
          lastName: donors.lastName,
          email: donors.email,
          phone: donors.phone,
          city: donors.city,
          state: donors.state,
          /*
            THE TAX ID ITSELF IS NOT A COLUMN, only whether one is on file.

            It is SENSITIVE and encrypted at rest (database-architecture §106).
            An export is a file that leaves the building and gets emailed
            around; a PAN in one is a disclosure that cannot be recalled. The
            readiness view answers "who is missing one", which is the question
            this export is for.
          */
          hasTaxId: sql<boolean>`${donors.taxIdNumber} IS NOT NULL`,
          createdAt: donors.createdAt,
        })
        .from(donors)
        .innerJoin(donations, eq(donations.donorId, donors.id))
        .where(and(gte(donations.donationDate, start), lte(donations.donationDate, end)))
        .orderBy(donors.id)
        .limit(limit);

      return {
        headers: [
          'donor_id',
          'first_name',
          'last_name',
          'email',
          'phone',
          'city',
          'state',
          'tax_id_on_file',
          'created_at',
        ],
        rows: rows.map((row) => [
          row.id,
          row.firstName,
          row.lastName,
          row.email,
          row.phone,
          row.city,
          row.state,
          row.hasTaxId,
          row.createdAt,
        ]),
      };
    }

    if (dataset === 'volunteers') {
      const rows = await this.db
        .select({
          volunteerId: volunteers.volunteerId,
          firstName: volunteers.firstName,
          lastName: volunteers.lastName,
          email: volunteers.email,
          status: volunteers.status,
          totalHours: volunteers.totalHours,
          createdAt: volunteers.createdAt,
        })
        .from(volunteers)
        .where(and(gte(volunteers.createdAt, start), lte(volunteers.createdAt, end)))
        .orderBy(volunteers.createdAt)
        .limit(limit);

      return {
        headers: [
          'volunteer_id',
          'first_name',
          'last_name',
          'email',
          'status',
          'verified_hours',
          'applied_at',
        ],
        rows: rows.map((row) => [
          row.volunteerId,
          row.firstName,
          row.lastName,
          row.email,
          row.status,
          row.totalHours,
          row.createdAt,
        ]),
      };
    }

    if (dataset === 'campaigns') {
      const report = await this.campaigns(range);
      return {
        headers: [
          'title',
          'status',
          'goal_paise',
          'raised_in_range_paise',
          'lifetime_raised_paise',
          'donations_in_range',
          'donors_in_range',
        ],
        rows: report.items.map((row) => [
          row.title,
          row.status,
          row.goalPaise,
          row.inRangePaise,
          row.lifetimePaise,
          row.inRangeDonations,
          row.inRangeDonors,
        ]),
      };
    }

    const rows = await this.db
      .select({
        title: impactUpdates.title,
        impactDate: impactUpdates.impactDate,
        metricType: impactUpdates.metricType,
        metricValue: impactUpdates.metricValue,
        verificationMethod: impactUpdates.verificationMethod,
        isPublic: impactUpdates.isPublic,
      })
      .from(impactUpdates)
      .where(
        and(gte(impactUpdates.impactDate, range.from), lte(impactUpdates.impactDate, range.to)),
      )
      .orderBy(impactUpdates.impactDate)
      .limit(limit);

    return {
      headers: [
        'title',
        'impact_date',
        'metric_type',
        'metric_value',
        // A14: a figure without a stated basis is not a figure. It travels
        // with the number rather than being left behind in the database.
        'how_it_was_counted',
        'published',
      ],
      rows: rows.map((row) => [
        row.title,
        row.impactDate,
        row.metricType,
        row.metricValue,
        row.verificationMethod,
        row.isPublic,
      ]),
    };
  }
}
