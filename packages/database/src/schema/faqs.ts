import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { faqContextEnum } from './enums.js';

/**
 * FAQs, general and record-specific (docs/database-architecture.md).
 *
 * One table rather than `campaign_faqs` + `event_faqs` + a site-wide list. The
 * shape is identical in every case — question, answer, order, published — and
 * three tables would mean three sets of CRUD endpoints doing the same thing.
 *
 * `context_type` says what kind of thing it hangs off; `context_id` says which
 * one. A general FAQ has a null context_id, and the CHECK below is what stops
 * the two drifting apart.
 */
export const faqs = pgTable(
  'faqs',
  {
    id: primaryId(),
    question: varchar('question', { length: 300 }).notNull(),
    answer: text('answer').notNull(),
    /** Grouping within a listing — "Donations", "Volunteering". Free text. */
    category: varchar('category', { length: 80 }),

    contextType: faqContextEnum('context_type').notNull().default('general'),
    /** The campaign, event or programme this belongs to. Null for general. */
    contextId: uuid('context_id'),

    displayOrder: integer('display_order').notNull().default(100),
    isPublished: boolean('is_published').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index('faqs_context_idx').on(table.contextType, table.contextId, table.displayOrder),
    index('faqs_published_idx').on(table.isPublished),
    /**
     * A general FAQ has no owner; every other kind must have one.
     *
     * Without this, a campaign FAQ with a null context_id is invisible — it
     * belongs to no campaign and does not appear in the general list either.
     * It is the sort of row that is only discovered when someone asks why the
     * question they wrote is nowhere on the site.
     */
    check(
      'faqs_context_consistent',
      sql`(context_type = 'general' AND context_id IS NULL) OR (context_type <> 'general' AND context_id IS NOT NULL)`,
    ),
  ],
);

export type Faq = typeof faqs.$inferSelect;
export type NewFaq = typeof faqs.$inferInsert;
