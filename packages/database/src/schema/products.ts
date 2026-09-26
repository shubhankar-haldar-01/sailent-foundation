import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { currency, money, primaryId, softDelete, timestamps } from './_shared.js';
import { productStatusEnum } from './enums.js';

/**
 * The product catalogue (Phase 5).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A PRODUCT IS INDEPENDENT OF ANY CAMPAIGN.
 *
 * Phase 4 stored products inside `campaign_products`: a name, a description, a
 * price, all on a row that belonged to one campaign. Offering a School Kit in
 * three appeals meant three rows carrying three copies of the same sentence,
 * and correcting a typo meant finding all three. Whether they still said the
 * same thing was a matter of luck.
 *
 * So the description of WHAT A THING IS lives here, once, and
 * `campaign_products` carries only what differs between campaigns — the price
 * charged, the target, the ordering, whether it is switched on.
 *
 * `defaultPrice` is a STARTING POINT, not a source of truth for any donation.
 * Changing it does not touch a single campaign (see `campaign_products`), and
 * it has never been what a donor was charged: that is snapshotted onto the
 * donation line at the moment of giving.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const products = pgTable(
  'products',
  {
    id: primaryId(),

    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull(),
    /** What the donor is BUYING, concretely. Conversion depends on this. */
    description: text('description').notNull(),
    image: text('image'),

    /** Suggested price in paise. A campaign may charge something else. */
    defaultPrice: money('default_price').notNull(),
    currency: currency(),

    /** "kit", "meal", "day" — what one unit of this is called. */
    unit: varchar('unit', { length: 40 }).notNull().default('unit'),

    status: productStatusEnum('status').notNull().default('active'),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    // Global, not per-campaign: one School Kit in the catalogue, ever.
    uniqueIndex('products_slug_unique').on(table.slug),
    index('products_status_idx').on(table.status),

    check('products_default_price_positive', sql`default_price > 0`),
    check('products_name_not_blank', sql`length(btrim(name)) > 0`),
  ],
);
