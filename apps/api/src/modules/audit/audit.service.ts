import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';

import { auditLogs, users, type DatabaseClient } from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { offsetFor, paginate, type PaginationQuery } from '../../common/dto/pagination.dto.js';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  actorType?: 'user' | 'donor' | 'volunteer' | 'system' | 'webhook';
  userId?: string;
  actorEmail?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Field names that must NEVER reach the audit log.
 *
 * An audit log is a second copy of your database with weaker access control and
 * a longer retention period. Redaction is enforced HERE, once, rather than
 * relying on every call site to remember — because the one call site that
 * forgets is the one that matters.
 */
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'totpsecret',
  'totp_secret',
  'backupcodes',
  'backup_codes',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'tokenhash',
  'token_hash',
  'codehash',
  'code_hash',
  'otp',
  'taxidnumber',
  'tax_id_number',
  'pan',
  'providersignature',
  'provider_signature',
  'cardnumber',
  'cvv',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  /**
   * Write an audit row.
   *
   * NEVER THROWS. An audit failure must not roll back the operation it was
   * recording — losing a log line is bad, losing a donation because logging it
   * failed is worse. Failures are reported loudly instead.
   */
  /**
   * The actor's email, AS IT WAS WHEN THEY ACTED.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * `actor_email_snapshot` has existed since Phase 3 and `record()` has always
   * accepted an `actorEmail`. No caller ever passed one, so the column was
   * empty in every row — an audit of the Phase 8 cleanup found 0 of 233
   * populated, and 73 of those 233 already pointed at user ids that no longer
   * resolve, because the users were deleted by test teardown.
   *
   * That is the failure this closes. `audit_logs` has NO foreign key to
   * `users` — deliberately, so the log cannot be cascaded away — which also
   * means nothing stops a `user_id` from becoming a dangling reference. With
   * the column empty, such a row records that somebody did something and
   * offers no way to say who.
   *
   * SNAPSHOT, NOT A JOIN. It is written once, at the moment of the action, and
   * never updated. If an administrator changes their address in 2028, rows
   * from 2026 still show the address that took the action — which is what an
   * audit log is for. A join to `users` would quietly rewrite history every
   * time somebody edited their profile.
   *
   * THE USER ID IS STILL STORED, unchanged. This is an addition, not a
   * replacement: the id is the durable link while the user exists, and the
   * snapshot is what survives when it does not.
   *
   * Historical rows are NOT backfilled. There is no honest source for what
   * those addresses were — the users are gone — and inventing them would make
   * the log say something nobody can stand behind.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * One indexed primary-key lookup, on a path that is already writing a row.
   * It returns null rather than throwing: an audit entry with no email is
   * worse than one with, and far better than none at all.
   */
  private async resolveActorEmail(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;

    try {
      const [user] = await this.database.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user?.email ?? null;
    } catch {
      return null;
    }
  }

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.database.db.insert(auditLogs).values({
        actorType: entry.actorType ?? 'user',
        userId: entry.userId ?? null,
        actorEmailSnapshot: entry.actorEmail ?? (await this.resolveActorEmail(entry.userId)),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        oldValues: entry.oldValues ? redact(entry.oldValues) : null,
        newValues: entry.newValues ? redact(entry.newValues) : null,
        reason: entry.reason ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: entry.requestId ?? null,
        severity: entry.severity ?? 'info',
      });
    } catch (error) {
      this.logger.error(
        { action: entry.action, entityType: entry.entityType, err: String(error) },
        'Failed to write audit entry',
      );
    }
  }

  /**
   * Read the audit log.
   *
   * READ-ONLY BY DESIGN. There is no update method and no delete method on this
   * service, and the application's database role holds only INSERT and SELECT on
   * the table (decision A10). An audit trail that can be edited is not one.
   */
  async list(query: PaginationQuery & { entityType?: string; entityId?: string; action?: string }) {
    const filters: SQL[] = [];
    if (query.entityType) filters.push(eq(auditLogs.entityType, query.entityType));
    if (query.entityId) filters.push(eq(auditLogs.entityId, query.entityId));
    if (query.action) filters.push(eq(auditLogs.action, query.action));

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [items, [count]] = await Promise.all([
      this.database.db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }
}

/** Recursively replace sensitive values with a marker, preserving shape. */
function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redact(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }

  return out;
}
