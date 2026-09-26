import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { money, primaryId, timestamps } from './_shared.js';
import { donorTypeEnum, taxIdTypeEnum } from './enums.js';
import { users } from './users.js';

/**
 * Donors.
 *
 * Created BY a donation, not by a signup (decision A8). A donor may exist
 * having never logged in; `userId` is set only if they later claim the account.
 *
 * Privacy classification (docs/database-architecture.md §2):
 *   PRIVATE   name, email
 *   SENSITIVE phone, address, taxIdNumber
 *
 * `taxIdNumber` is additionally encrypted at the application layer. Storage
 * encryption protects a stolen disk; application encryption protects a leaked
 * dump or an over-broad query. A PAN warrants both.
 */
export const donors = pgTable(
  'donors',
  {
    id: primaryId(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    /** Human-usable reference for support: DNR-2026-00001. */
    donorCode: varchar('donor_code', { length: 24 }).notNull(),

    firstName: varchar('first_name', { length: 120 }).notNull(),
    lastName: varchar('last_name', { length: 120 }),
    email: varchar('email', { length: 255 }),
    /** SENSITIVE. The deduplication key — one donor per phone number. */
    phone: varchar('phone', { length: 20 }).notNull(),

    donorType: donorTypeEnum('donor_type').notNull().default('individual'),

    /** SENSITIVE. Required for the annual Form 10BD statement (decision A7). */
    taxIdType: taxIdTypeEnum('tax_id_type'),
    taxIdNumber: text('tax_id_number'),

    addressLine1: varchar('address_line1', { length: 255 }),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 120 }),
    postalCode: varchar('postal_code', { length: 16 }),
    country: varchar('country', { length: 2 }).notNull().default('IN'),

    /**
     * Derived-cached, maintained inside the payment-capture transaction
     * (decision A6). Never written from a request handler.
     */
    totalDonated: money('total_donated').notNull().default(0),
    donationCount: integer('donation_count').notNull().default(0),
    firstDonatedAt: timestamp('first_donated_at', { withTimezone: true }),
    lastDonatedAt: timestamp('last_donated_at', { withTimezone: true }),

    /** Public display only — Finance can always identify a donor. */
    isAnonymous: boolean('is_anonymous').notNull().default(false),

    /**
     * HOW to reach this donor. Consent first, then the channels it covers.
     */
    communicationConsent: boolean('communication_consent').notNull().default(false),
    emailOptIn: boolean('email_opt_in').notNull().default(false),
    smsOptIn: boolean('sms_opt_in').notNull().default(false),
    whatsappOptIn: boolean('whatsapp_opt_in').notNull().default(false),

    /**
     * WHAT this donor hears about. Independent of the channel columns above: a
     * donor may want email, but only about the campaigns they actually funded.
     * Both sets must agree before anything is sent.
     *
     * The first two default ON because they are news about work the donor paid
     * for, which is the thing they asked for by giving. The newsletter defaults
     * OFF because it is marketing, and marketing is opted into, not out of.
     *
     * TRANSACTIONAL MAIL IS DELIBERATELY ABSENT. A receipt is not a preference.
     * A donor cannot switch off the record of their own gift, so there is no
     * column here that would let them try.
     */
    notifyCampaignUpdates: boolean('notify_campaign_updates').notNull().default(true),
    notifyImpactUpdates: boolean('notify_impact_updates').notNull().default(true),
    notifyNewsletter: boolean('notify_newsletter').notNull().default(false),

    /** ADMIN-ONLY. Never returned to the donor. */
    internalNotes: text('internal_notes'),
    source: varchar('source', { length: 64 }),

    ...timestamps,
  },
  (table) => [
    /**
     * EMAIL IS WHAT IDENTIFIES A DONOR, because email is what they sign in with.
     *
     * This was `phone`, and the reasoning was sound for a platform nobody logs
     * into: an email is shared within a household far more often than a mobile
     * number, so phone kept a husband's and a wife's giving history apart.
     *
     * Signing in by email needs the opposite guarantee. For "type your email,
     * get a code" to be unambiguous, an address must resolve to exactly one
     * donor — otherwise the code is a coin toss between two people's records.
     *
     * The cost, stated rather than hidden: two people sharing one address now
     * share one donor record. That is the bargain every platform that logs you
     * in by email has already made.
     *
     * Declared here for documentation only — Drizzle cannot express a
     * functional index, so `lower(btrim(email))` is created in migration
     * `0011`. THE MIGRATION IS THE SOURCE OF TRUTH for this one.
     */
    index('donors_email_idx').on(table.email),
    /** Contact detail now, not identity. Staff still search by it. */
    index('donors_phone_idx').on(table.phone),
    uniqueIndex('donors_code_unique').on(table.donorCode),
    index('donors_user_idx').on(table.userId),
    index('donors_last_donated_idx').on(table.lastDonatedAt),
    index('donors_created_idx').on(table.createdAt),
    /**
     * Partial index driving the "donations missing a tax ID before 31 May"
     * compliance view. Indexing only the rows that need chasing keeps it small.
     */
    index('donors_missing_tax_id_idx')
      .on(table.id)
      .where(sql`tax_id_number IS NULL`),
    // A tax ID number without its type cannot appear on a Form 10BD export.
    check('donors_tax_id_type_required', sql`tax_id_number IS NULL OR tax_id_type IS NOT NULL`),
    check('donors_total_donated_non_negative', sql`total_donated >= 0`),
  ],
);

export type Donor = typeof donors.$inferSelect;
export type NewDonor = typeof donors.$inferInsert;
