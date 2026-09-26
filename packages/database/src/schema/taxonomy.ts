import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { categoryKindEnum } from './enums.js';

/**
 * Categories — a LOOKUP TABLE, not an enum.
 *
 * docs/database-architecture.md §1: "Postgres native enums for closed sets
 * (statuses). Lookup tables for sets an operator may extend (categories,
 * departments)." A status is a closed set the code branches on; a category is
 * a list the organisation will want to add to without a deployment.
 *
 * `key` is the stable machine identifier that code and seeds refer to. `name`
 * is what an operator edits. Renaming "Child Welfare" to "Children" is then a
 * data change that breaks nothing, which is the whole point of the split.
 */
export const categories = pgTable(
  'categories',
  {
    id: primaryId(),
    /** Stable machine key: EDUCATION, CHILD_WELFARE. Never edited. */
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
    /** Matches the programme icon set. Presentation only. */
    icon: varchar('icon', { length: 32 }),
    kind: categoryKindEnum('kind').notNull().default('both'),
    displayOrder: integer('display_order').notNull().default(100),
    /**
     * Deactivated rather than deleted. A category in use by a published
     * campaign cannot be removed without rewriting history, so the lifecycle
     * is active → inactive, and an inactive category stops being offered on
     * new records while existing ones keep rendering.
     */
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('categories_key_unique').on(table.key),
    uniqueIndex('categories_slug_unique').on(table.slug),
    index('categories_kind_order_idx').on(table.kind, table.displayOrder),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

/**
 * Slug history, so a published URL never dies.
 *
 * docs/seo-strategy.md: "Slugs never change silently. A change 301-redirects
 * permanently from the old slug, and slug history is retained in the database."
 *
 * Every slug a record has ever had is kept here. The public route resolver
 * looks up a miss against this table and issues a permanent redirect, which is
 * what stops an edit to a campaign title from breaking every link, printed QR
 * code and search result pointing at it.
 *
 * UNIQUE on (entity_type, slug) is what makes it safe: a slug released by one
 * campaign cannot be claimed by another while the redirect still exists, so a
 * redirect can never point somewhere misleading.
 */
export const slugHistory = pgTable(
  'slug_history',
  {
    id: primaryId(),
    entityType: varchar('entity_type', { length: 32 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    slug: varchar('slug', { length: 240 }).notNull(),
    /** Who made the change, for the audit trail. */
    changedBy: uuid('changed_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex('slug_history_type_slug_unique').on(table.entityType, table.slug),
    index('slug_history_entity_idx').on(table.entityType, table.entityId),
  ],
);

export type SlugHistoryEntry = typeof slugHistory.$inferSelect;
export type NewSlugHistoryEntry = typeof slugHistory.$inferInsert;
