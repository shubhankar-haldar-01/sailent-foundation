import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import {
  donors,
  otpCodes,
  permissions as permissionsTable,
  rolePermissions,
  roles,
  sessions,
  userRoles,
  users,
  type DatabaseClient,
} from '@sailent/database';
import type { AuthenticatedActor, TokenAudience } from '@sailent/types';

import { AppConfig } from '../../config/app.config.js';
import { QUEUE_NAMES, QueueService } from '../queue/queue.service.js';
import { DATABASE } from '../database/database.module.js';
import { referenceCode } from '../../common/utils/reference.js';
import {
  ConflictException,
  ForbiddenException,
  RateLimitException,
  UnauthenticatedException,
} from '../../common/exceptions.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { TotpService } from './totp.service.js';

/**
 * One spelling of an address, used everywhere.
 *
 * People do not type their own email consistently — a capital first letter from
 * a phone keyboard, a trailing space pasted from a contact card. Every one of
 * those is the same mailbox, and if they are not normalised in ONE place they
 * become separate rate-limit buckets, separate OTP rows, and an address that
 * fails to match the donor it belongs to.
 *
 * This matches `donors_email_lower_unique`, the functional index created in
 * migration `0011`. The two must agree, or a lookup misses a row the index
 * considers a duplicate.
 */
function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  actor: AuthenticatedActor;
}

/**
 * Roles for which TOTP is mandatory (decision A8).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SUPER_ADMIN IS NO LONGER IN THIS SET. STAFF SIGN IN WITH EMAIL + PASSWORD.
 *
 * The set named three of six roles originally — Super Admin, Admin and Finance
 * Manager carried a second factor while the Campaign, Volunteer and Content
 * managers did not. Phase 8 collapsed the six into one, which made a second
 * factor mandatory for every staff account as a side effect nobody chose.
 *
 * That side effect turned out to be a deadlock rather than a hardening. There
 * is NO TOTP ENROLMENT ROUTE anywhere in this application: `totpSecret` is
 * excluded by construction from every user DTO, the invite flow creates an
 * account with an unusable password and no way to set one, and the only writer
 * of the column is the development seed. So the only accounts that could sign
 * in were the seeded ones, whose secret is the RFC 6238 test vector and whose
 * password is printed in the documentation — and a real administrator could
 * not be created at all.
 *
 * Requiring a factor that cannot be enrolled is not security. It is an
 * outage with a security-shaped explanation.
 *
 * WHAT DEFENDS A STAFF ACCOUNT NOW, all pre-existing and all still in place:
 * Argon2id password hashing, five login attempts per minute per address
 * (shared across instances via Redis since the Phase 8 cleanup), account
 * lockout after five failures, uniform failure messages that do not reveal
 * whether an account exists, and re-authentication within a five-minute window
 * before any `@Sensitive()` operation.
 *
 * A CONSEQUENCE WORTH STATING: an account that HAS a secret enrolled — the six
 * seeded ones do — no longer has it verified, because `needsTotp` gates the
 * whole check. Those accounts are being retired; if a second factor is wanted
 * again later, the thing to build first is enrolment, and only then to put a
 * role back in this set.
 *
 * The retired keys stay: they cost nothing, TotpService and its RFC test
 * vectors remain intact, and a database restored from before Phase 8 still has
 * users holding them.
 * ══════════════════════════════════════════════════════════════════════════
 */
const TOTP_REQUIRED_ROLES = new Set(['ADMIN', 'FINANCE_MANAGER']);

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

/** How long a re-authentication stays valid for sensitive operations (decision A9). */
const REAUTH_WINDOW_MINUTES = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
    private readonly config: AppConfig,
    private readonly queue: QueueService,
  ) {}

  // -------------------------------------------------------------------------
  // Staff: email + password (+ TOTP for privileged roles)
  // -------------------------------------------------------------------------

  async loginStaff(input: {
    email: string;
    password: string;
    totpCode?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${input.email})`)
      .limit(1);

    /**
     * Uniform failure. An unknown email and a wrong password produce the SAME
     * error, because distinguishing them turns the login endpoint into a
     * staff-account enumeration oracle.
     *
     * The password is still verified against a dummy hash when no user exists,
     * so the response time does not leak the answer either.
     */
    if (!user) {
      await this.passwords.verify(
        '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        input.password,
      );
      throw new UnauthenticatedException('Those details do not match an account.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new RateLimitException('Too many failed attempts. Try again in a few minutes.');
    }

    if (user.status !== 'active') {
      // Status is checked AFTER the password, so an attacker cannot use the
      // error to discover which accounts exist and are suspended.
      const valid = await this.passwords.verify(user.passwordHash, input.password);
      if (!valid) await this.recordFailedLogin(user.id, user.failedLoginCount);
      throw new ForbiddenException('This account is not active. Contact an administrator.');
    }

    const valid = await this.passwords.verify(user.passwordHash, input.password);
    if (!valid) {
      await this.recordFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthenticatedException('Those details do not match an account.');
    }

    const permissions = await this.resolvePermissions(user.id);
    const roleKeys = await this.resolveRoleKeys(user.id);

    /**
     * TOTP is MANDATORY for privileged roles. A Finance Manager who has not
     * enrolled cannot log in — not "is warned", cannot. This role can move
     * money out, and a password alone is not sufficient for that.
     */
    const needsTotp = roleKeys.some((key) => TOTP_REQUIRED_ROLES.has(key));

    if (needsTotp) {
      if (!user.totpEnabled || !user.totpSecret) {
        throw new ForbiddenException(
          'Two-factor authentication must be enrolled before this account can sign in. Contact an administrator.',
        );
      }

      if (!input.totpCode) {
        throw new UnauthenticatedException('Enter the 6-digit code from your authenticator app.');
      }

      if (!this.totp.verify(user.totpSecret, input.totpCode)) {
        // A wrong second factor counts against the lockout too — otherwise the
        // code space could be brute-forced once a password is known.
        await this.recordFailedLogin(user.id, user.failedLoginCount);
        throw new UnauthenticatedException('That code is not correct.');
      }
    }

    await this.database.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: input.ip ?? null,
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));

    return this.issueSession({
      subject: user.id,
      audience: 'staff',
      permissions,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private async recordFailedLogin(userId: string, currentCount: number): Promise<void> {
    const next = currentCount + 1;
    const lock = next >= MAX_FAILED_LOGINS;

    await this.database.db
      .update(users)
      .set({
        failedLoginCount: next,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, userId));
  }

  // -------------------------------------------------------------------------
  // Donors: email OTP. No password exists (decision A8).
  // -------------------------------------------------------------------------

  /**
   * Request a one-time code.
   *
   * ALWAYS succeeds from the caller's point of view, whether or not the address
   * belongs to a known donor. Anything else makes this a donor-enumeration
   * oracle — a way to discover who has given, which is exactly the information
   * a donor expects to be private.
   *
   * The address is NORMALISED once, here, and everything downstream uses the
   * normalised form: the rate-limit lookup, the stored `identifier`, and the
   * donor lookup on verify. `Asha@Example.com ` and `asha@example.com` are one
   * mailbox and must not be two rate-limit buckets or two codes.
   */
  async requestOtp(input: { email: string; ip?: string }): Promise<{ sent: true }> {
    const identifier = normaliseEmail(input.email);

    const recent = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.identifier, identifier),
          gt(otpCodes.createdAt, new Date(Date.now() - 15 * 60_000)),
        ),
      );

    if ((recent[0]?.count ?? 0) >= 3) {
      throw new RateLimitException('Too many codes requested. Try again in a few minutes.');
    }

    const code = String(randomInt(100_000, 999_999));

    await this.database.db.insert(otpCodes).values({
      identifier,
      purpose: 'donor_login',
      // Hashed, never stored in plaintext.
      codeHash: createHash('sha256').update(code).digest('hex'),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      ipAddress: input.ip ?? null,
    });

    await this.deliverOtp(identifier, code);

    /**
     * SMS delivery is still not wired — it needs a DLT-registered sender ID and
     * approved templates under Indian telecom regulation, which has a lead time
     * (Phase 0 open question 3: the vendor is undecided).
     *
     * In development the code is logged so the flow is testable.
     *
     * ══════════════════════════════════════════════════════════════════════
     * GATED ON THE PARSED FLAG, not on `process.env`.
     *
     * This previously read `process.env.FEATURE_MOCK_DATA !== 'false'`, which
     * looks equivalent and is not: the schema also accepts `0`, and `'0'` is
     * not the string `'false'`. A production deployment configured with
     * `FEATURE_MOCK_DATA=0` booted cleanly and then logged every donor's
     * plaintext sign-in code to the application log.
     *
     * `mockDataEnabled` is the PARSED boolean, and it also refuses to be true
     * in production whatever the flag says.
     * ══════════════════════════════════════════════════════════════════════
     */
    if (this.config.mockDataEnabled) {
      this.logger.warn(`[dev] OTP for ${identifier}: ${code}`);
    }

    return { sent: true };
  }

  /**
   * Get the code to the donor.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * SENDS ONLY TO AN ADDRESS ALREADY ON A DONOR RECORD.
   *
   * The caller supplies the address, so the obvious risk is using this endpoint
   * to mail a code — or just mail anything — to an arbitrary inbox. The lookup
   * below is what prevents it: an address with no donor behind it gets nothing.
   * A code sent to a stranger would be useless anyway, since `verifyOtp`
   * refuses without a donor, but "useless" is not the same as "not sent" when
   * somebody else's inbox is the thing receiving it.
   *
   * SILENT WHEN THERE IS NO DONOR, for the same reason `requestOtp` is: it
   * answers identically either way, and that is what stops this being a way to
   * discover who has given. An address with no donor simply has nothing to
   * send to.
   *
   * FAILING TO ENQUEUE DOES NOT FAIL THE REQUEST. The code is already written
   * and the caller has already been told to expect one; throwing here would
   * tell them the number was known, which is the one thing this flow will not
   * say. It is logged instead.
   * ══════════════════════════════════════════════════════════════════════════
   */
  private async deliverOtp(email: string, code: string): Promise<void> {
    const [donor] = await this.database.db
      .select({ email: donors.email, firstName: donors.firstName, lastName: donors.lastName })
      .from(donors)
      .where(sql`lower(btrim(${donors.email})) = ${email}`)
      .limit(1);

    if (!donor?.email) return;

    const name = [donor.firstName, donor.lastName].filter(Boolean).join(' ').trim() || null;

    try {
      await this.queue.enqueue(
        QUEUE_NAMES.EMAIL,
        'donor.login_code',
        { email: donor.email, name, code, ttlMinutes: OTP_TTL_MINUTES },
        {
          /*
            This payload IS a credential, so it does not get the default
            retention of a day completed and a week failed. It is dropped the
            moment it is delivered, and a failure is kept only long enough to
            outlive the code itself.
          */
          removeOnComplete: true,
          removeOnFail: { age: OTP_TTL_MINUTES * 60 },
        },
      );
    } catch (error) {
      // No code, no address, no phone number in this line.
      this.logger.error(
        `Could not enqueue a donor sign-in code: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async verifyOtp(input: {
    email: string;
    code: string;
    ip?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    const identifier = normaliseEmail(input.email);

    const [record] = await this.database.db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.identifier, identifier),
          eq(otpCodes.purpose, 'donor_login'),
          isNull(otpCodes.consumedAt),
          gt(otpCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(sql`${otpCodes.createdAt} DESC`)
      .limit(1);

    if (!record) {
      throw new UnauthenticatedException('That code has expired. Request a new one.');
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new RateLimitException('Too many attempts on this code. Request a new one.');
    }

    const matches = record.codeHash === createHash('sha256').update(input.code).digest('hex');

    if (!matches) {
      await this.database.db
        .update(otpCodes)
        .set({ attempts: record.attempts + 1 })
        .where(eq(otpCodes.id, record.id));
      throw new UnauthenticatedException('That code is not correct.');
    }

    // Burn the code immediately — single use, whatever happens next.
    await this.database.db
      .update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(eq(otpCodes.id, record.id));

    const [donor] = await this.database.db
      // The two name columns come back with the id, so the display name
      // returned below costs no additional query. Nothing else is selected:
      // this row is being read to answer "does this account exist", and
      // widening it further would put more of a donor's record into a code
      // path that only needs a yes.
      .select({ id: donors.id, firstName: donors.firstName, lastName: donors.lastName })
      .from(donors)
      .where(sql`lower(btrim(${donors.email})) = ${identifier}`)
      .limit(1);

    /**
     * NO ACCOUNT YET? CREATE ONE.
     *
     * ══════════════════════════════════════════════════════════════════════
     * This used to refuse: "we have no donations recorded for this email
     * address. An account is created by your first donation." The reasoning
     * was decision A8 — giving once IS the registration, so no empty account
     * can be created by somebody who has never given.
     *
     * Phase 8 makes that reasoning wrong. A volunteer applies without donating
     * and then needs to see their assignments, their hours and their
     * certificate. Under the old rule they could not sign in at all, and the
     * error told them to make a donation — which is close to the worst thing
     * to say to somebody offering their time.
     *
     * So `donors` is now the GENERAL PUBLIC ACCOUNT. One person, one row, and
     * whether they have donated, volunteered, both or neither is a property of
     * what is attached to it rather than a precondition for having it.
     *
     * The anti-abuse property A8 was protecting still holds, because it never
     * came from this branch: an account is only created after a code sent to
     * that address has been received and entered correctly. Somebody who can
     * do that owns the mailbox, and a row keyed to a mailbox they own is not
     * an abuse vector — it is the definition of an account.
     * ══════════════════════════════════════════════════════════════════════
     *
     * `donorCode` is NOT NULL on the table and is generated the same way the
     * donation path generates it. It reads DNR- for everybody, including
     * somebody who has only ever volunteered, and that is a cosmetic oddity
     * rather than a correctness problem: the Form 10BD export is driven by
     * DONATIONS, not by the existence of a code, so an account with no giving
     * history contributes nothing to the filing.
     */
    const account =
      donor ??
      (
        await this.database.db
          .insert(donors)
          .values({
            donorCode: `DNR-${new Date().getFullYear()}-${referenceCode('', 6).replace('-', '')}`,
            email: identifier,
            // The local part of the address, which is a better greeting than
            // "there" and is replaced the moment they fill in their profile.
            firstName: identifier.split('@')[0]?.slice(0, 120) || 'Friend',
            // NOT NULL on the table, and this account has no phone yet. The
            // empty string is the honest placeholder: the profile form asks
            // for a real one, and nothing sends to it meanwhile.
            phone: '',
          })
          .returning({ id: donors.id, firstName: donors.firstName, lastName: donors.lastName })
      )[0];

    if (!account) {
      throw new UnauthenticatedException('Could not open an account for that address.');
    }

    return this.issueSession({
      subject: account.id,
      audience: 'donor',
      permissions: [],
      // The donor row is already loaded to check the account exists, so this
      // name costs no additional query.
      name: [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || null,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  private async issueSession(input: {
    subject: string;
    audience: TokenAudience;
    permissions: string[];
    /**
     * A display name, returned with the session so the client need not ask.
     *
     * ══════════════════════════════════════════════════════════════════════
     * IT IS HERE TO REMOVE AN API CALL FROM EVERY PAGE VIEW.
     *
     * The web header shows a signed-in donor's initials. It was fetching `/me`
     * to get them — one authenticated round trip per page, on every public
     * page, for two letters in a 40px circle. Returning the name with the
     * session it already belongs to costs nothing and removes that entirely.
     *
     * It is a DISPLAY NAME and nothing more. No email, no phone, no id beyond
     * the subject already here: a name is the least sensitive thing on the
     * record, and it is going into a cookie that already holds both tokens.
     * ══════════════════════════════════════════════════════════════════════
     */
    name?: string | null;
    ip?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    const refresh = this.tokens.issueRefreshToken();
    const expiresAt = new Date(Date.now() + this.tokens.refreshTtlMs(input.audience));

    const [session] = await this.database.db
      .insert(sessions)
      .values({
        userId: input.audience === 'staff' ? input.subject : null,
        donorId: input.audience === 'donor' ? input.subject : null,
        audience: input.audience,
        tokenFamily: refresh.family,
        tokenHash: refresh.hash,
        expiresAt,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      })
      .returning({ id: sessions.id });

    if (!session) throw new ConflictException('Could not start a session.');

    const accessToken = this.tokens.issueAccessToken({
      subject: input.subject,
      audience: input.audience,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: 15 * 60,
      actor: {
        id: input.subject,
        audience: input.audience,
        permissions: input.permissions,
        sessionId: session.id,
        ...(input.name ? { name: input.name } : {}),
      },
    };
  }

  /**
   * Rotate a refresh token.
   *
   * REUSE DETECTION: presenting a token that has already been rotated means
   * either a stolen token or a race. Either way the entire family is revoked,
   * which logs the legitimate user out too — deliberately. A forced re-login is
   * a small cost; leaving a thief with a working session is not.
   */
  async refresh(input: {
    refreshToken: string;
    ip?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    const hash = this.tokens.hashRefreshToken(input.refreshToken);

    const [session] = await this.database.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hash))
      .limit(1);

    if (!session) throw new UnauthenticatedException('That session is no longer valid.');

    if (session.revokedAt) {
      this.logger.error(
        { sessionId: session.id, family: session.tokenFamily },
        'Refresh token reuse detected — revoking the whole family',
      );
      await this.revokeFamily(session.tokenFamily, 'reuse_detected');
      throw new UnauthenticatedException('That session is no longer valid.');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthenticatedException('That session has expired.');
    }

    const subject = session.userId ?? session.donorId;
    if (!subject) throw new UnauthenticatedException('That session is no longer valid.');

    // Permissions are resolved PER REFRESH, not carried forward, so a role
    // change takes effect without waiting for the user to log out.
    const permissions = session.audience === 'staff' ? await this.resolvePermissions(subject) : [];

    await this.database.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: 'rotated' })
      .where(eq(sessions.id, session.id));

    const rotated = this.tokens.rotateRefreshToken(session.tokenFamily);
    const expiresAt = new Date(Date.now() + this.tokens.refreshTtlMs(session.audience));

    const [next] = await this.database.db
      .insert(sessions)
      .values({
        userId: session.userId,
        donorId: session.donorId,
        audience: session.audience,
        tokenFamily: session.tokenFamily,
        tokenHash: rotated.hash,
        expiresAt,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        // Carried across rotation. Refreshing a token is not itself a
        // re-authentication, but neither does it undo one — the five-minute
        // window still runs from the moment the password was actually re-entered.
        reauthenticatedAt: session.reauthenticatedAt,
      })
      .returning({ id: sessions.id });

    if (!next) throw new ConflictException('Could not refresh the session.');

    return {
      accessToken: this.tokens.issueAccessToken({
        subject,
        audience: session.audience,
        sessionId: next.id,
      }),
      refreshToken: rotated.token,
      expiresIn: 15 * 60,
      actor: {
        id: subject,
        audience: session.audience,
        permissions,
        sessionId: next.id,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const [session] = await this.database.db
      .select({ family: sessions.tokenFamily })
      .from(sessions)
      .where(eq(sessions.tokenHash, hash))
      .limit(1);

    if (session) await this.revokeFamily(session.family, 'logout');
  }

  private async revokeFamily(family: string, reason: string): Promise<void> {
    await this.database.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.tokenFamily, family), isNull(sessions.revokedAt)));
  }

  // -------------------------------------------------------------------------
  // Re-authentication for sensitive operations (decision A9)
  // -------------------------------------------------------------------------

  /**
   * Re-confirm the signed-in staff member's identity.
   *
   * Sensitive operations — role changes, donor exports, document visibility
   * — require this within the last five minutes. The threat it addresses is a
   * borrowed or hijacked session rather than a stolen password: whoever is at
   * the keyboard must prove they are still the account holder before moving
   * money or granting themselves permissions.
   *
   * The password is re-verified against the SAME account as the session. A
   * stamp is written only on success, so a failed attempt never extends an
   * existing window.
   */
  async reauthenticate(input: {
    actor: AuthenticatedActor;
    password: string;
    totpCode?: string;
  }): Promise<{ reauthenticatedAt: Date; validForSeconds: number }> {
    if (input.actor.audience !== 'staff') {
      throw new ForbiddenException('Only staff accounts can re-authenticate.');
    }

    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, input.actor.id))
      .limit(1);

    if (!user || user.status !== 'active') {
      throw new UnauthenticatedException('That session is no longer valid.');
    }

    const valid = await this.passwords.verify(user.passwordHash, input.password);
    if (!valid) {
      await this.recordFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthenticatedException('That password is not correct.');
    }

    // The same second factor the account logs in with is required again. A
    // re-auth weaker than the original login would be a downgrade attack.
    const roleKeys = await this.resolveRoleKeys(user.id);
    if (roleKeys.some((key) => TOTP_REQUIRED_ROLES.has(key))) {
      if (!user.totpEnabled || !user.totpSecret || !input.totpCode) {
        throw new UnauthenticatedException('Enter the 6-digit code from your authenticator app.');
      }
      if (!this.totp.verify(user.totpSecret, input.totpCode)) {
        await this.recordFailedLogin(user.id, user.failedLoginCount);
        throw new UnauthenticatedException('That code is not correct.');
      }
    }

    const now = new Date();
    await this.database.db
      .update(sessions)
      .set({ reauthenticatedAt: now })
      .where(eq(sessions.id, input.actor.sessionId));

    await this.database.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    return { reauthenticatedAt: now, validForSeconds: REAUTH_WINDOW_MINUTES * 60 };
  }

  /** True when this session re-authenticated inside the sensitive-operation window. */
  hasFreshReauth(actor: AuthenticatedActor | null): boolean {
    if (!actor?.reauthenticatedAt) return false;
    const age = Date.now() - new Date(actor.reauthenticatedAt).getTime();
    return age >= 0 && age <= REAUTH_WINDOW_MINUTES * 60_000;
  }

  // -------------------------------------------------------------------------
  // Actor resolution — used by the guards on every request
  // -------------------------------------------------------------------------

  async resolveActor(
    accessToken: string,
    audience: TokenAudience,
  ): Promise<AuthenticatedActor | null> {
    const claims = this.tokens.verifyAccessToken(accessToken, audience);
    if (!claims) return null;

    // The session must still exist and be live. A revoked session invalidates
    // its access token immediately rather than at expiry, which is what makes
    // "remove this person's access now" actually mean now.
    const [session] = await this.database.db
      .select({
        id: sessions.id,
        revokedAt: sessions.revokedAt,
        reauthenticatedAt: sessions.reauthenticatedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, claims.sid))
      .limit(1);

    if (!session || session.revokedAt) return null;

    /*
      PERMISSIONS COME FROM THE DATABASE, NOT THE TOKEN.

      Same reasoning as `reauthenticatedAt` below, and it took the single-role
      migration to force the issue: with one role holding all 94 permissions,
      the list no longer fitted in a cookie. But the size was only how we found
      out. A permission baked in at login survives its own revocation for the
      life of the token, which means "remove this person's access" does not
      mean now — and that is the one guarantee an admin panel has to keep.

      Donors have none, and asking would be a pointless query on the hottest
      path in the app: every signed-in page view resolves a donor actor.
    */
    const permissions = claims.aud === 'staff' ? await this.resolvePermissions(claims.sub) : [];

    return {
      id: claims.sub,
      audience: claims.aud,
      permissions,
      sessionId: claims.sid,
      // From the SESSION ROW, never from the token. A claim baked in at login
      // could not be revoked, and could be replayed for the life of the token.
      reauthenticatedAt: session.reauthenticatedAt,
    };
  }

  /** Effective permissions are the UNION across every role the user holds. */
  async resolvePermissions(userId: string): Promise<string[]> {
    const rows = await this.database.db
      .selectDistinct({ key: permissionsTable.key })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissionsTable, eq(permissionsTable.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId));

    return rows.map((row) => row.key);
  }

  async resolveRoleKeys(userId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ key: roles.key })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));

    return rows.map((row) => row.key);
  }

  /** Deny by default: an absent actor, or one without the permission, is refused. */
  hasPermission(actor: AuthenticatedActor | null, permission: string): boolean {
    return actor?.permissions.includes(permission) ?? false;
  }

  matchesAudience(actor: AuthenticatedActor | null, required: TokenAudience): boolean {
    return actor !== null && actor.audience === required;
  }
}
