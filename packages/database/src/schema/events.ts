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

import { money, primaryId, softDelete, timestamps } from './_shared.js';
import { eventRegistrationStatusEnum, publishStatusEnum } from './enums.js';
import { campaigns } from './campaigns.js';
import { programs } from './programs.js';
import { volunteers } from './volunteers.js';

export const events = pgTable(
  'events',
  {
    id: primaryId(),
    title: varchar('title', { length: 240 }).notNull(),
    slug: varchar('slug', { length: 240 }).notNull(),
    summary: text('summary'),
    description: text('description'),
    coverImage: text('cover_image'),

    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Kolkata'),

    venueName: varchar('venue_name', { length: 200 }),
    location: varchar('location', { length: 255 }),
    address: text('address'),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 120 }),
    isOnline: boolean('is_online').notNull().default(false),
    /** PRIVATE — released to registrants only, never on a public endpoint. */
    meetingUrl: text('meeting_url'),

    /** NULL = uncapped. */
    /** `[{ time, activity }]` — the running order, shown on the event page. */
    schedule: jsonb('schedule').$type<{ time: string; activity: string }[]>(),
    /** `[{ seed, alt, caption?, url? }]` — photographs from a past event. */
    gallery:
      jsonb('gallery').$type<{ seed: string; alt: string; caption?: string; url?: string }[]>(),
    capacity: integer('capacity'),
    registeredCount: integer('registered_count').notNull().default(0),
    waitlistCount: integer('waitlist_count').notNull().default(0),
    registrationStatus: eventRegistrationStatusEnum('registration_status')
      .notNull()
      .default('open'),
    /**
     * When registration shuts, independent of the event's own start.
     *
     * `registrationStatus` already says whether registration is open, closed or
     * full — so there is no separate "registration required" flag; `closed` IS
     * that flag. What it cannot express is a CUT-OFF: an event can be open today
     * and shut at midnight without anybody editing it.
     *
     * NULL means "until it starts".
     */
    registrationDeadline: timestamp('registration_deadline', { withTimezone: true }),

    /** Who is running it, when that is not simply the foundation. */
    organizer: varchar('organizer', { length: 200 }),

    status: publishStatusEnum('status').notNull().default('draft'),

    programId: uuid('program_id').references(() => programs.id, { onDelete: 'set null' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    requiresVolunteers: boolean('requires_volunteers').notNull().default(false),
    volunteerSlots: integer('volunteer_slots'),

    isPaid: boolean('is_paid').notNull().default(false),
    feeAmount: money('fee_amount'),
    /** List of sub-activities or functions (e.g. ['Dance', 'Singing', 'Running']). */
    functions: jsonb('functions').$type<string[]>().default([]),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('events_slug_unique').on(table.slug),
    index('events_status_start_idx').on(table.status, table.startDate),
    index('events_program_idx').on(table.programId),
    index('events_campaign_idx').on(table.campaignId),

    check('events_capacity_non_negative', sql`capacity IS NULL OR capacity >= 0`),
    check('events_fee_amount_non_negative', sql`fee_amount IS NULL OR fee_amount >= 0`),
    check('events_counts_non_negative', sql`registered_count >= 0 AND waitlist_count >= 0`),
    check('events_dates_ordered', sql`end_date IS NULL OR end_date >= start_date`),
  ],
);

/**
 * Registrations.
 *
 * Capacity is enforced under a row lock on `events` — two people registering
 * for the last seat simultaneously is the same race as two donors funding the
 * last kit, and is solved the same way (decision A6).
 */
export const eventRegistrations = pgTable(
  'event_registrations',
  {
    id: primaryId(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    donorId: uuid('donor_id'),
    volunteerId: uuid('volunteer_id').references(() => volunteers.id, { onDelete: 'set null' }),

    fullName: varchar('full_name', { length: 200 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    /** SENSITIVE. */
    phone: varchar('phone', { length: 20 }).notNull(),
    attendeeCount: integer('attendee_count').notNull().default(1),
    functionName: varchar('function_name', { length: 120 }),
    /** One entry per pass; `checkedInAt` is that person's admission at the gate. */
    attendees: jsonb('attendees')
      .$type<{ fullName: string; passNumber?: string; checkedInAt?: string | null }[]>()
      .default([]),

    /** registered | waitlisted | confirmed | attended | no_show | cancelled */
    status: varchar('status', { length: 16 }).notNull().default('registered'),
    isPaid: boolean('is_paid').notNull().default(false),
    paymentId: varchar('payment_id', { length: 128 }),
    orderId: varchar('order_id', { length: 128 }),
    paidAmount: money('paid_amount'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    attendedAt: timestamp('attended_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    ...timestamps,
  },
  (table) => [
    // One registration per person per event.
    uniqueIndex('event_registrations_unique').on(table.eventId, table.email),
    index('event_registrations_event_status_idx').on(table.eventId, table.status),
    // One payment pays for one booking (migration 0037).
    uniqueIndex('event_registrations_payment_id_unique')
      .on(table.paymentId)
      .where(sql`payment_id IS NOT NULL`),
    check('event_registrations_attendees_positive', sql`attendee_count > 0`),
    check(
      'event_registrations_attendee_count_max_four',
      sql`attendee_count >= 1 AND attendee_count <= 4`,
    ),
  ],
);

export type SailentEvent = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventRegistration = typeof eventRegistrations.$inferSelect;
