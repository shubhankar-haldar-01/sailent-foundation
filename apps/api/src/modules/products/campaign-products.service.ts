import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import {
  campaignProducts,
  campaigns,
  donationItems,
  products,
  type DatabaseClient,
} from '@sailent/database';
import { quantityProgress } from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';

export interface AddCampaignProductInput {
  productId: string;
  /** Paise. Defaults to the catalogue's `defaultPrice` when omitted. */
  price?: number;
  targetQuantity?: number | null;
  maxPerDonation?: number;
  sortOrder?: number;
}

export interface UpdateCampaignProductInput {
  price?: number;
  targetQuantity?: number | null;
  maxPerDonation?: number;
  sortOrder?: number;
}

/**
 * WHICH products a campaign offers, at WHAT price.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * This service owns the junction between `campaigns` and `products`, and the
 * whole of its reason for existing is in one sentence: the campaign's price is
 * the campaign's own.
 *
 * `campaign_products.price` is COPIED from the catalogue's `defaultPrice` when
 * a product is added, and never read from it again. A monsoon appeal charging
 * ₹1,500 for a relief kit and a winter appeal charging ₹1,200 for the same kit
 * are both correct, and the catalogue editing its default changes neither.
 *
 * THREE THINGS THIS SERVICE WILL NOT DO.
 *
 * 1. It will not create a product. `add()` takes a `productId` that must
 *    already exist. An operator who needs a new one creates it in the
 *    catalogue first, deliberately, where everyone else can then find it —
 *    which is how the duplication Phase 5 removed stays removed.
 *
 * 2. It will not write `providedQuantity`. That column moves in exactly one
 *    place, the transaction that records a CAPTURED payment, and in exactly
 *    one other under a separate sensitive permission with a mandatory reason
 *    (`adjustProvided`). A pending, failed, cancelled or timed-out payment
 *    moves nothing.
 *
 * 3. It will not hard-delete a row that donations cite. `remove()` soft-deletes
 *    so the offering disappears from the campaign while every receipt that
 *    names it still resolves.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class CampaignProductsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
  ) {}

  /**
   * The authorization boundary for every method here.
   *
   * Without it, a caller could act on another campaign's offerings by passing
   * a different id in the path — the child id alone is not proof of anything.
   */
  private async assertCampaign(campaignId: string) {
    const [row] = await this.database.db
      .select({ id: campaigns.id, title: campaigns.title, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Campaign');
    return row;
  }

  /** The columns a caller sees: the offer, joined to what it is an offer OF. */
  private selection() {
    return {
      id: campaignProducts.id,
      campaignId: campaignProducts.campaignId,
      productId: campaignProducts.productId,
      // Read through the join, never copied onto the junction. That is the
      // whole point of the refactor: one description, one name, one place.
      name: products.name,
      slug: products.slug,
      description: products.description,
      image: products.image,
      unit: products.unit,
      productStatus: products.status,
      defaultPrice: products.defaultPrice,
      // The campaign's own, independent of the catalogue.
      price: campaignProducts.price,
      currency: campaignProducts.currency,
      targetQuantity: campaignProducts.targetQuantity,
      providedQuantity: campaignProducts.providedQuantity,
      maxPerDonation: campaignProducts.maxPerDonation,
      sortOrder: campaignProducts.sortOrder,
      status: campaignProducts.status,
      isActive: campaignProducts.isActive,
      createdAt: campaignProducts.createdAt,
      updatedAt: campaignProducts.updatedAt,
    };
  }

  private decorate<T extends { targetQuantity: number | null; providedQuantity: number }>(row: T) {
    return { ...row, progress: quantityProgress(row.targetQuantity, row.providedQuantity) };
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(campaignId: string, options: { activeOnly?: boolean } = {}) {
    await this.assertCampaign(campaignId);

    const filters = [
      eq(campaignProducts.campaignId, campaignId),
      isNull(campaignProducts.deletedAt),
    ];

    if (options.activeOnly) {
      filters.push(eq(campaignProducts.isActive, true));
      // BOTH flags. A product withdrawn from the catalogue centrally must
      // disappear from every campaign without anyone visiting each one.
      filters.push(eq(products.status, 'active'));
    }

    const rows = await this.database.db
      .select(this.selection())
      .from(campaignProducts)
      .innerJoin(products, eq(products.id, campaignProducts.productId))
      .where(and(...filters))
      .orderBy(asc(campaignProducts.sortOrder), asc(products.name));

    return { items: rows.map((row) => this.decorate(row)) };
  }

  async getOne(campaignId: string, campaignProductId: string) {
    const [row] = await this.database.db
      .select(this.selection())
      .from(campaignProducts)
      .innerJoin(products, eq(products.id, campaignProducts.productId))
      .where(
        and(
          eq(campaignProducts.id, campaignProductId),
          eq(campaignProducts.campaignId, campaignId),
          isNull(campaignProducts.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Campaign product');
    return this.decorate(row);
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /**
   * Offer an existing catalogue product on this campaign.
   *
   * The price defaults to the catalogue's, and is COPIED. From this moment the
   * two are unrelated numbers that happen to have started equal.
   */
  async add(
    campaignId: string,
    input: AddCampaignProductInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const campaign = await this.assertCampaign(campaignId);
    const product = await this.assertProduct(input.productId);

    if (product.status !== 'active') {
      throw new ValidationException(
        [
          {
            field: 'productId',
            code: 'not_active',
            message: `“${product.name}” is ${product.status} in the catalogue. Reactivate it before offering it.`,
          },
        ],
        'That product is not available.',
      );
    }

    /**
     * Restore rather than duplicate.
     *
     * A product removed from this campaign earlier left a soft-deleted row, and
     * the unique index covers it — so a plain insert would fail with a
     * constraint error for what is really "you already had this, put it back".
     */
    const [existing] = await this.database.db
      .select({ id: campaignProducts.id, deletedAt: campaignProducts.deletedAt })
      .from(campaignProducts)
      .where(
        and(
          eq(campaignProducts.campaignId, campaignId),
          eq(campaignProducts.productId, input.productId),
        ),
      )
      .limit(1);

    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `“${campaign.title}” already offers “${product.name}”. Edit its price instead of adding it again.`,
      );
    }

    const price = input.price ?? product.defaultPrice;
    const values = {
      campaignId,
      productId: input.productId,
      price,
      targetQuantity: input.targetQuantity ?? null,
      maxPerDonation: input.maxPerDonation ?? 999,
      sortOrder: input.sortOrder ?? 100,
      isActive: true,
      status: 'active' as const,
      deletedAt: null,
      updatedAt: new Date(),
    };

    let id: string;

    if (existing) {
      await this.database.db
        .update(campaignProducts)
        .set(values)
        .where(eq(campaignProducts.id, existing.id));
      id = existing.id;
    } else {
      const [created] = await this.database.db
        .insert(campaignProducts)
        // `providedQuantity` is absent BY CONSTRUCTION. It defaults to zero and
        // moves only on a captured payment.
        .values(values)
        .returning({ id: campaignProducts.id });

      if (!created) throw new ConflictException('Could not add the product to this campaign.');
      id = created.id;
    }

    await this.audit.record({
      action: 'campaign_product.add',
      entityType: 'campaign_product',
      entityId: id,
      userId: actor.id,
      newValues: {
        campaignId,
        productId: input.productId,
        productName: product.name,
        price,
        priceSource: input.price === undefined ? 'catalogue_default' : 'explicit',
        targetQuantity: values.targetQuantity,
        restored: Boolean(existing),
      },
      ...context,
    });

    return this.getOne(campaignId, id);
  }

  /**
   * Change what this campaign asks for.
   *
   * A PRICE CHANGE DOES NOT REWRITE HISTORY. `donation_items.unit_price`
   * snapshots what was actually charged (decision A5), so a receipt issued last
   * month keeps saying what the donor paid. This changes what the next donor is
   * asked for, and nothing else.
   */
  async update(
    campaignId: string,
    campaignProductId: string,
    input: UpdateCampaignProductInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getOne(campaignId, campaignProductId);

    if (input.targetQuantity !== undefined && input.targetQuantity !== null) {
      if (input.targetQuantity < before.providedQuantity) {
        throw new ValidationException([
          {
            field: 'targetQuantity',
            code: 'below_provided',
            message: `The target cannot be below the ${before.providedQuantity} already provided.`,
          },
        ]);
      }
    }

    const fields: Record<string, unknown> = { updatedAt: new Date() };
    if (input.price !== undefined) fields.price = input.price;
    if (input.targetQuantity !== undefined) fields.targetQuantity = input.targetQuantity;
    if (input.maxPerDonation !== undefined) fields.maxPerDonation = input.maxPerDonation;
    if (input.sortOrder !== undefined) fields.sortOrder = input.sortOrder;

    await this.database.db
      .update(campaignProducts)
      .set(fields)
      .where(eq(campaignProducts.id, campaignProductId));

    // A price change gets its own audit row. It is the edit that changes what
    // a donor is charged, and it should be findable without reading every
    // product edit ever made.
    if (input.price !== undefined && input.price !== before.price) {
      await this.audit.record({
        action: 'campaign_product.price_changed',
        entityType: 'campaign_product',
        entityId: campaignProductId,
        userId: actor.id,
        oldValues: { price: before.price },
        newValues: {
          price: input.price,
          productName: before.name,
          affectsHistoricalDonations: false,
        },
        severity: 'warning',
        ...context,
      });
    }

    await this.audit.record({
      action: 'campaign_product.update',
      entityType: 'campaign_product',
      entityId: campaignProductId,
      userId: actor.id,
      oldValues: {
        price: before.price,
        targetQuantity: before.targetQuantity,
        maxPerDonation: before.maxPerDonation,
      },
      newValues: { ...input },
      ...context,
    });

    return this.getOne(campaignId, campaignProductId);
  }

  async setActive(
    campaignId: string,
    campaignProductId: string,
    isActive: boolean,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getOne(campaignId, campaignProductId);

    if (before.isActive === isActive) {
      throw new ConflictException(`That product is already ${isActive ? 'active' : 'inactive'}.`);
    }

    await this.database.db
      .update(campaignProducts)
      .set({
        isActive,
        status: isActive ? 'active' : 'inactive',
        updatedAt: new Date(),
      })
      .where(eq(campaignProducts.id, campaignProductId));

    await this.audit.record({
      action: `campaign_product.${isActive ? 'activate' : 'deactivate'}`,
      entityType: 'campaign_product',
      entityId: campaignProductId,
      userId: actor.id,
      oldValues: { isActive: before.isActive },
      newValues: { isActive, productName: before.name },
      reason,
      severity: 'warning',
      ...context,
    });

    return this.getOne(campaignId, campaignProductId);
  }

  /**
   * Stop offering a product on this campaign.
   *
   * SOFT DELETE, always. The offering leaves the page; the row stays, because
   * `donation_items.campaign_product_id` points at it and a donor's receipt
   * must keep resolving. The foreign key is `ON DELETE RESTRICT`, so a hard
   * delete would fail anyway — this makes the intended behaviour explicit
   * rather than leaving it to a constraint error.
   *
   * Removing something people have already funded is refused outright, and the
   * refusal names the alternative. Deactivating takes it off the page and
   * keeps the progress figure that donors were shown.
   */
  async remove(
    campaignId: string,
    campaignProductId: string,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getOne(campaignId, campaignProductId);

    const [cited] = await this.database.db
      .select({ value: sql<number>`count(*)::int` })
      .from(donationItems)
      .where(eq(donationItems.campaignProductId, campaignProductId));

    const donationCount = cited?.value ?? 0;

    if (donationCount > 0 || before.providedQuantity > 0) {
      throw new ConflictException(
        `“${before.name}” has already been funded on this campaign ` +
          `(${donationCount} donation line${donationCount === 1 ? '' : 's'}, ` +
          `${before.providedQuantity} provided). Deactivate it instead — it comes off the page ` +
          'and the record of what donors gave stays intact.',
      );
    }

    await this.database.db
      .update(campaignProducts)
      .set({ deletedAt: new Date(), isActive: false, status: 'inactive', updatedAt: new Date() })
      .where(eq(campaignProducts.id, campaignProductId));

    await this.audit.record({
      action: 'campaign_product.remove',
      entityType: 'campaign_product',
      entityId: campaignProductId,
      userId: actor.id,
      oldValues: {
        productId: before.productId,
        productName: before.name,
        price: before.price,
        targetQuantity: before.targetQuantity,
      },
      newValues: { deleted: true },
      reason,
      severity: 'warning',
      ...context,
    });

    return { removed: true, id: campaignProductId };
  }

  /**
   * Correct a provided quantity by hand.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * DELIBERATELY SEPARATE from `update`, with its own sensitive permission and
   * a mandatory reason.
   *
   * `providedQuantity` is meant to be a consequence of donations received.
   * There are real cases for correcting it — a distribution that happened
   * offline, a correction after a miscount — but each is an exception, and an
   * exception that can be made from the ordinary edit form stops being one.
   * Putting it on its own endpoint means every adjustment is a decision
   * somebody made on purpose and can be asked about.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async adjustProvided(
    campaignId: string,
    campaignProductId: string,
    providedQuantity: number,
    reason: string,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getOne(campaignId, campaignProductId);

    if (!Number.isInteger(providedQuantity) || providedQuantity < 0) {
      throw new ValidationException([
        {
          field: 'providedQuantity',
          code: 'invalid',
          message: 'Enter a whole number, zero or above.',
        },
      ]);
    }

    await this.database.db
      .update(campaignProducts)
      .set({ providedQuantity, updatedAt: new Date() })
      .where(eq(campaignProducts.id, campaignProductId));

    await this.audit.record({
      action: 'campaign_product.adjust_provided',
      entityType: 'campaign_product',
      entityId: campaignProductId,
      userId: actor.id,
      oldValues: { providedQuantity: before.providedQuantity },
      newValues: { providedQuantity, productName: before.name },
      reason,
      // Critical: a hand edit to a number that is supposed to be derived from
      // money received.
      severity: 'critical',
      ...context,
    });

    return this.getOne(campaignId, campaignProductId);
  }

  /** Reorder the offerings in one write per row, under a single audit entry. */
  async reorder(
    campaignId: string,
    order: { id: string; sortOrder: number }[],
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    await this.assertCampaign(campaignId);

    const ids = order.map((entry) => entry.id);
    const owned = await this.database.db
      .select({ id: campaignProducts.id })
      .from(campaignProducts)
      .where(
        and(
          eq(campaignProducts.campaignId, campaignId),
          inArray(campaignProducts.id, ids),
          isNull(campaignProducts.deletedAt),
        ),
      );

    // Every id must belong to THIS campaign. A payload mixing in another
    // campaign's row would otherwise reorder something the caller was not
    // looking at.
    if (owned.length !== ids.length) {
      throw new ValidationException([
        {
          field: 'order',
          code: 'not_found',
          message: 'One of those products is not on this campaign.',
        },
      ]);
    }

    await this.database.db.transaction(async (tx) => {
      for (const entry of order) {
        await tx
          .update(campaignProducts)
          .set({ sortOrder: entry.sortOrder, updatedAt: new Date() })
          .where(eq(campaignProducts.id, entry.id));
      }
    });

    await this.audit.record({
      action: 'campaign_product.reorder',
      entityType: 'campaign',
      entityId: campaignId,
      userId: actor.id,
      newValues: { order },
      ...context,
    });

    return this.list(campaignId);
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  private async assertProduct(productId: string) {
    const [row] = await this.database.db
      .select({
        id: products.id,
        name: products.name,
        status: products.status,
        defaultPrice: products.defaultPrice,
      })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);

    if (!row) {
      throw new ValidationException([
        { field: 'productId', code: 'not_found', message: 'That product does not exist.' },
      ]);
    }

    return row;
  }
}
