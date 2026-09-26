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

import { primaryId, timestamps } from './_shared.js';
import { notificationChannelEnum, notificationStatusEnum } from './enums.js';
import { users } from './users.js';

/**
 * Notification templates (Phase 10.11).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TEMPLATE IS THE THING THAT CAN BE CORRECTED WITHOUT REWRITING HISTORY.
 *
 * `notifications.data` has always held the template VARIABLES rather than a
 * rendered body, for exactly this reason. What was missing was the other half:
 * somewhere for the body itself to live, so that fixing a typo in a receipt
 * email is an edit rather than a deployment.
 *
 * `slug` is the stable identity — `donation.confirmation`, `volunteer.assigned`.
 * Processors look up by slug, and a missing or inactive row is not an error:
 * every processor keeps its built-in body and falls back to it. An email that
 * stops going out because somebody deactivated a template would be a worse
 * failure than an email with an old wording.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: primaryId(),
    /** Stable identity, matching `notifications.type`. */
    slug: varchar('slug', { length: 96 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),

    channel: notificationChannelEnum('channel').notNull().default('email'),

    subject: varchar('subject', { length: 320 }).notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text').notNull(),

    /**
     * The variables this template expects, as `{ name: description }`.
     *
     * A schema of expectations, not values — it is what the editor is shown
     * and what the preview fills in, so somebody writing `{{donorName}}` can
     * see whether that is a name the sender actually supplies.
     */
    variables: jsonb('variables')
      .notNull()
      .default(sql`'{}'::jsonb`),

    /** Brevo's own template id, when a send should use theirs instead. */
    brevoTemplateId: varchar('brevo_template_id', { length: 64 }),

    isActive: boolean('is_active').notNull().default(true),
    /** Incremented on every save; the matching snapshot is in the revisions table. */
    version: integer('version').notNull().default(1),

    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    // One template per slug. Two rows answering to `donation.confirmation`
    // would make which body a donor receives a matter of query ordering.
    uniqueIndex('notification_templates_slug_unique').on(table.slug),
    index('notification_templates_channel_idx').on(table.channel, table.isActive),
    check('notification_templates_version_positive', sql`version >= 1`),
  ],
);

/**
 * A snapshot per save, so "versioning" means history rather than a counter.
 *
 * The same shape as `page_revisions`, for the same reason: it answers "what did
 * the receipt say in March" and "who changed it", and it makes a revert a
 * matter of copying a row rather than of remembering.
 */
export const notificationTemplateRevisions = pgTable(
  'notification_template_revisions',
  {
    id: primaryId(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => notificationTemplates.id, { onDelete: 'cascade' }),

    version: integer('version').notNull(),
    subject: varchar('subject', { length: 320 }).notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text').notNull(),
    variables: jsonb('variables'),

    /** Why, when the editor said. Recorded on the audit row too. */
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_template_revisions_version_unique').on(
      table.templateId,
      table.version,
    ),
    index('notification_template_revisions_template_idx').on(table.templateId, table.createdAt),
  ],
);

/**
 * Notifications — the send log, and the in-app inbox.
 *
 * `data` holds the template variables rather than a rendered body, so a
 * template correction does not require rewriting history.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE TABLE FOR BOTH, AND THAT IS DELIBERATE.
 *
 * An `email` row with `status: 'failed'` is a send-log entry; an `in_app` row
 * addressed to a staff user is an admin notification. Splitting them would
 * mean two tables with the same columns and two places to look when asking
 * "did that go out" — and the in-app notification an administrator most needs
 * is precisely the one that says an email did not.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const notifications = pgTable(
  'notifications',
  {
    id: primaryId(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** user | donor | volunteer — the audience this was addressed to. */
    recipientType: varchar('recipient_type', { length: 16 }).notNull().default('user'),
    recipientId: uuid('recipient_id'),

    type: varchar('type', { length: 64 }).notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    message: text('message').notNull(),
    data: jsonb('data'),

    channel: notificationChannelEnum('channel').notNull().default('in_app'),
    status: notificationStatusEnum('status').notNull().default('pending'),

    /**
     * Which template rendered this, and which version of it (Phase 10.11).
     *
     * `ON DELETE SET NULL`: a template may be retired, and a log entry that
     * vanished with it would take the record of a real send with it. The
     * version is a plain integer rather than a reference for the same reason —
     * it stays true after the revision it names is gone.
     */
    templateId: uuid('template_id').references(() => notificationTemplates.id, {
      onDelete: 'set null',
    }),
    templateVersion: integer('template_version'),

    /** How many delivery attempts have been made. Visible to administrators. */
    retryCount: integer('retry_count').notNull().default(0),

    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    error: text('error'),
    providerMessageId: varchar('provider_message_id', { length: 128 }),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('notifications_recipient_idx').on(table.recipientType, table.recipientId, table.readAt),
    index('notifications_status_idx').on(table.status, table.createdAt),
    index('notifications_user_idx').on(table.userId),
    // The bell: unread in-app notifications for one staff user, newest first.
    index('notifications_inbox_idx').on(table.userId, table.channel, table.readAt),
    // The send log, filtered by what went wrong.
    index('notifications_channel_status_idx').on(table.channel, table.status, table.createdAt),
    check('notifications_retry_count_positive', sql`retry_count >= 0`),
  ],
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type NotificationTemplateRevision = typeof notificationTemplateRevisions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
