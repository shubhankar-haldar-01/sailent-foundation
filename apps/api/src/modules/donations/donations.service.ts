import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import {
  campaignProducts,
  campaigns,
  donationItems,
  donations,
  donors,
  payments,
  products,
  type DatabaseClient,
} from '@sailent/database';
import {
  acceptsDonations,
  hasEnded,
  donationType,
  summariseDonation,
  validateDonationComposition,
  type CampaignStatus,
  type DonationProductLine,
} from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { RazorpayClient } from './razorpay.client.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import { referenceCode } from '../../common/utils/reference.js';

export interface DonationRequestItem {
  campaignProductId: string;
  quantity: number;
}

export interface CreateDonationInput {
  campaignSlug: string;
  items: DonationRequestItem[];
  /** Paise. Zero or absent means a pure product donation. */
  customAmount?: number;
  donor: {
    name: string;
    email: string;
    phone: string;
    anonymous?: boolean;
    message?: string;
  };
  source?: string;
  ipCountry?: string;
}

/**
 * How long a pending donation holds units of a limited product.
 *
 * Long enough for a donor to find their card and complete a UPI prompt; short
 * enough that an abandoned checkout does not keep stock off the page all
 * afternoon. Nothing expires a donation at this mark — it only stops counting
 * towards the reservation arithmetic below.
 */
const HOLD_MINUTES = 30;

/**
 * Creating a donation, and the order that will pay for it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BROWSER SENDS IDS AND QUANTITIES. NOTHING ELSE COUNTS.
 *
 * No price, no subtotal, no total, no campaign status, no product status. Every
 * one of those is read from the database here and recomputed, because every one
 * of them is trivially editable in a devtools console and each would be a
 * different way to pay ₹1 for a ₹9,000 clinic day.
 *
 * The request may carry a total; it is ignored. There is no code path in this
 * file that reads an amount from the caller other than `customAmount`, which is
 * floored at the campaign's own minimum and cannot be negative.
 *
 * NOTHING HERE TOUCHES PROGRESS. `amountRaised`, `donorCount` and
 * `providedQuantity` are not written by this service at all — a created
 * donation is a statement of intent, and an intent that moves a progress bar is
 * how a campaign appears funded by people who never paid. That happens in
 * `DonationCaptureService`, once money has actually arrived.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly razorpay: RazorpayClient,
  ) {}

  async create(input: CreateDonationInput) {
    const campaign = await this.loadOpenCampaign(input.campaignSlug);
    const lines = await this.priceLines(campaign.id, input.items);

    const customAmount = Math.max(0, Math.trunc(input.customAmount ?? 0));
    const issues = validateDonationComposition(lines, customAmount, {
      minimumAmount: campaign.minDonationAmount,
      allowCustomAmount: campaign.allowCustomAmount,
      maxPerDonation: Object.fromEntries(
        lines.map((line) => [line.campaignProductId, line.maxPerDonation]),
      ),
    });

    if (issues.length > 0) {
      throw new ValidationException(issues, 'This donation cannot be accepted as it stands.');
    }

    // THE authority on the amount. The same function the donation page uses to
    // show a total, run again here over prices read from the database.
    const summary = summariseDonation(lines, customAmount);

    /**
     * The whole creation is one transaction.
     *
     * The availability check below reads uncommitted-to-us state — other
     * donations in flight — and must not be separated from the insert that
     * changes it. Outside a transaction, two donors clearing the same last
     * seven units simultaneously both pass and both get an order.
     */
    const created = await this.database.db.transaction(async (tx) => {
      await this.assertUnitsAvailable(tx, lines);

      const donor = await this.upsertDonor(tx, input.donor);
      const reference = referenceCode('DON', 8);

      const [donation] = await tx
        .insert(donations)
        .values({
          reference,
          donorId: donor.id,
          campaignId: campaign.id,
          programId: campaign.programId,
          donationType: donationType(lines.length, customAmount),
          amount: summary.total,
          currency: 'INR',
          // `pending`, always. The only status a client action may produce.
          status: 'pending',
          provider: 'razorpay',
          anonymous: input.donor.anonymous ?? false,
          donorMessage: input.donor.message ?? null,
          source: input.source ?? 'web',
          ipCountry: input.ipCountry ?? null,
        })
        .returning();

      if (!donation) throw new ConflictException('Could not start this donation.');

      const rows = summary.lines
        .filter((line) => line.quantity > 0)
        .map((line) => ({
          donationId: donation.id,
          campaignProductId: line.campaignProductId,
          productId: line.productId,
          itemType: 'product' as const,
          // SNAPSHOTS. Written now, never updated, never re-read from the
          // catalogue. A receipt reprinted in five years reads these.
          itemName: line.productName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalAmount,
        }));

      if (customAmount > 0) {
        rows.push({
          donationId: donation.id,
          campaignProductId: null as unknown as string,
          productId: null as unknown as string,
          itemType: 'custom' as unknown as 'product',
          itemName: 'Additional donation',
          quantity: 1,
          unitPrice: customAmount,
          totalPrice: customAmount,
        });
      }

      if (rows.length > 0) await tx.insert(donationItems).values(rows);

      const [payment] = await tx
        .insert(payments)
        .values({
          donationId: donation.id,
          provider: 'razorpay',
          amount: summary.total,
          currency: 'INR',
          status: 'created',
        })
        .returning();

      if (!payment) throw new ConflictException('Could not start this payment.');

      return { donation, payment, donor };
    });

    /**
     * The provider call happens AFTER the transaction commits, not inside it.
     *
     * Holding a database transaction open across a network call to a third
     * party is how a slow provider becomes a pile of locked rows. The cost is
     * that a failure here leaves a `pending` donation with no order — which is
     * harmless, is exactly what an abandoned checkout looks like anyway, and is
     * swept by the same reconciliation that handles those.
     */
    const order = await this.razorpay.createOrder({
      amount: summary.total,
      currency: 'INR',
      receipt: created.donation.reference,
      notes: {
        donationId: created.donation.id,
        campaign: campaign.slug,
      },
    });

    await this.database.db
      .update(payments)
      .set({ providerOrderId: order.id, status: 'pending', updatedAt: new Date() })
      .where(eq(payments.id, created.payment.id));

    this.logger.log(
      `Donation ${created.donation.reference} created for ${campaign.slug}, order ${order.id}`,
    );

    return {
      donationId: created.donation.id,
      reference: created.donation.reference,
      razorpayOrderId: order.id,
      amount: summary.total,
      currency: 'INR',
      // The publishable key. Checkout needs it in the browser; the secret does
      // not appear in this response or any other.
      razorpayKeyId: this.razorpay.publicKeyId,
      donor: {
        name: input.donor.name,
        email: input.donor.email,
        phone: input.donor.phone,
      },
      campaign: { slug: campaign.slug, title: campaign.title },
    };
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /**
   * A donation by its public reference.
   *
   * Deliberately keyed on `reference`, not on the uuid: this is what the status
   * page polls and what a donor quotes to support. It returns no payment
   * identifiers and no donor PII beyond the name the donor themselves typed.
   */
  async getByReference(reference: string) {
    const [row] = await this.database.db
      .select({
        id: donations.id,
        reference: donations.reference,
        status: donations.status,
        donationType: donations.donationType,
        amount: donations.amount,
        currency: donations.currency,
        anonymous: donations.anonymous,
        completedAt: donations.completedAt,
        createdAt: donations.createdAt,
        campaignSlug: campaigns.slug,
        campaignTitle: campaigns.title,
        donorName: donors.firstName,
      })
      .from(donations)
      .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
      .leftJoin(donors, eq(donors.id, donations.donorId))
      .where(eq(donations.reference, reference))
      .limit(1);

    if (!row) throw new NotFoundException('Donation');

    const items = await this.database.db
      .select({
        itemType: donationItems.itemType,
        itemName: donationItems.itemName,
        quantity: donationItems.quantity,
        unitPrice: donationItems.unitPrice,
        totalPrice: donationItems.totalPrice,
      })
      .from(donationItems)
      .where(eq(donationItems.donationId, row.id));

    return { ...row, items };
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  /** The campaign must exist, be open, and be within its dates. */
  private async loadOpenCampaign(slug: string) {
    const [campaign] = await this.database.db
      .select({
        id: campaigns.id,
        slug: campaigns.slug,
        title: campaigns.title,
        status: campaigns.status,
        programId: campaigns.programId,
        endDate: campaigns.endDate,
        minDonationAmount: campaigns.minDonationAmount,
        allowCustomAmount: campaigns.allowCustomAmount,
        stopAtGoal: campaigns.stopAtGoal,
        fundraisingGoal: campaigns.fundraisingGoal,
        amountRaised: campaigns.amountRaised,
      })
      .from(campaigns)
      .where(and(eq(campaigns.slug, slug), isNull(campaigns.deletedAt)))
      .limit(1);

    if (!campaign) throw new NotFoundException('Campaign');

    // The SHARED rule, not a second copy of it. `acceptsDonations` is the same
    // function the public page uses to decide whether to show the form, so the
    // page and the server cannot disagree about whether giving is open.
    if (!acceptsDonations(campaign.status as CampaignStatus)) {
      throw new ConflictException('This campaign is not accepting donations at the moment.');
    }

    // The same deadline rule the page uses (`hasEnded`): the end date is the
    // last day to give, through to midnight India time — so the page never
    // offers a donation this refuses, or refuses one it offered.
    if (hasEnded(campaign.endDate)) {
      throw new ConflictException('This campaign has closed.');
    }

    if (campaign.stopAtGoal && campaign.amountRaised >= campaign.fundraisingGoal) {
      throw new ConflictException(
        'This campaign has reached its goal and is no longer taking donations. Thank you.',
      );
    }

    return campaign;
  }

  /**
   * Turn the requested ids into priced lines, from the database.
   *
   * Every price on the returned lines is `campaign_products.price` as stored.
   * The request's own idea of a price, if it sent one, never reaches here.
   */
  private async priceLines(
    campaignId: string,
    requested: DonationRequestItem[],
  ): Promise<(DonationProductLine & { maxPerDonation: number; targetQuantity: number | null })[]> {
    if (requested.length === 0) return [];

    const ids = [...new Set(requested.map((item) => item.campaignProductId))];
    const rows = await this.database.db
      .select({
        id: campaignProducts.id,
        productId: campaignProducts.productId,
        campaignId: campaignProducts.campaignId,
        price: campaignProducts.price,
        isActive: campaignProducts.isActive,
        maxPerDonation: campaignProducts.maxPerDonation,
        targetQuantity: campaignProducts.targetQuantity,
        productName: products.name,
        productStatus: products.status,
      })
      .from(campaignProducts)
      .innerJoin(products, eq(products.id, campaignProducts.productId))
      .where(and(inArray(campaignProducts.id, ids), isNull(campaignProducts.deletedAt)));

    const byId = new Map(rows.map((row) => [row.id, row]));

    return requested.map((item, index) => {
      const row = byId.get(item.campaignProductId);

      if (!row) {
        throw new ValidationException([
          {
            field: `items.${index}.campaignProductId`,
            code: 'not_found',
            message: 'That item is no longer available.',
          },
        ]);
      }

      // The offering must belong to THIS campaign. Without this check a caller
      // could pay another campaign's price for this campaign's product, or
      // credit the wrong appeal entirely.
      if (row.campaignId !== campaignId) {
        throw new ValidationException([
          {
            field: `items.${index}.campaignProductId`,
            code: 'wrong_campaign',
            message: 'That item belongs to a different campaign.',
          },
        ]);
      }

      // BOTH flags, as everywhere else: the catalogue says whether we do this
      // at all, the campaign says whether it is asking for it here.
      if (!row.isActive || row.productStatus !== 'active') {
        throw new ValidationException([
          {
            field: `items.${index}.campaignProductId`,
            code: 'not_active',
            message: `“${row.productName}” is not available on this campaign right now.`,
          },
        ]);
      }

      return {
        campaignProductId: row.id,
        productId: row.productId,
        productName: row.productName,
        unitPrice: row.price,
        quantity: item.quantity,
        maxPerDonation: row.maxPerDonation,
        targetQuantity: row.targetQuantity,
      };
    });
  }

  /**
   * Do not sell the last seven units twice.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * The check has to account for donations that are IN FLIGHT — created, order
   * placed, donor still typing a card number. Those units are spoken for but
   * `providedQuantity` has not moved, because it only moves on capture.
   *
   * So availability is: target − provided − held, where held is the quantity on
   * pending donations young enough to still complete. The row lock is what
   * makes the arithmetic safe: two requests for the same offering serialise
   * here, so the second sees the first's insert.
   *
   * The lock is taken on `campaign_products` even though this method never
   * writes it. That is the point — it is a mutex over "units of this offering",
   * and the thing being protected is the INSERT that follows in the same
   * transaction.
   *
   * An offering with no target is unlimited and skips all of this.
   * ══════════════════════════════════════════════════════════════════════════
   */
  private async assertUnitsAvailable(
    tx: Parameters<Parameters<DatabaseClient['db']['transaction']>[0]>[0],
    lines: (DonationProductLine & { targetQuantity: number | null })[],
  ): Promise<void> {
    const limited = lines.filter((line) => line.targetQuantity !== null && line.quantity > 0);
    if (limited.length === 0) return;

    // Sorted, so concurrent baskets containing the same two offerings always
    // take the locks in the same order and cannot deadlock against each other.
    const ids = [...new Set(limited.map((line) => line.campaignProductId))].sort();

    const locked = await tx.execute<{
      id: string;
      target_quantity: number | null;
      provided_quantity: number;
    }>(sql`
      SELECT id, target_quantity, provided_quantity
        FROM campaign_products
       WHERE id IN (${sql.join(
         ids.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
       ORDER BY id
         FOR UPDATE
    `);

    const held = await tx.execute<{ campaign_product_id: string; quantity: string }>(sql`
      SELECT di.campaign_product_id, COALESCE(SUM(di.quantity), 0)::text AS quantity
        FROM donation_items di
        JOIN donations d ON d.id = di.donation_id
       WHERE di.campaign_product_id IN (${sql.join(
         ids.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
         AND d.status IN ('pending', 'processing')
         AND d.created_at > now() - (${HOLD_MINUTES} || ' minutes')::interval
       GROUP BY di.campaign_product_id
    `);

    const heldBy = new Map(
      (held.rows ?? []).map((row) => [row.campaign_product_id, Number(row.quantity)]),
    );
    const stateBy = new Map((locked.rows ?? []).map((row) => [row.id, row]));

    for (const [index, line] of limited.entries()) {
      const state = stateBy.get(line.campaignProductId);
      if (!state || state.target_quantity === null) continue;

      const remaining =
        state.target_quantity - state.provided_quantity - (heldBy.get(line.campaignProductId) ?? 0);

      if (line.quantity > remaining) {
        throw new ValidationException(
          [
            {
              field: `items.${index}.quantity`,
              code: 'insufficient_remaining',
              message:
                remaining <= 0
                  ? `“${line.productName}” is fully funded. Thank you — please choose something else.`
                  : `Only ${remaining} of “${line.productName}” remain. Please lower the quantity.`,
            },
          ],
          'That quantity is no longer available.',
        );
      }
    }
  }

  /**
   * Find or create the donor.
   *
   * ════════════════════════════════════════════════════════════════════════
   * KEYED ON EMAIL, BECAUSE EMAIL IS WHAT A DONOR SIGNS IN WITH.
   *
   * This was keyed on PHONE, and the reasoning was good: an email is shared
   * within a household far more often than a mobile number, so phone kept a
   * husband's and a wife's giving history apart.
   *
   * Donor sign-in by email inverted the requirement. An address has to resolve
   * to exactly one donor or the sign-in code is a coin toss between two
   * people's records, so `donors_email_lower_unique` (migration `0011`) now
   * enforces that — and keying this on phone while the database keys on email
   * would mean a returning donor who changed their number hit a unique
   * violation on a column this method never looked at.
   *
   * MATCHED CASE-INSENSITIVELY, the same way the index is built and the same
   * way sign-in normalises. Anything else and `Asha@example.com` becomes a
   * second donor the index then refuses to create.
   * ════════════════════════════════════════════════════════════════════════
   *
   * A returning donor's name and phone are UPDATED from what they typed now.
   * People marry, change employer, change number, mistype. The latest thing
   * they told us is the best thing we know, and the receipt they are about to
   * receive should carry it.
   */
  private async upsertDonor(
    tx: Parameters<Parameters<DatabaseClient['db']['transaction']>[0]>[0],
    input: CreateDonationInput['donor'],
  ) {
    const [firstName, ...rest] = input.name.trim().split(/\s+/);
    const lastName = rest.join(' ') || null;

    const email = input.email.trim().toLowerCase();

    const [existing] = await tx
      .select({ id: donors.id })
      .from(donors)
      .where(sql`lower(btrim(${donors.email})) = ${email}`)
      .limit(1);

    if (existing) {
      await tx
        .update(donors)
        .set({
          firstName: firstName ?? input.name,
          lastName,
          phone: input.phone,
          updatedAt: new Date(),
        })
        .where(eq(donors.id, existing.id));
      return existing;
    }

    const year = new Date().getFullYear();
    const [created] = await tx
      .insert(donors)
      .values({
        // Random rather than sequential: a sequential donor code published on a
        // receipt tells the reader how many donors this organisation has.
        donorCode: `DNR-${year}-${referenceCode('', 6).replace('-', '')}`,
        firstName: firstName ?? input.name,
        lastName,
        // Stored as typed; matched lower-cased. The donor sees their own
        // capitalisation on the receipt.
        email: input.email.trim(),
        phone: input.phone,
        isAnonymous: input.anonymous ?? false,
        source: 'web',
      })
      .returning({ id: donors.id });

    if (!created) throw new ConflictException('Could not record the donor.');
    return created;
  }
}
