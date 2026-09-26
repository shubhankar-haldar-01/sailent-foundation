import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { auditActorTypeEnum, auditSeverityEnum } from './enums.js';

/**
 * Audit log (decision A10).
 *
 * APPEND-ONLY. There is no update path and no delete path in application code,
 * and the application's database role is granted INSERT and SELECT on this
 * table and nothing else. When a donor disputes a charge, or a trustee asks who
 * published a campaign claiming a particular figure, there is an answer.
 *
 * `oldValues` / `newValues` store the DIFF rather than just an action name, so
 * "who changed this product's price and to what" is answerable without
 * event-sourcing the whole system.
 *
 * NEVER written here: passwords, tokens, OTP codes, full PANs, card data. A
 * shared redaction serialiser enforces that rather than per-call-site
 * discipline — an audit log is a second copy of your database with weaker
 * access control.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: primaryId(),

    actorType: auditActorTypeEnum('actor_type').notNull().default('user'),
    userId: uuid('user_id'),
    /** Snapshot, so the log stays readable after an account is deleted. */
    actorEmailSnapshot: varchar('actor_email_snapshot', { length: 255 }),

    action: varchar('action', { length: 96 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id'),

    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    reason: text('reason'),

    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 64 }),
    severity: auditSeverityEnum('severity').notNull().default('info'),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId, table.createdAt),
    index('audit_logs_actor_idx').on(table.userId, table.createdAt),
    index('audit_logs_action_idx').on(table.action, table.createdAt),
    index('audit_logs_critical_idx')
      .on(table.createdAt)
      .where(sql`severity = 'critical'`),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
