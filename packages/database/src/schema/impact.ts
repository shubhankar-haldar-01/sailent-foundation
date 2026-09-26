import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  uniqueIndex,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { publishStatusEnum } from './enums.js';
import { campaigns } from './campaigns.js';
import { events } from './events.js';
import { programs } from './programs.js';
import { users } from './users.js';

/**
 * Impact updates.
 *
 * Deliberately SEPARATE from campaign financial progress: how much was raised
 * and what it achieved are different claims with different evidence, and
 * conflating them is how impact reporting loses credibility.
 *
 * `impactDate` is NOT NULL because a claim without a date is not a claim
 * (decision A14). Every public figure traces to one of these or to a live
 * database aggregate.
 */
export const impactUpdates = pgTable(
  'impact_updates',
  {
    id: primaryId(),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    programId: uuid('program_id').references(() => programs.id, { onDelete: 'set null' }),
    /**
     * The activity that produced these figures, where there was one.
     *
     * A medical camp counts its own patients seen and medicines dispensed, and
     * those belong to the camp rather than to the campaign that paid for it.
     * `SET NULL` on delete: removing an event must never remove the record of
     * what it achieved.
     */
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),

    title: varchar('title', { length: 240 }).notNull(),
    /**
     * The update's own address, for `/impact/[slug]`.
     *
     * Added in Phase 9 with migration `0012`, which backfilled it from the
     * titles already on file. Unique, because it is a URL.
     */
    slug: varchar('slug', { length: 240 }).notNull(),
    description: text('description').notNull(),

    /**
     * The card image.
     *
     * A column rather than the first element of `images`, because `campaigns`,
     * `events` and `success_stories` all carry it this way — reaching into a
     * JSON array for the one picture every card needs would make this the only
     * entity that behaves differently.
     */
    coverImage: text('cover_image'),

    /** Arrays of media references; shapes differ, so jsonb. */
    images: jsonb('images'),
    videos: jsonb('videos'),
    documents: jsonb('documents'),

    location: varchar('location', { length: 160 }),
    state: varchar('state', { length: 120 }),

    /** A claim without a date is not a claim. */
    impactDate: date('impact_date').notNull(),

    /** [{ label, value, unit }] */
    statistics: jsonb('statistics'),
    /** Headline metric, denormalised so it can be indexed and aggregated. */
    metricType: varchar('metric_type', { length: 48 }),
    metricValue: integer('metric_value'),
    metricUnit: varchar('metric_unit', { length: 32 }),

    /** How this number was arrived at — the thing that makes it checkable. */
    verificationMethod: text('verification_method'),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),

    status: publishStatusEnum('status').notNull().default('draft'),
    isPublic: boolean('is_public').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    index('impact_updates_program_date_idx').on(table.programId, table.impactDate),
    index('impact_updates_campaign_date_idx').on(table.campaignId, table.impactDate),
    index('impact_updates_public_idx').on(table.isPublic, table.publishedAt),
    index('impact_updates_metric_idx').on(table.metricType),
    index('impact_updates_event_idx').on(table.eventId),
    uniqueIndex('impact_updates_slug_unique').on(table.slug),

    check('impact_updates_metric_non_negative', sql`metric_value IS NULL OR metric_value >= 0`),
    /**
     * An update must attach to something, or it is unattributable (A14).
     *
     * THREE parents, not two — widened by migration `0013`. A medical camp's
     * own figures belong to the camp, and forcing them onto the campaign that
     * funded it would misattribute them.
     */
    check(
      'impact_updates_has_parent',
      sql`campaign_id IS NOT NULL OR program_id IS NOT NULL OR event_id IS NOT NULL`,
    ),
  ],
);

export type ImpactUpdate = typeof impactUpdates.$inferSelect;
export type NewImpactUpdate = typeof impactUpdates.$inferInsert;
