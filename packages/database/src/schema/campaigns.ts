import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { currency, money, primaryId, softDelete, timestamps } from './_shared.js';
import { campaignProductStatusEnum, campaignStatusEnum } from './enums.js';
import { products } from './products.js';
import { programs } from './programs.js';
import { categories } from './taxonomy.js';

/**
 * Campaigns.
 *
 * CRITICAL INVARIANT: `amountRaised`, `donorCount` and
 * `beneficiariesReached` are DERIVED-CACHED (decision A6). They are written in
 * exactly one place — the transaction that moves a payment to captured, under
 * `SELECT … FOR UPDATE` on this row — and never from a request handler. A
 * nightly job recomputes them from `donation_items` and ALERTS on drift rather
 * than silently correcting it, because a silent correction hides the bug that
 * caused the drift.
 */
export const campaigns = pgTable(
  'campaigns',
  {
    id: primaryId(),
    programId: uuid('program_id').references(() => programs.id, { onDelete: 'restrict' }),

    title: varchar('title', { length: 240 }).notNull(),
    slug: varchar('slug', { length: 240 }).notNull(),
    shortDescription: text('short_description'),
    description: text('description'),
    beneficiaryContext: text('beneficiary_context'),
    coverImage: text('cover_image'),
    /**
     * `[{ label, value, unit? }]` — what this campaign has achieved so far.
     * Decision A14: every figure must trace to a dated impact record.
     */
    impactNotes: jsonb('impact_notes').$type<{ label: string; value: number; unit?: string }[]>(),

    /**
     * FAQs, gallery images and progress updates used to live here as JSON.
     * Phase 4 moved each to a table of its own, because each entry needed
     * things JSON cannot give it: a stable id to edit or delete by, its own
     * published flag, its own display order, and — for gallery images — a
     * foreign key to the media record holding the storage key.
     *
     *   FAQs     → `faqs` WHERE context_type = 'campaign'
     *   Gallery  → `campaign_gallery` joined to `media`
     *   Updates  → `impact_updates` WHERE campaign_id = …
     */

    /** Denormalised cache of `categories.name` — see the note on programs. */
    category: varchar('category', { length: 80 }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    location: varchar('location', { length: 160 }),
    state: varchar('state', { length: 120 }),
    city: varchar('city', { length: 120 }),

    startDate: timestamp('start_date', { withTimezone: true }),
    /** NULL = open-ended. No countdown is shown without a real deadline. */
    endDate: timestamp('end_date', { withTimezone: true }),

    fundraisingGoal: money('fundraising_goal').notNull(),
    amountRaised: money('amount_raised').notNull().default(0),
    currency: currency(),

    donorCount: integer('donor_count').notNull().default(0),
    beneficiaryTarget: integer('beneficiary_target'),
    beneficiariesReached: integer('beneficiaries_reached').notNull().default(0),
    fundUtilization: jsonb('fund_utilization'),

    status: campaignStatusEnum('status').notNull().default('draft'),
    /** Shown publicly when paused — a pause without a reason reads as a problem. */
    pauseReason: text('pause_reason'),
    /** Refuse donations once the goal is met, for campaigns that must not over-collect. */
    stopAtGoal: boolean('stop_at_goal').notNull().default(false),
    allowCustomAmount: boolean('allow_custom_amount').notNull().default(true),
    minDonationAmount: money('min_donation_amount').notNull().default(1000),

    isFeatured: boolean('is_featured').notNull().default(false),
    featuredOrder: integer('featured_order'),

    /** Reserved for peer-to-peer, which is out of scope for v1 (Phase 0). */
    attributedTo: uuid('attributed_to'),

    internalNotes: text('internal_notes'),
    metaTitle: varchar('meta_title', { length: 240 }),
    metaDescription: varchar('meta_description', { length: 400 }),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('campaigns_slug_unique').on(table.slug),
    // Default listing sort: active campaigns by real deadline.
    index('campaigns_status_end_date_idx').on(table.status, table.endDate),
    index('campaigns_program_idx').on(table.programId),
    index('campaigns_category_idx').on(table.category),
    index('campaigns_location_idx').on(table.state, table.city),
    index('campaigns_featured_idx')
      .on(table.featuredOrder)
      .where(sql`is_featured = true`),
    index('campaigns_created_idx').on(table.createdAt),

    /**
     * A PUBLIC campaign must have a real goal; a draft need not.
     *
     * The original `fundraising_goal > 0` made it impossible to save a
     * half-written campaign, which is the entire purpose of a draft — an
     * operator does not always know the number when they start writing. The
     * rule that actually matters is that nothing reaches the public without
     * one, and `CampaignsService.assertPublishable` enforces the same thing at
     * the transition, so a draft cannot slip out with a zero goal either.
     */
    check('campaigns_goal_positive_when_public', sql`status = 'draft' OR fundraising_goal > 0`),
    check('campaigns_raised_non_negative', sql`amount_raised >= 0`),
    check('campaigns_donor_count_non_negative', sql`donor_count >= 0`),
    check(
      'campaigns_dates_ordered',
      sql`end_date IS NULL OR start_date IS NULL OR end_date > start_date`,
    ),
  ],
);

/**
 * Campaign products — the platform's differentiator.
 *
 * Note there is deliberately NO `CHECK (fulfilled <= target)`: over-subscription
 * is shown honestly rather than clamped, and lowering a target below what has
 * already been provided must not break the row.
 */
export const campaignProducts = pgTable(
  'campaign_products',
  {
    id: primaryId(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'restrict' }),
    /**
     * The catalogue entry this offers. `restrict`, not `cascade`: a product
     * that has ever been offered cannot be deleted out from under the
     * donations that reference it.
     */
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),

    /**
     * The price THIS campaign charges, in paise.
     *
     * Seeded from the product's `default_price` when the product is added, and
     * independent from that moment on. Editing the catalogue price does not
     * reach back into campaigns already running — a live appeal quietly
     * repricing itself because someone tidied the catalogue is the exact
     * failure this column exists to prevent.
     */
    price: money('price').notNull(),
    currency: currency(),

    /** NULL = open-ended, no progress bar shown. */
    targetQuantity: integer('target_quantity'),
    /**
     * Units actually delivered, from VERIFIED payments only (decision A6).
     *
     * Never incremented on a pending, failed, cancelled or timed-out payment.
     * Phase 6 increments it inside the same transaction that marks a payment
     * captured, under `SELECT … FOR UPDATE` on this row.
     */
    providedQuantity: integer('provided_quantity').notNull().default(0),
    maxPerDonation: integer('max_per_donation').notNull().default(999),

    sortOrder: integer('sort_order').notNull().default(100),
    status: campaignProductStatusEnum('status').notNull().default('active'),
    /**
     * Switched on in THIS campaign. Independent of every other campaign
     * offering the same product, and independent of the product's own status.
     */
    isActive: boolean('is_active').notNull().default(true),
    sku: varchar('sku', { length: 64 }),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    /**
     * A product appears at most ONCE in a campaign.
     *
     * Enforced here rather than in the service, because "add this product"
     * arriving twice — a double-clicked button, a retried request — must not
     * be able to produce two rows with two prices and two progress bars for
     * one thing.
     */
    uniqueIndex('campaign_products_campaign_product_unique').on(table.campaignId, table.productId),
    index('campaign_products_campaign_idx').on(table.campaignId, table.sortOrder),
    index('campaign_products_active_idx').on(table.campaignId, table.isActive),
    index('campaign_products_product_idx').on(table.productId),

    check('campaign_products_price_positive', sql`price > 0`),
    check('campaign_products_provided_non_negative', sql`provided_quantity >= 0`),
    check(
      'campaign_products_target_non_negative',
      sql`target_quantity IS NULL OR target_quantity >= 0`,
    ),
    check('campaign_products_max_per_donation_positive', sql`max_per_donation > 0`),
  ],
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignProduct = typeof campaignProducts.$inferSelect;
export type NewCampaignProduct = typeof campaignProducts.$inferInsert;
