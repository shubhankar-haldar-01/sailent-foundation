import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';

import {
  campaigns,
  donationItems,
  donations,
  donors,
  impactUpdates,
  payments,
  receipts,
  savedCampaigns,
  type DatabaseClient,
} from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundException } from '../../common/exceptions.js';
import {
  offsetFor,
  paginate,
  type PaginatedResult,
  type PaginationQuery,
} from '../../common/dto/pagination.dto.js';
import type { MyDonationsQuery, UpdateProfileInput, UpdateSettingsInput } from './dto/me.dto.js';

interface ActorContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Everything a signed-in donor can see and change about themselves.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * OWNERSHIP IS A WHERE CLAUSE, NOT A CHECK.
 *
 * Every method here takes `donorId` as its FIRST argument and puts it in the
 * SQL. There is no method that loads a row and then compares its owner, because
 * that shape has a failure mode this one does not: the row has already been
 * read, and the next person to add a log line, an error message or a debug
 * response leaks it. Here a donation belonging to somebody else is not a
 * forbidden row — it is not a row at all.
 *
 * `donorId` ALWAYS comes from `actor.id` on a `donor`-audience token, which the
 * guard resolved from a session row. It is never read from a path, a query
 * string or a body, anywhere in this module.
 *
 * FOR THE SAME REASON, A DONATION THAT IS NOT YOURS IS 404, NOT 403.
 * 403 says "this exists and it is not yours", which turns the endpoint into an
 * oracle for whether a given donation id exists. 404 says nothing.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NOTHING HERE WRITES MONEY. No method in this file updates a donation's
 * amount or status, a payment, a receipt number, `amount_raised`,
 * `provided_quantity`, or any of the donor's derived totals. Those are written
 * in exactly one place — the payment-capture transaction (decision A6) — and a
 * donor-facing service is the last place that should be able to reach them.
 */
@Injectable()
export class MeService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------

  async profile(donorId: string) {
    const [row] = await this.database.db
      .select({
        id: donors.id,
        donorCode: donors.donorCode,
        firstName: donors.firstName,
        lastName: donors.lastName,
        email: donors.email,
        phone: donors.phone,
        donorType: donors.donorType,
        taxIdType: donors.taxIdType,
        taxIdNumber: donors.taxIdNumber,
        addressLine1: donors.addressLine1,
        addressLine2: donors.addressLine2,
        city: donors.city,
        state: donors.state,
        postalCode: donors.postalCode,
        country: donors.country,
        totalDonated: donors.totalDonated,
        donationCount: donors.donationCount,
        firstDonatedAt: donors.firstDonatedAt,
        lastDonatedAt: donors.lastDonatedAt,
        createdAt: donors.createdAt,
      })
      .from(donors)
      .where(eq(donors.id, donorId))
      .limit(1);

    if (!row) throw new NotFoundException('Donor not found');
    return row;
  }

  /**
   * Update the parts of a donor record that belong to the donor.
   *
   * The allow-list is the Zod schema, which is `.strict()` — an unknown key is
   * rejected before this method is reached. What is left is still filtered
   * here to the columns named below, so that widening the schema can never
   * silently widen what is written.
   */
  async updateProfile(donorId: string, input: UpdateProfileInput, context: ActorContext) {
    const before = await this.profile(donorId);

    const patch = {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.taxIdType !== undefined ? { taxIdType: input.taxIdType } : {}),
      ...(input.taxIdNumber !== undefined ? { taxIdNumber: input.taxIdNumber } : {}),
    };

    if (Object.keys(patch).length === 0) return before;

    await this.database.db
      .update(donors)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(donors.id, donorId));

    /**
     * Audited with `actorType: 'donor'`.
     *
     * The tax id is recorded as CHANGED rather than as a value. It is the one
     * field here that is a national identifier, and an audit log is a second
     * copy of the database with a longer retention period — "PAN was edited on
     * this date from this IP" answers every question anyone will actually ask
     * of it, without making another copy of the number.
     */
    await this.audit.record({
      action: 'donor.profile_updated',
      entityType: 'donor',
      entityId: donorId,
      actorType: 'donor',
      userId: donorId,
      oldValues: this.auditable(before),
      newValues: this.auditable({ ...before, ...patch }),
      ...context,
    });

    return this.profile(donorId);
  }

  /** The subset of a donor row worth diffing, with the tax id reduced to a flag. */
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
    };
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async settings(donorId: string) {
    const [row] = await this.database.db
      .select({
        communicationConsent: donors.communicationConsent,
        emailOptIn: donors.emailOptIn,
        smsOptIn: donors.smsOptIn,
        whatsappOptIn: donors.whatsappOptIn,
        notifyCampaignUpdates: donors.notifyCampaignUpdates,
        notifyImpactUpdates: donors.notifyImpactUpdates,
        notifyNewsletter: donors.notifyNewsletter,
        isAnonymous: donors.isAnonymous,
      })
      .from(donors)
      .where(eq(donors.id, donorId))
      .limit(1);

    if (!row) throw new NotFoundException('Donor not found');
    return row;
  }

  async updateSettings(donorId: string, input: UpdateSettingsInput, context: ActorContext) {
    const before = await this.settings(donorId);

    const patch: Record<string, boolean> = {};
    for (const key of [
      'communicationConsent',
      'emailOptIn',
      'smsOptIn',
      'whatsappOptIn',
      'notifyCampaignUpdates',
      'notifyImpactUpdates',
      'notifyNewsletter',
      'isAnonymous',
    ] as const) {
      if (input[key] !== undefined) patch[key] = input[key];
    }

    if (Object.keys(patch).length === 0) return before;

    await this.database.db
      .update(donors)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(donors.id, donorId));

    /**
     * Consent changes are audited because they are the answer to "why did you
     * email me?" — and to its more serious cousin, "prove I agreed".
     */
    await this.audit.record({
      action: 'donor.settings_updated',
      entityType: 'donor',
      entityId: donorId,
      actorType: 'donor',
      userId: donorId,
      oldValues: before,
      newValues: { ...before, ...patch },
      ...context,
    });

    return this.settings(donorId);
  }

  // -------------------------------------------------------------------------
  // Donations
  // -------------------------------------------------------------------------

  async donations(donorId: string, query: MyDonationsQuery): Promise<PaginatedResult<unknown>> {
    const filters: SQL[] = [eq(donations.donorId, donorId)];

    if (query.status && query.status !== 'all') {
      filters.push(eq(donations.status, query.status));
    }
    if (query.campaignId) filters.push(eq(donations.campaignId, query.campaignId));
    if (query.from) filters.push(gte(donations.donationDate, query.from));
    if (query.to) filters.push(lte(donations.donationDate, query.to));

    const where = and(...filters);

    const totalRows = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(donations)
      .where(where);

    const rows = await this.database.db
      .select({
        id: donations.id,
        reference: donations.reference,
        amount: donations.amount,
        status: donations.status,
        donationType: donations.donationType,
        donationDate: donations.donationDate,
        completedAt: donations.completedAt,
        anonymous: donations.anonymous,
        campaignId: donations.campaignId,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        receiptId: donations.receiptId,
        receiptNumber: receipts.receiptNumber,
      })
      .from(donations)
      .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
      .leftJoin(receipts, eq(receipts.id, donations.receiptId))
      .where(where)
      .orderBy(desc(donations.donationDate))
      .limit(query.limit)
      .offset(offsetFor(query.page, query.limit));

    return paginate(rows, query.page, query.limit, totalRows[0]?.total ?? 0);
  }

  /**
   * One donation, with its lines.
   *
   * The donation is fetched WITH the donor filter, so an id belonging to
   * somebody else never loads. The payment is joined on afterwards and exposes
   * only what a donor needs to recognise their own payment — method, last four
   * digits, when it settled. No provider order id, no provider payment id, no
   * fee, no international flag: those are reconciliation details and they
   * belong to Finance.
   */
  async donation(donorId: string, id: string) {
    const [row] = await this.database.db
      .select({
        id: donations.id,
        reference: donations.reference,
        amount: donations.amount,
        status: donations.status,
        donationType: donations.donationType,
        donationDate: donations.donationDate,
        completedAt: donations.completedAt,
        anonymous: donations.anonymous,
        donorMessage: donations.donorMessage,
        dedication: donations.dedication,
        campaignId: donations.campaignId,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        receiptId: donations.receiptId,
        receiptNumber: receipts.receiptNumber,
      })
      .from(donations)
      .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
      .leftJoin(receipts, eq(receipts.id, donations.receiptId))
      .where(and(eq(donations.id, id), eq(donations.donorId, donorId)))
      .limit(1);

    if (!row) throw new NotFoundException('Donation not found');

    const items = await this.database.db
      .select({
        id: donationItems.id,
        itemType: donationItems.itemType,
        itemName: donationItems.itemName,
        quantity: donationItems.quantity,
        unitPrice: donationItems.unitPrice,
        totalPrice: donationItems.totalPrice,
        fulfilledQuantity: donationItems.fulfilledQuantity,
      })
      .from(donationItems)
      .where(eq(donationItems.donationId, id));

    const [payment] = await this.database.db
      .select({
        status: payments.status,
        method: payments.method,
        cardLast4: payments.cardLast4,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(eq(payments.donationId, id))
      .limit(1);

    return { ...row, items, payment: payment ?? null };
  }

  /**
   * The receipt for one donation.
   *
   * Reached THROUGH the donation rather than by receipt id, so the same
   * ownership filter applies. A receipt also carries `donorId` of its own and
   * that is checked as well — belt and braces on the one document in the system
   * a donor might forward to their accountant.
   */
  async receipt(donorId: string, donationId: string) {
    const [row] = await this.database.db
      .select({
        receiptNumber: receipts.receiptNumber,
        financialYear: receipts.financialYear,
        donorName: receipts.donorName,
        donorEmail: receipts.donorEmail,
        campaignTitle: receipts.campaignTitle,
        programTitle: receipts.programTitle,
        amount: receipts.amount,
        lineItems: receipts.lineItems,
        paymentReference: receipts.paymentReference,
        eightyGEligible: receipts.eightyGEligible,
        registrationNumber: receipts.registrationNumber,
        issuedAt: receipts.issuedAt,
        donationReference: donations.reference,
      })
      .from(receipts)
      .innerJoin(donations, eq(donations.id, receipts.donationId))
      .where(
        and(
          eq(receipts.donationId, donationId),
          eq(receipts.donorId, donorId),
          eq(donations.donorId, donorId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        'No receipt for that donation. A receipt is issued once a payment is confirmed.',
      );
    }
    return row;
  }

  // -------------------------------------------------------------------------
  // Campaigns
  // -------------------------------------------------------------------------

  /**
   * Campaigns this donor has actually funded.
   *
   * SUCCESSFUL donations only. A pending or failed attempt is not support, and
   * listing it here would tell a donor they had funded something they had not.
   *
   * `contributed` is summed from the donor's OWN donations, never from the
   * campaign's total.
   */
  async supportedCampaigns(donorId: string, query: PaginationQuery) {
    const where = and(eq(donations.donorId, donorId), eq(donations.status, 'successful'));

    const totalRows = await this.database.db
      .select({ total: sql<number>`count(DISTINCT ${donations.campaignId})::int` })
      .from(donations)
      .where(where);

    const rows = await this.database.db
      .select({
        campaignId: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        coverImage: campaigns.coverImage,
        category: campaigns.category,
        status: campaigns.status,
        fundraisingGoal: campaigns.fundraisingGoal,
        amountRaised: campaigns.amountRaised,
        contributed: sql<number>`sum(${donations.amount})::bigint`,
        donationCount: sql<number>`count(*)::int`,
        lastDonatedAt: sql<Date>`max(${donations.donationDate})`,
      })
      .from(donations)
      .innerJoin(campaigns, eq(campaigns.id, donations.campaignId))
      .where(where)
      .groupBy(
        campaigns.id,
        campaigns.title,
        campaigns.slug,
        campaigns.coverImage,
        campaigns.category,
        campaigns.status,
        campaigns.fundraisingGoal,
        campaigns.amountRaised,
      )
      .orderBy(desc(sql`max(${donations.donationDate})`))
      .limit(query.limit)
      .offset(offsetFor(query.page, query.limit));

    return paginate(rows, query.page, query.limit, totalRows[0]?.total ?? 0);
  }

  async savedCampaigns(donorId: string, query: PaginationQuery) {
    const where = eq(savedCampaigns.donorId, donorId);

    const totalRows = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(savedCampaigns)
      .where(where);

    const rows = await this.database.db
      .select({
        campaignId: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        coverImage: campaigns.coverImage,
        category: campaigns.category,
        status: campaigns.status,
        shortDescription: campaigns.shortDescription,
        fundraisingGoal: campaigns.fundraisingGoal,
        amountRaised: campaigns.amountRaised,
        savedAt: savedCampaigns.createdAt,
      })
      .from(savedCampaigns)
      .innerJoin(campaigns, eq(campaigns.id, savedCampaigns.campaignId))
      .where(where)
      .orderBy(desc(savedCampaigns.createdAt))
      .limit(query.limit)
      .offset(offsetFor(query.page, query.limit));

    return paginate(rows, query.page, query.limit, totalRows[0]?.total ?? 0);
  }

  /**
   * Save a campaign.
   *
   * IDEMPOTENT. Saving something already saved is a success, not a 409 — the
   * donor asked for it to be saved and it is saved. `onConflictDoNothing` on the
   * unique index handles the double-tap, where a check-then-insert would race
   * two requests that both read "not saved".
   *
   * A campaign must EXIST to be saved, and the check is deliberately not
   * `status = 'published'`: a donor who saved a campaign that has since been
   * paused should keep their bookmark.
   */
  async saveCampaign(donorId: string, campaignId: string) {
    const [campaign] = await this.database.db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) throw new NotFoundException('Campaign not found');

    await this.database.db
      .insert(savedCampaigns)
      .values({ donorId, campaignId })
      .onConflictDoNothing();

    return { saved: true as const, campaignId };
  }

  /** Also idempotent: removing a bookmark that is not there is a success. */
  async unsaveCampaign(donorId: string, campaignId: string) {
    await this.database.db
      .delete(savedCampaigns)
      .where(and(eq(savedCampaigns.donorId, donorId), eq(savedCampaigns.campaignId, campaignId)));

    return { saved: false as const, campaignId };
  }

  // -------------------------------------------------------------------------
  // Impact and updates
  // -------------------------------------------------------------------------

  /**
   * What this donor's giving actually bought.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * EVERY NUMBER HERE IS SUMMED FROM THIS DONOR'S OWN CONFIRMED DONATION LINES.
   *
   * Decision A14: no fabricated statistics. There is no multiplier, no
   * "your ₹5,000 fed 20 families", no share of a campaign's headline figure
   * apportioned by contribution. A donor who bought three school kits is told
   * they bought three school kits, because that is a fact the database holds.
   *
   * `itemsProvided` counts PRODUCT lines only. A custom amount does not buy a
   * countable thing, so counting it as one would be inventing the very number
   * this rule exists to prevent.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async impact(donorId: string) {
    const [totals] = await this.database.db
      .select({
        totalGiven: sql<number>`coalesce(sum(${donations.amount}), 0)::bigint`,
        donationCount: sql<number>`count(*)::int`,
        campaignsSupported: sql<number>`count(DISTINCT ${donations.campaignId})::int`,
        firstDonatedAt: sql<Date | null>`min(${donations.donationDate})`,
        lastDonatedAt: sql<Date | null>`max(${donations.donationDate})`,
      })
      .from(donations)
      .where(and(eq(donations.donorId, donorId), eq(donations.status, 'successful')));

    const items = await this.database.db
      .select({
        itemName: donationItems.itemName,
        quantity: sql<number>`sum(${donationItems.quantity})::int`,
        amount: sql<number>`sum(${donationItems.totalPrice})::bigint`,
      })
      .from(donationItems)
      .innerJoin(donations, eq(donations.id, donationItems.donationId))
      .where(
        and(
          eq(donations.donorId, donorId),
          eq(donations.status, 'successful'),
          eq(donationItems.itemType, 'product'),
        ),
      )
      .groupBy(donationItems.itemName)
      .orderBy(desc(sql`sum(${donationItems.quantity})`));

    return {
      totalGiven: Number(totals?.totalGiven ?? 0),
      donationCount: totals?.donationCount ?? 0,
      campaignsSupported: totals?.campaignsSupported ?? 0,
      firstDonatedAt: totals?.firstDonatedAt ?? null,
      lastDonatedAt: totals?.lastDonatedAt ?? null,
      itemsProvided: items,
    };
  }

  /**
   * Published impact updates from campaigns this donor funded.
   *
   * NOT a notification system with read/unread state — there is no
   * notifications table for donors, and inventing one to hold a boolean would
   * be a bigger commitment than this screen earns. It is the honest thing the
   * data supports: news from the work you paid for, newest first.
   *
   * `isPublic` is respected. An unpublished update is unpublished for everybody,
   * including the people who funded it.
   */
  async updates(donorId: string, query: PaginationQuery) {
    const funded = await this.database.db
      .selectDistinct({ campaignId: donations.campaignId })
      .from(donations)
      .where(and(eq(donations.donorId, donorId), eq(donations.status, 'successful')));

    const campaignIds = funded
      .map((row) => row.campaignId)
      .filter((id): id is string => id !== null);

    if (campaignIds.length === 0) {
      return paginate([], query.page, query.limit, 0);
    }

    const where = and(
      inArray(impactUpdates.campaignId, campaignIds),
      eq(impactUpdates.isPublic, true),
      sql`${impactUpdates.publishedAt} IS NOT NULL`,
    );

    const totalRows = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(impactUpdates)
      .where(where);

    const rows = await this.database.db
      .select({
        id: impactUpdates.id,
        title: impactUpdates.title,
        description: impactUpdates.description,
        images: impactUpdates.images,
        location: impactUpdates.location,
        state: impactUpdates.state,
        impactDate: impactUpdates.impactDate,
        metricType: impactUpdates.metricType,
        metricValue: impactUpdates.metricValue,
        metricUnit: impactUpdates.metricUnit,
        publishedAt: impactUpdates.publishedAt,
        campaignId: impactUpdates.campaignId,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
      })
      .from(impactUpdates)
      .leftJoin(campaigns, eq(campaigns.id, impactUpdates.campaignId))
      .where(where)
      .orderBy(desc(impactUpdates.publishedAt))
      .limit(query.limit)
      .offset(offsetFor(query.page, query.limit));

    return paginate(rows, query.page, query.limit, totalRows[0]?.total ?? 0);
  }

  // -------------------------------------------------------------------------
  // Overview
  // -------------------------------------------------------------------------

  /** Everything the dashboard landing page needs, in one round trip. */
  async overview(donorId: string) {
    const [profile, impact, recent, saved] = await Promise.all([
      this.profile(donorId),
      this.impact(donorId),
      this.donations(donorId, { page: 1, limit: 5, status: 'all' } as MyDonationsQuery),
      this.savedCampaigns(donorId, { page: 1, limit: 4 } as PaginationQuery),
    ]);

    return {
      profile,
      impact,
      recentDonations: recent.items,
      savedCampaigns: saved.items,
    };
  }
}
