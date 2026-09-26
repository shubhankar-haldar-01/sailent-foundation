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

import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { currency, money, primaryId, timestamps } from './_shared.js';
import { donationStatusEnum, donationTypeEnum } from './enums.js';
import { campaignProducts, campaigns } from './campaigns.js';
import { products } from './products.js';
import { donors } from './donors.js';
import { receipts } from './receipts.js';
import { programs } from './programs.js';

/**
 * Donations — the financial core. NOTHING here is ever hard-deleted.
 *
 * Header + line items (decision A5). A hybrid gift is ONE donation with several
 * lines, so the donor gets one receipt for one payment and the donor count is
 * not inflated.
 *
 * `status` is NEVER set to successful by a client request. It moves forward
 * only via a signature-verified webhook or reconciliation (decision A3).
 */
export const donations = pgTable(
  'donations',
  {
    id: primaryId(),
    /** Human-usable in URLs and support calls. Never the uuid. */
    reference: varchar('reference', { length: 24 }).notNull(),

    donorId: uuid('donor_id').references(() => donors.id, { onDelete: 'restrict' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'restrict' }),
    programId: uuid('program_id').references(() => programs.id, { onDelete: 'restrict' }),

    donationType: donationTypeEnum('donation_type').notNull().default('custom'),
    /** Server-computed from the line items. NEVER accepted from a client. */
    amount: money('amount').notNull(),
    currency: currency(),

    status: donationStatusEnum('status').notNull().default('pending'),

    provider: varchar('provider', { length: 32 }),
    providerTransactionId: varchar('provider_transaction_id', { length: 128 }),

    /** Public display only. Finance can always identify the donor. */
    anonymous: boolean('anonymous').notNull().default(false),
    donorMessage: text('donor_message'),
    /** { inHonourOf } / { inMemoryOf } */
    dedication: jsonb('dedication'),

    /** Denormalised for the Form 10BD readiness view. */
    taxIdCaptured: boolean('tax_id_captured').notNull().default(false),
    /** The issued receipt. One per captured donation, allocated in the capture transaction. */
    receiptId: uuid('receipt_id').references((): AnyPgColumn => receipts.id, {
      onDelete: 'restrict',
    }),

    /** FCRA guard — identifies a foreign contribution received in error. */
    ipCountry: varchar('ip_country', { length: 2 }),
    source: varchar('source', { length: 64 }),
    utmSource: varchar('utm_source', { length: 120 }),
    utmMedium: varchar('utm_medium', { length: 120 }),
    utmCampaign: varchar('utm_campaign', { length: 120 }),

    donationDate: timestamp('donation_date', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedReason: text('failed_reason'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('donations_reference_unique').on(table.reference),
    index('donations_donor_idx').on(table.donorId),
    index('donations_campaign_status_idx').on(table.campaignId, table.status),
    index('donations_status_created_idx').on(table.status, table.createdAt),
    index('donations_completed_idx').on(table.completedAt),
    // Drives the reconciliation sweep for donations stuck in flight.
    index('donations_pending_idx')
      .on(table.createdAt)
      .where(sql`status IN ('pending', 'processing')`),

    check('donations_amount_positive', sql`amount > 0`),
  ],
);

/**
 * Donation line items.
 *
 * `unitPrice` and `itemName` are SNAPSHOTS taken at donation time (decision A5).
 * They are not references to the current product. When a School Kit rises from
 * ₹900 to ₹950 next quarter, every historical receipt still reads ₹900 — which
 * is non-negotiable for a financial record.
 */
export const donationItems = pgTable(
  'donation_items',
  {
    id: primaryId(),
    donationId: uuid('donation_id')
      .notNull()
      .references(() => donations.id, { onDelete: 'restrict' }),
    campaignProductId: uuid('campaign_product_id').references(() => campaignProducts.id, {
      onDelete: 'restrict',
    }),
    /**
     * The catalogue product, kept alongside the campaign offering.
     *
     * Both, deliberately. `campaign_product_id` says which offering was taken;
     * `product_id` survives that offering being removed from the campaign and
     * is what answers "how many School Kits have we ever been given, across
     * every appeal" without walking a deleted junction row.
     */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }),

    /** `product` or `custom`. A custom line has no product reference. */
    itemType: varchar('item_type', { length: 16 }).notNull().default('product'),
    /**
     * SNAPSHOT of the name as the donor saw it.
     *
     * Not a join. A receipt issued in March must still read what it read in
     * March, whatever the catalogue has been renamed to since. The same
     * applies to `unit_price` below: these columns are the historical record,
     * and nothing in the catalogue may rewrite them.
     */
    itemName: varchar('item_name', { length: 160 }).notNull(),

    quantity: integer('quantity').notNull(),
    unitPrice: money('unit_price').notNull(),
    totalPrice: money('total_price').notNull(),

    fulfilledQuantity: integer('fulfilled_quantity').notNull().default(0),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('donation_items_donation_idx').on(table.donationId),
    index('donation_items_campaign_product_idx').on(table.campaignProductId),
    index('donation_items_product_idx').on(table.productId),

    check('donation_items_quantity_positive', sql`quantity > 0`),
    check('donation_items_unit_price_positive', sql`unit_price > 0`),
    // Arithmetic cannot drift: the line total IS the product of its parts.
    check('donation_items_total_matches', sql`total_price = quantity * unit_price`),
    // A product line references a product; a custom line must not. Both
    // references move together — a line cannot cite one and not the other.
    check(
      'donation_items_type_consistent',
      sql`(item_type = 'product' AND campaign_product_id IS NOT NULL AND product_id IS NOT NULL) OR (item_type = 'custom' AND campaign_product_id IS NULL AND product_id IS NULL)`,
    ),
  ],
);

export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;
export type DonationItem = typeof donationItems.$inferSelect;
export type NewDonationItem = typeof donationItems.$inferInsert;
