import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm';

import { otpCodes, sessions, users, type DatabaseClient } from '@sailent/database';
import { normaliseEmail } from '@sailent/validation';

import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.module.js';
import { QUEUE_NAMES, QueueService, jobKey } from '../queue/queue.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import { PasswordService } from './password.service.js';

export const STAFF_INVITE_PURPOSE = 'staff_invite';
export const STAFF_RESET_PURPOSE = 'staff_password_reset';
/** An invitation stays usable for a week. */
export const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A reset link works for an hour. */
export const STAFF_RESET_TTL_MS = 60 * 60 * 1000;
/** At most this many reset emails per account per hour. */
export const STAFF_RESET_PER_HOUR = 3;

interface Context {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** A 16-character handle for an address with no account — never the address. */
function emailHandle(email: string): string {
  return createHash('sha256').update(normaliseEmail(email)).digest('hex').slice(0, 16);
}

const LINK_INVALID = 'This link has expired or has already been used.';

/**
 * Staff invitations and password reset (Phase 13).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE TOKEN DESIGN FOR BOTH.
 *
 *   - 32 random bytes (base64url) in the link, after `#`, so it never reaches
 *     a server log or a Referer header. Only its SHA-256 is stored, in
 *     `otp_codes` (purpose `staff_invite` / `staff_password_reset`,
 *     identifier `staff:<user id>`) — the table built for exactly this.
 *   - Single use: the token is claimed with `UPDATE … WHERE consumed_at IS
 *     NULL AND expires_at > now() RETURNING`, so two simultaneous uses cannot
 *     both succeed, and an expired or used token never works.
 *   - Issuing a new token burns every older one for that account and purpose.
 *
 * INVITATION: the account already exists (`invited`, unusable password, role
 * chosen by the inviting SUPER_ADMIN — the invitee chooses nothing but their
 * password). Accepting sets the password and makes the account `active`.
 *
 * RESET: the request answers identically whether or not the address belongs
 * to an active account, and sends at most three emails an hour per account.
 * Completing it sets the password, clears any lockout and REVOKES EVERY
 * SESSION, so whoever knew the old password is signed out.
 *
 * No TOTP or second factor anywhere (owner decision, Phase 12).
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class StaffAccountService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly passwords: PasswordService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  /** Issue (or re-issue) an invitation for an `invited` account and email it. */
  async sendInvitation(userId: string, actorId: string, context: Context): Promise<void> {
    const [user] = await this.database.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('Account');
    if (user.status !== 'invited') {
      throw new ConflictException('This account has already accepted its invitation.');
    }

    const token = await this.issueToken(userId, STAFF_INVITE_PURPOSE, STAFF_INVITE_TTL_MS, context);
    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'staff.invite',
      { userId, token },
      {
        jobId: jobKey('staff-invite', userId, String(Date.now())),
        removeOnComplete: true,
        removeOnFail: { age: 3600 },
      },
    );

    await this.audit.record({
      action: 'auth.staff.invitation_sent',
      entityType: 'user',
      entityId: userId,
      userId: actorId,
      newValues: { expiresInDays: STAFF_INVITE_TTL_MS / 86_400_000 },
      severity: 'warning',
      ...context,
    });
  }

  /** Set the first password from an invitation link. */
  async acceptInvitation(token: string, password: string, context: Context) {
    const claimed = await this.claimToken(token, STAFF_INVITE_PURPOSE);
    if (!claimed) {
      await this.audit.record({
        action: 'auth.staff.invitation_failed',
        entityType: 'user',
        newValues: { reason: 'invalid_or_expired' },
        ...context,
      });
      throw new ValidationException(
        [{ code: 'link_invalid', message: LINK_INVALID }],
        LINK_INVALID,
      );
    }

    const passwordHash = await this.passwords.hash(password);
    const now = new Date();
    const [updated] = await this.database.db
      .update(users)
      .set({
        passwordHash,
        status: 'active',
        mustChangePassword: false,
        emailVerifiedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      // Only an account still waiting on its invitation. A suspended account
      // is not reactivated by an old invitation link.
      .where(and(eq(users.id, claimed.userId), eq(users.status, 'invited')))
      .returning({ id: users.id, email: users.email });

    if (!updated) {
      throw new ValidationException(
        [{ code: 'link_invalid', message: LINK_INVALID }],
        LINK_INVALID,
      );
    }

    await this.audit.record({
      action: 'auth.staff.invitation_accepted',
      entityType: 'user',
      entityId: updated.id,
      userId: updated.id,
      severity: 'warning',
      ...context,
    });
    return { email: updated.email };
  }

  /** Always resolves the same way; see the class comment. */
  async requestPasswordReset(email: string, context: Context): Promise<void> {
    const address = normaliseEmail(email);
    const [user] = await this.database.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(sql`lower(btrim(${users.email})) = ${address}`)
      .limit(1);

    if (!user || user.status !== 'active') {
      await this.audit.record({
        action: 'auth.staff.password_reset_requested',
        entityType: 'user',
        entityId: user?.id,
        newValues: {
          delivered: false,
          reason: user ? 'not_active' : 'unknown_account',
          ...(user ? {} : { emailHandle: emailHandle(address) }),
        },
        ...context,
      });
      return;
    }

    const [recent] = await this.database.db
      .select({ value: count() })
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.identifier, `staff:${user.id}`),
          eq(otpCodes.purpose, STAFF_RESET_PURPOSE),
          gt(otpCodes.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
        ),
      );
    if ((recent?.value ?? 0) >= STAFF_RESET_PER_HOUR) {
      await this.audit.record({
        action: 'auth.staff.password_reset_requested',
        entityType: 'user',
        entityId: user.id,
        newValues: { delivered: false, reason: 'rate_limited' },
        severity: 'warning',
        ...context,
      });
      return;
    }

    const token = await this.issueToken(user.id, STAFF_RESET_PURPOSE, STAFF_RESET_TTL_MS, context);
    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'staff.password_reset',
      { userId: user.id, token },
      {
        jobId: jobKey('staff-reset', user.id, String(Date.now())),
        removeOnComplete: true,
        removeOnFail: { age: 3600 },
      },
    );
    await this.audit.record({
      action: 'auth.staff.password_reset_requested',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      newValues: { delivered: true },
      ...context,
    });
  }

  /** Set a new password from a reset link, and sign every session out. */
  async resetPassword(token: string, password: string, context: Context) {
    const claimed = await this.claimToken(token, STAFF_RESET_PURPOSE);
    if (!claimed) {
      await this.audit.record({
        action: 'auth.staff.password_reset_failed',
        entityType: 'user',
        newValues: { reason: 'invalid_or_expired' },
        ...context,
      });
      throw new ValidationException(
        [{ code: 'link_invalid', message: LINK_INVALID }],
        LINK_INVALID,
      );
    }

    const passwordHash = await this.passwords.hash(password);
    const now = new Date();
    const updated = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: false,
          failedLoginCount: 0,
          lockedUntil: null,
          updatedAt: now,
        })
        // A suspended account stays suspended, whatever links it holds.
        .where(and(eq(users.id, claimed.userId), eq(users.status, 'active')))
        .returning({ id: users.id });
      if (!row) return null;

      await tx
        .update(sessions)
        .set({ revokedAt: now, revokedReason: 'password_reset' })
        .where(and(eq(sessions.userId, row.id), isNull(sessions.revokedAt)));
      return row;
    });

    if (!updated) {
      throw new ValidationException(
        [{ code: 'link_invalid', message: LINK_INVALID }],
        LINK_INVALID,
      );
    }

    await this.audit.record({
      action: 'auth.staff.password_reset_completed',
      entityType: 'user',
      entityId: updated.id,
      userId: updated.id,
      newValues: { sessionsRevoked: true },
      severity: 'warning',
      ...context,
    });
    return { reset: true as const };
  }

  // ── tokens ───────────────────────────────────────────────────────────────

  /** Burn older tokens for this account and purpose, and store a new one. */
  private async issueToken(
    userId: string,
    purpose: string,
    ttlMs: number,
    context: Context,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(otpCodes)
        .set({ consumedAt: now })
        .where(
          and(
            eq(otpCodes.identifier, `staff:${userId}`),
            eq(otpCodes.purpose, purpose),
            isNull(otpCodes.consumedAt),
          ),
        );
      await tx.insert(otpCodes).values({
        identifier: `staff:${userId}`,
        purpose,
        codeHash: hashToken(token),
        expiresAt: new Date(now.getTime() + ttlMs),
        ipAddress: context.ipAddress ?? null,
      });
    });
    return token;
  }

  /** Claim a live token atomically. Null if unknown, used, expired or for another purpose. */
  private async claimToken(token: string, purpose: string): Promise<{ userId: string } | null> {
    const [row] = await this.database.db
      .update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(otpCodes.codeHash, hashToken(token)),
          eq(otpCodes.purpose, purpose),
          isNull(otpCodes.consumedAt),
          gt(otpCodes.expiresAt, new Date()),
        ),
      )
      .returning({ identifier: otpCodes.identifier });
    if (!row || !row.identifier.startsWith('staff:')) return null;
    return { userId: row.identifier.slice('staff:'.length) };
  }
}
