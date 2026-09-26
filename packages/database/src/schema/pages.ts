import {
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

import { primaryId, softDelete, timestamps } from './_shared.js';
import { publishStatusEnum } from './enums.js';
import { users } from './users.js';

/**
 * Section-composed pages — the homepage and marketing pages only.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A COMPOSER, NOT A PAGE BUILDER, AND THE DIFFERENCE IS ENFORCED.
 *
 * docs/database-architecture.md: "`sections` (jsonb — an ordered array of
 * `{ type, props }` where `type` must be one of the APPROVED section
 * components) … validated against a Zod schema in `packages/validation` at
 * write time. An unknown section type is rejected. This is what keeps a
 * composer from becoming an unconstrained page builder."
 *
 * So the jsonb is not free-form. Every element is checked against a registry
 * of section types that already exist as React components, and each type's
 * props have their own schema. An editor chooses WHICH approved sections a
 * page shows and IN WHAT ORDER; they cannot invent a section, inject markup,
 * or author arbitrary HTML.
 *
 * WHY THIS IS NOT A SECOND CMS. Campaigns, programmes, stories, events, blog
 * posts and FAQs remain structured typed content with their own tables and
 * their own editors. This table governs the ORDER OF SECTIONS on a handful of
 * marketing pages and nothing else — docs/product-requirements.md §4.17,
 * "section composer for the homepage and marketing pages only".
 * ══════════════════════════════════════════════════════════════════════════
 */
export const pages = pgTable(
  'pages',
  {
    id: primaryId(),
    /**
     * The route this composes, without a leading slash: `home`, `about`.
     *
     * Not a free URL. A page here does not CREATE a route — the routes already
     * exist and are rendered by the app; a row decides which approved sections
     * one of them shows. That is why there is no "create a page at any path"
     * flow, and why an unknown slug is simply a row nothing reads.
     */
    slug: varchar('slug', { length: 120 }).notNull(),
    title: varchar('title', { length: 240 }).notNull(),

    /** `[{ type, props }]`, ordered. Validated by `@sailent/validation`. */
    sections: jsonb('sections').notNull().default([]),

    status: publishStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /**
     * Publish at a time, without a scheduler.
     *
     * A page is public when it is `published` AND this is null or already
     * past. The gate is in SQL on every public read, so there is no cron job
     * to run, nothing to drift, and no window where the row says one thing and
     * the site shows another. docs/product-requirements.md §4.17 asks for
     * scheduling; it does not ask for a scheduler.
     */
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),

    metaTitle: varchar('meta_title', { length: 240 }),
    metaDescription: varchar('meta_description', { length: 400 }),

    /**
     * Incremented on every save, and carried onto the revision.
     *
     * Lets a revision be named ("version 7") rather than only dated, and gives
     * an optimistic-concurrency handle if two editors ever save at once.
     */
    version: integer('version').notNull().default(1),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('pages_slug_unique').on(table.slug),
    // The public read's exact access path.
    index('pages_status_scheduled_idx').on(table.status, table.scheduledAt),
  ],
);

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;

/**
 * A snapshot per save.
 *
 * docs/database-architecture.md: "Snapshot of `sections` and metadata per save,
 * with `created_by`. Enables revert and answers 'who changed the homepage'."
 *
 * Append-only in practice: nothing in the code updates or deletes a revision,
 * for the same reason the audit log is append-only. "Who changed the homepage,
 * and to what" is worth nothing if it can be rewritten afterwards.
 *
 * `cascade` on the page: a revision of a page that no longer exists is not
 * history, it is debris — and the page itself is soft-deleted, so a real
 * deletion is already a deliberate act.
 */
export const pageRevisions = pgTable(
  'page_revisions',
  {
    id: primaryId(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),

    /** The version this snapshot represents, copied from the page at save. */
    version: integer('version').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    sections: jsonb('sections').notNull(),
    metaTitle: varchar('meta_title', { length: 240 }),
    metaDescription: varchar('meta_description', { length: 400 }),

    /** Why, when the editor said. Recorded on the audit row too. */
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('page_revisions_page_version_unique').on(table.pageId, table.version),
    index('page_revisions_page_idx').on(table.pageId, table.createdAt),
  ],
);

export type PageRevision = typeof pageRevisions.$inferSelect;
export type NewPageRevision = typeof pageRevisions.$inferInsert;
