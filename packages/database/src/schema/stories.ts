import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
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
import { campaigns } from './campaigns.js';
import { programs } from './programs.js';
import { users } from './users.js';

/**
 * Success stories, in the five-part structure Phase 0 specifies.
 *
 * CONSENT IS A PUBLISHING PRECONDITION, enforced by a CHECK constraint:
 * a story naming an identifiable person cannot reach `published` without
 * `consentObtained`. Publishing a beneficiary's name, photograph and
 * circumstances without recorded consent is the most serious ethical and
 * reputational risk in this product, and it is cheap to prevent in the schema
 * rather than relying on an editor remembering.
 */
export const successStories = pgTable(
  'success_stories',
  {
    id: primaryId(),
    title: varchar('title', { length: 240 }).notNull(),
    slug: varchar('slug', { length: 240 }).notNull(),
    excerpt: text('excerpt'),
    content: text('content'),
    coverImage: text('cover_image'),
    /** [{ url, alt, caption }] */
    gallery: jsonb('gallery'),
    category: varchar('category', { length: 80 }),

    subjectName: varchar('subject_name', { length: 160 }),
    location: varchar('location', { length: 160 }),

    /** The five sections. */
    challenge: text('challenge'),
    intervention: text('intervention'),
    journey: text('journey'),
    outcome: text('outcome'),
    impact: text('impact'),

    programId: uuid('program_id').references(() => programs.id, { onDelete: 'set null' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),

    consentObtained: boolean('consent_obtained').notNull().default(false),
    consentDocumentId: uuid('consent_document_id'),
    isAnonymised: boolean('is_anonymised').notNull().default(false),

    status: publishStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),

    metaTitle: varchar('meta_title', { length: 240 }),
    metaDescription: varchar('meta_description', { length: 400 }),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('success_stories_slug_unique').on(table.slug),
    index('success_stories_status_idx').on(table.status, table.publishedAt),
    index('success_stories_program_idx').on(table.programId),
    index('success_stories_campaign_idx').on(table.campaignId),

    // The ethical guard, at the database level.
    check(
      'success_stories_consent_before_publish',
      sql`status <> 'published' OR subject_name IS NULL OR is_anonymised = true OR consent_obtained = true`,
    ),
  ],
);

export type SuccessStory = typeof successStories.$inferSelect;
export type NewSuccessStory = typeof successStories.$inferInsert;
