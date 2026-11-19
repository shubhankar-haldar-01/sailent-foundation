import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { primaryId } from './_shared.js';

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
