import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { users } from './users.js';

/**
 * Inbound communication from the public site (Phase 13, migration 0023).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * CONTACT MESSAGES are stored first and emailed second. The email to the
 * organisation can fail (no provider configured, provider down past its
 * retries); the row cannot, so a message is never lost — it waits in
 * Admin → Messages until somebody marks it handled.
 *
 * NEWSLETTER SUBSCRIBERS are double opt-in. A row starts `pending`; only a
 * click on the link sent to that address makes it `subscribed`, so nobody can
 * subscribe someone else. Tokens are SHA-256 hashes, never the token itself.
 * Nothing in the application sends a newsletter: this table records consent.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const CONTACT_MESSAGE_STATUSES = ['new', 'handled', 'archived'] as const;
export const CONTACT_SUBJECTS = [
  'general',
  'donation',
  'volunteering',
  'partnership',
  'documents',
  'media',
] as const;
export const NEWSLETTER_STATUSES = ['pending', 'subscribed', 'unsubscribed'] as const;

export const contactMessages = pgTable(
  'contact_messages',
  {
    id: primaryId(),
    name: varchar('name', { length: 120 }).notNull(),
    /** Normalised by the API (`normaliseEmail`). */
    email: varchar('email', { length: 254 }).notNull(),
    subject: varchar('subject', { length: 32 })
      .$type<(typeof CONTACT_SUBJECTS)[number]>()
      .notNull(),
    message: text('message').notNull(),
    status: varchar('status', { length: 16 })
      .$type<(typeof CONTACT_MESSAGE_STATUSES)[number]>()
      .notNull()
      .default('new'),
    ipAddress: varchar('ip_address', { length: 45 }),
    handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('contact_messages_status_created_idx').on(table.status, table.createdAt.desc()),
    index('contact_messages_email_idx').on(table.email),
    check('contact_messages_status_check', sql`status IN ('new', 'handled', 'archived')`),
    check(
      'contact_messages_subject_check',
      sql`subject IN ('general', 'donation', 'volunteering', 'partnership', 'documents', 'media')`,
    ),
    check('contact_messages_message_length', sql`char_length(message) BETWEEN 1 AND 5000`),
  ],
);

export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: primaryId(),
    email: varchar('email', { length: 254 }).notNull(),
    status: varchar('status', { length: 16 })
      .$type<(typeof NEWSLETTER_STATUSES)[number]>()
      .notNull()
      .default('pending'),
    confirmTokenHash: varchar('confirm_token_hash', { length: 64 }),
    confirmExpiresAt: timestamp('confirm_expires_at', { withTimezone: true }),
    unsubscribeTokenHash: varchar('unsubscribe_token_hash', { length: 64 }),
    confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    source: varchar('source', { length: 40 }),
    consentIp: varchar('consent_ip', { length: 45 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('newsletter_subscribers_email_unique').on(sql`lower(btrim(${table.email}))`),
    uniqueIndex('newsletter_subscribers_confirm_token_unique').on(table.confirmTokenHash),
    uniqueIndex('newsletter_subscribers_unsubscribe_token_unique').on(table.unsubscribeTokenHash),
    index('newsletter_subscribers_status_idx').on(table.status),
    check(
      'newsletter_subscribers_status_check',
      sql`status IN ('pending', 'subscribed', 'unsubscribed')`,
    ),
    check(
      'newsletter_subscribers_confirmed_has_time',
      sql`status <> 'subscribed' OR confirmed_at IS NOT NULL`,
    ),
  ],
);

export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
