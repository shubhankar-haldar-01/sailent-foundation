import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { money, primaryId, softDelete, timestamps } from './_shared.js';
import { publishStatusEnum } from './enums.js';
/** Long-term initiatives. Campaigns fund specific pieces of them. */
export const programs = pgTable(
  'programs',
  {
    id: primaryId(),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    tagline: varchar('tagline', { length: 255 }),
    shortDescription: text('short_description'),
    description: text('description'),
    coverImage: text('cover_image'),
    category: varchar('category', { length: 80 }),

    /** [{ title, description }] — shape varies per programme. */
    /**
     * The problem this programme exists to address, and what we actually do
     * about it. Two fields rather than one `description`, because a programme
     * page that cannot distinguish "here is what is wrong" from "here is our
     * response" reads as a brochure.
     */
    problem: text('problem'),
    approach: text('approach'),
    /** `[{ title, description }]` — the concrete activities under this programme. */
    activities: jsonb('activities').$type<{ title: string; description: string }[]>(),
    /**
     * `[{ label, value, unit? }]` — headline figures for the programme page.
     *
     * Decision A14: each of these must trace to a real, dated record. The
     * column exists so the CMS can attach them; a programme with none renders
     * no metrics band rather than an invented one.
     */
    metrics: jsonb('metrics').$type<{ label: string; value: number; unit?: string }[]>(),
    /** Chooses the programme's illustrative icon. Presentation only. */
    accentIcon: varchar('accent_icon', { length: 24 }),
    goals: jsonb('goals'),
    beneficiaries: text('beneficiaries'),
    /** [{ district, state }] */
    locations: jsonb('locations'),
    impactSummary: text('impact_summary'),

    status: publishStatusEnum('status').notNull().default('draft'),
    displayOrder: integer('display_order').notNull().default(100),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),

    /** Derived-cached rollups; recomputed by the nightly job (decision A6). */
    campaignCount: integer('campaign_count').notNull().default(0),
    totalRaised: money('total_raised').notNull().default(0),
    beneficiariesReached: integer('beneficiaries_reached').notNull().default(0),

    metaTitle: varchar('meta_title', { length: 200 }),
    metaDescription: varchar('meta_description', { length: 400 }),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('programs_slug_unique').on(table.slug),
    uniqueIndex('programs_title_unique')
      .on(sql`lower(btrim(${table.title}))`)
      .where(sql`deleted_at IS NULL`),
    index('programs_status_idx').on(table.status),
    index('programs_category_idx').on(table.category),
    index('programs_created_idx').on(table.createdAt),
    index('programs_display_order_idx').on(table.displayOrder),
  ],
);

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
