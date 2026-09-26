import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, ilike, or, sql, type SQL } from 'drizzle-orm';

import { campaigns, donations, donors, type DatabaseClient } from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundException } from '../../common/exceptions.js';
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import type { AdminDonorListQuery, UpdateDonorInput } from './dto/donors.dto.js';

interface ActorContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

const SORTABLE = {
  createdAt: donors.createdAt,
  totalDonated: donors.totalDonated,
  donationCount: donors.donationCount,
  lastDonatedAt: donors.lastDonatedAt,
} as const;

/**
 * Donor records, for staff.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THREE LEVELS OF DETAIL, SPLIT ON PERMISSION, ENFORCED IN THE QUERY.
 *
 *   donor.read            who they are, and what they have given in total
 *   donor.read_sensitive  PAN, address and internal notes
 *   donor.update          correcting a record, with a mandatory reason
 *
 * `includeSensitive` decides what the SELECT asks for, not what a serialiser
 * drops afterwards. A PAN fetched and then filtered out has still been read
 * into a process, put in a heap dump and possibly logged by an interceptor that
 * did not know what it was holding. A column the query never names cannot leak.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NOTHING HERE WRITES MONEY. There is no path in this service to
 * `total_donated`, `donation_count` or any donation — those are written only by
 * the payment-capture transaction (decision A6). Staff correcting a misspelled
 * name must not be able to correct a total.
 */
@Injectable()
export class AdminDonorsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminDonorListQuery, options: { includeSensitive: boolean }) {
    const filters: SQL[] = [];

    if (query.hasDonated === 'true') filters.push(gt(donors.donationCount, 0));
    if (query.hasDonated === 'false') filters.push(eq(donors.donationCount, 0));

    /**
     * Search covers name, email, phone and donor code.
     *
     * Unlike the donations list, there is no reduced search here for a caller
     * without `donor.read_sensitive` — because `donor.read` already grants the
     * name, email and phone. What that permission does NOT grant is the PAN and
     * the address, and neither is searchable at all: a search that matched on
     * PAN would let somebody confirm a number they already suspected by reading
     * the result count, which is a disclosure however the row is then filtered.
     */
    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(donors.firstName, term),
        ilike(donors.lastName, term),
        ilike(donors.email, term),
        ilike(donors.phone, term),
        ilike(donors.donorCode, term),
      );
      if (search) filters.push(search);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const sort = resolveSort(query.sort, SORTABLE, 'createdAt');

    const [rows, totals] = await Promise.all([
      this.database.db
        .select({
          id: donors.id,
          donorCode: donors.donorCode,
          firstName: donors.firstName,
          lastName: donors.lastName,
          email: donors.email,
          phone: donors.phone,
          donorType: donors.donorType,
          totalDonated: donors.totalDonated,
          donationCount: donors.donationCount,
          firstDonatedAt: donors.firstDonatedAt,
          lastDonatedAt: donors.lastDonatedAt,
          isAnonymous: donors.isAnonymous,
          createdAt: donors.createdAt,
          // A flag, never the number. Whether a Form 10BD filing can include
          // this donor is an operational question; the PAN itself is not.
          hasTaxId: sql<boolean>`${donors.taxIdNumber} IS NOT NULL`,
        })
        .from(donors)
        .where(where)
        /*
          A DETERMINISTIC TIEBREAKER.

          Rows seeded or written in one statement share a `created_at` to the
          microsecond, and Postgres gives no defined order among ties — so two
          identical queries can return them in different orders. On a paginated
          list that is not cosmetic: a row can appear on page one AND page two,
          or on neither. It surfaced as a cross-suite test failure that passed
          in isolation, which is what an unstable sort looks like from outside.
        */
        .orderBy(sort.direction === 'desc' ? desc(sort.column) : sort.column, donors.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(donors)
        .where(where),
    ]);

    // `includeSensitive` changes nothing on the LIST: no sensitive column is
    // selected here at any permission level. It is named so the caller's intent
    // is explicit and so the detail route below reads consistently.
    void options;

    return paginate(rows, query.page, query.limit, totals[0]?.value ?? 0);
  }

  async getById(id: string, options: { includeSensitive: boolean }) {
    const [row] = await this.database.db
      .select({
        id: donors.id,
        donorCode: donors.donorCode,
        firstName: donors.firstName,
        lastName: donors.lastName,
        email: donors.email,
        phone: donors.phone,
        donorType: donors.donorType,
        totalDonated: donors.totalDonated,
        donationCount: donors.donationCount,
        firstDonatedAt: donors.firstDonatedAt,
        lastDonatedAt: donors.lastDonatedAt,
        isAnonymous: donors.isAnonymous,
        communicationConsent: donors.communicationConsent,
        emailOptIn: donors.emailOptIn,
        smsOptIn: donors.smsOptIn,
        whatsappOptIn: donors.whatsappOptIn,
        notifyCampaignUpdates: donors.notifyCampaignUpdates,
        notifyImpactUpdates: donors.notifyImpactUpdates,
        notifyNewsletter: donors.notifyNewsletter,
        source: donors.source,
        createdAt: donors.createdAt,

        // Selected ONLY when the caller holds `donor.read_sensitive`. See the
        // class comment: a column the query never names cannot leak.
        ...(options.includeSensitive
          ? {
              taxIdType: donors.taxIdType,
              taxIdNumber: donors.taxIdNumber,
              addressLine1: donors.addressLine1,
              addressLine2: donors.addressLine2,
              city: donors.city,
              state: donors.state,
              postalCode: donors.postalCode,
              country: donors.country,
              internalNotes: donors.internalNotes,
            }
          : {}),
        hasTaxId: sql<boolean>`${donors.taxIdNumber} IS NOT NULL`,
      })
      .from(donors)
      .where(eq(donors.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('Donor not found');

    /**
     * The giving history, from the DONATIONS table rather than the cached
     * totals on the donor row.
     *
     * The cached columns are what the public and the dashboard read, and they
     * are maintained inside the capture transaction — but this screen is where
     * somebody comes when they suspect the cache is wrong. Reading the source
     * here is what makes a discrepancy visible instead of confirming itself.
     */
    const history = await this.database.db
      .select({
        id: donations.id,
        reference: donations.reference,
        amount: donations.amount,
        status: donations.status,
        donationDate: donations.donationDate,
        campaignTitle: campaigns.title,
      })
      .from(donations)
      .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
      .where(eq(donations.donorId, id))
      .orderBy(desc(donations.donationDate))
      .limit(50);

    const [confirmed] = await this.database.db
      .select({
        total: sql<number>`coalesce(sum(${donations.amount}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(donations)
      .where(and(eq(donations.donorId, id), eq(donations.status, 'successful')));

    return {
      ...row,
      donations: history,
      // Named `recomputed` rather than merged into the row, so a mismatch with
      // the cached totals is visible instead of hidden.
      recomputed: {
        totalDonated: Number(confirmed?.total ?? 0),
        donationCount: confirmed?.count ?? 0,
      },
    };
  }

  /**
   * Correct a donor record.
   *
   * The reason is mandatory and goes into the audit row. The tax id is recorded
   * as CHANGED rather than as a value — an audit log is a second copy of the
   * database with a longer retention period, and "the PAN was corrected on this
   * date by this person for this reason" answers every question anyone will
   * actually ask of it without making another copy of a national identifier.
   */
  async update(id: string, input: UpdateDonorInput, actorId: string, context: ActorContext) {
    const before = await this.getById(id, { includeSensitive: true });

    const { reason, ...fields } = input;
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value as string;
    }

    if (Object.keys(patch).length === 0) return before;

    await this.database.db
      .update(donors)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(donors.id, id));

    await this.audit.record({
      action: 'donor.updated',
      entityType: 'donor',
      entityId: id,
      userId: actorId,
      reason,
      oldValues: this.auditable(before),
      newValues: this.auditable({ ...before, ...patch }),
      severity: 'warning',
      ...context,
    });

    return this.getById(id, { includeSensitive: true });
  }

  /** The diffable subset, with the tax id reduced to a flag. */
  private auditable(row: Record<string, unknown>) {
    return {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      taxIdType: row.taxIdType,
      taxIdOnFile: Boolean(row.taxIdNumber),
      internalNotes: row.internalNotes,
    };
  }
}
