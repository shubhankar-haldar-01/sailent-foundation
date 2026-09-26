import { boolean, index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';

/**
 * Organisation settings and feature gates (docs/database-architecture.md §12).
 *
 * This is the ONLY business table implemented in Phase 1, and it is here because
 * the configuration layer already depends on it: it holds `fcra_enabled`, the
 * documented gate that keeps foreign contributions blocked until registration
 * exists. Every other entity in the Phase 0 domain model lands in its own phase.
 */
export const settings = pgTable(
  'settings',
  {
    id: primaryId(),
    key: varchar('key', { length: 128 }).notNull().unique(),
    value: jsonb('value').notNull(),
    category: varchar('category', { length: 64 }).notNull().default('general'),
    description: text('description'),
    /** Whether this setting may be exposed on a public endpoint. */
    isPublic: boolean('is_public').notNull().default(false),
    updatedBy: uuid('updated_by'),
    ...timestamps,
  },
  (table) => [index('settings_category_idx').on(table.category)],
);

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
