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

import { primaryId, timestamps } from './_shared.js';
import { tokenAudienceEnum, userStatusEnum } from './enums.js';

/**
 * Staff accounts — people who operate the platform.
 *
 * NOT donors. A donor is created by a donation and may never log in; a user is
 * someone who administers the organisation (decision A8). Keeping them apart is
 * what lets donor sessions and staff sessions be non-interchangeable.
 */
export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: varchar('email', { length: 255 }).notNull(),
    /** Argon2id. SENSITIVE — never serialised by any endpoint. */
    passwordHash: text('password_hash'),
    firstName: varchar('first_name', { length: 120 }).notNull(),
    lastName: varchar('last_name', { length: 120 }),
    phone: varchar('phone', { length: 20 }),
    avatarUrl: text('avatar_url'),
    status: userStatusEnum('status').notNull().default('invited'),

    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    /**
     * TOTP. Mandatory for Super Admin, Admin and Finance Manager (decision A8);
     * the requirement is enforced in the auth service, not here, because it
     * depends on the roles a user holds.
     */
    totpSecret: text('totp_secret'),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    backupCodes: text('backup_codes').array(),

    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: varchar('last_login_ip', { length: 45 }),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    mustChangePassword: boolean('must_change_password').notNull().default(false),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_email_unique').on(sql`lower(${table.email})`),
    index('users_status_idx').on(table.status),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Refresh-token families.
 *
 * Exactly one of `userId` / `donorId` is set, enforced by a CHECK — the two
 * audiences cannot merge (decision A8). Reuse of a rotated token revokes the
 * whole family, which is the standard detection for a stolen refresh token.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    donorId: uuid('donor_id'),
    audience: tokenAudienceEnum('audience').notNull(),

    /** Family id: rotation keeps the family, reuse kills it. */
    tokenFamily: uuid('token_family').notNull(),
    /** SHA-256 of the refresh token. The token itself is never stored. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: varchar('revoked_reason', { length: 64 }),

    /**
     * Last successful re-authentication on this session.
     *
     * Sensitive operations — role changes, donor exports, visibility
     * changes — require one within the last five minutes (decision A9). Stored
     * on the SESSION rather than the user so that a second, older session
     * belonging to the same person does not inherit the freshness.
     */
    reauthenticatedAt: timestamp('reauthenticated_at', { withTimezone: true }),

    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_family_idx').on(table.tokenFamily),
    index('sessions_user_idx').on(table.userId),
    index('sessions_donor_idx').on(table.donorId),
    // Exactly one subject. Without this a session could belong to both
    // audiences at once, which is precisely what A8 forbids.
    check(
      'sessions_one_subject',
      sql`(user_id IS NOT NULL AND donor_id IS NULL) OR (user_id IS NULL AND donor_id IS NOT NULL)`,
    ),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

/**
 * One-time codes for donor phone login and for staff email verification /
 * password reset.
 *
 * Codes are HASHED, never stored in plaintext, and burn after a fixed number
 * of attempts (docs/security-architecture.md §2).
 */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: primaryId(),
    /** Phone for donor login; email for staff verification. */
    identifier: varchar('identifier', { length: 255 }).notNull(),
    purpose: varchar('purpose', { length: 40 }).notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ipAddress: varchar('ip_address', { length: 45 }),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('otp_identifier_purpose_idx').on(table.identifier, table.purpose),
    index('otp_expires_idx').on(table.expiresAt),
  ],
);

export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;
