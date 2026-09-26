import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sql } from 'drizzle-orm';

import { DATABASE } from '../src/modules/database/database.module.js';

import {
  TEST_PASSWORD,
  TEST_USERS,
  PREFIX,
  createTestApp,
  devTotpCode,
  errorCode,
  type Envelope,
} from './harness.js';

/**
 * Authentication, end to end, against the real database.
 *
 * The HTTP rate limiter is off here (see `createTestApp`); it has its own
 * suite. The SERVICE-level caps are still live, though — three OTP codes per
 * address per fifteen minutes — so each donor test uses a distinct address
 * rather than sharing one and exhausting it.
 */
describe('Authentication (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('staff login', () => {
    it('issues a session for correct credentials plus a valid second factor', async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() });

      expect(response.status).toBe(200);
      const body = response.body as Envelope<{
        accessToken: string;
        refreshToken: string;
        actor: { audience: string; permissions: string[] };
      }>;

      expect(body.success).toBe(true);
      expect(body.data?.actor.audience).toBe('staff');
      expect(body.data?.actor.permissions.length).toBeGreaterThan(50);
      expect(body.meta?.requestId).toBeTruthy();
    });

    it('signs a Super Admin in with EMAIL AND PASSWORD ALONE', async () => {
      /*
        ══════════════════════════════════════════════════════════════════════
        THIS TEST USED TO ASSERT THE OPPOSITE, AND THE REVERSAL IS DELIBERATE.

        It read "REFUSES a staff account without a second factor", on decision
        A8: TOTP mandatory, not warned about. That was right while roles were
        split and the seeded accounts were the only ones that existed.

        It became a deadlock. There is no TOTP enrolment route in this
        application — `totpSecret` is excluded by construction from every user
        DTO, the invite flow cannot produce a usable account, and the only
        writer of the column is the development seed. So the only accounts able
        to sign in were the seeded ones, whose secret is the RFC 6238 test
        vector, and a real production administrator could not be created at all.

        A factor that cannot be enrolled is an outage, not a control. Staff now
        authenticate with email and password; what defends the account is
        Argon2id, 5 attempts/minute, lockout after five failures, uniform
        errors, and re-authentication before anything `@Sensitive()`.

        Sends NO `totpCode` on purpose. If mandatory TOTP is ever reinstated
        for SUPER_ADMIN this test fails, which is the point.
        ══════════════════════════════════════════════════════════════════════
      */
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });

      expect(response.status).toBe(200);
      const body = response.body as Envelope<{ accessToken: string; actor: { id: string } }>;
      expect(body.data?.accessToken).toBeTruthy();
    });

    it('still ignores a supplied code rather than failing on it', async () => {
      // The seeded accounts carry a secret and callers may still send a code.
      // It must not become an error — and it is no longer verified either,
      // which is recorded in `TOTP_REQUIRED_ROLES`.
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: '000000' });

      expect(response.status).toBe(200);
    });

    it('gives the SAME error for an unknown email as for a wrong password', async () => {
      // Distinguishing them turns the login endpoint into a staff-account
      // enumeration oracle.
      const unknown = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: 'nobody@sailent.local', password: 'whatever-this-is' });

      const wrong = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: 'definitely-not-the-password' });

      expect(unknown.status).toBe(wrong.status);
      expect((unknown.body as Envelope).error?.message).toBe(
        (wrong.body as Envelope).error?.message,
      );
      expect(errorCode(unknown.body as Envelope)).toBe('UNAUTHENTICATED');
    });

    it('never returns a password hash or a TOTP secret', async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });

      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toMatch(/\$argon2/);
      expect(serialised).not.toContain('passwordHash');
      expect(serialised).not.toContain('totpSecret');
    });

    it('rejects a malformed request body with per-field detail', async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(422);
      const body = response.body as Envelope;
      expect(errorCode(body)).toBe('VALIDATION_FAILED');
      expect(Array.isArray(body.error?.details)).toBe(true);
    });
  });

  describe('token audiences', () => {
    let staffToken: string;

    beforeAll(async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });
      staffToken = (response.body as Envelope<{ accessToken: string }>).data!.accessToken;
    });

    it('accepts a staff token at a staff route', async () => {
      const response = await request(server)
        .get(`${PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ audience: string }>).data?.audience).toBe('staff');
    });

    it.each([
      ['no header', undefined],
      ['a malformed scheme', 'Basic abc'],
      ['a structurally invalid token', 'Bearer not.a.jwt'],
      ['a token signed with the wrong key', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad'],
    ])('rejects %s', async (_label, header) => {
      const call = request(server).get(`${PREFIX}/auth/me`);
      if (header) call.set('Authorization', header);
      const response = await call;

      expect(response.status).toBe(401);
      expect(errorCode(response.body as Envelope)).toBe('UNAUTHENTICATED');
    });
  });

  describe('refresh rotation', () => {
    it('rotates on use, and revokes the whole family when a used token is replayed', async () => {
      const login = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });

      const first = (login.body as Envelope<{ refreshToken: string }>).data!.refreshToken;

      const rotated = await request(server)
        .post(`${PREFIX}/auth/refresh`)
        .send({ refreshToken: first });
      expect(rotated.status).toBe(200);
      const second = (rotated.body as Envelope<{ refreshToken: string }>).data!.refreshToken;
      expect(second).not.toBe(first);

      // Replaying the spent token means either theft or a race. Either way the
      // family dies — including the token that legitimately replaced it.
      const replay = await request(server)
        .post(`${PREFIX}/auth/refresh`)
        .send({ refreshToken: first });
      expect(replay.status).toBe(401);

      const afterDetection = await request(server)
        .post(`${PREFIX}/auth/refresh`)
        .send({ refreshToken: second });
      expect(afterDetection.status).toBe(401);
    });

    it('rejects a refresh token that was never issued', async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/refresh`)
        .send({ refreshToken: 'a'.repeat(64) });

      expect(response.status).toBe(401);
    });

    it('logs out by revoking the family', async () => {
      const login = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });

      const { accessToken, refreshToken } = (
        login.body as Envelope<{ accessToken: string; refreshToken: string }>
      ).data!;

      await request(server).post(`${PREFIX}/auth/logout`).send({ refreshToken }).expect(204);

      // The ACCESS token dies too, immediately. A session that keeps working
      // until its token expires has not been logged out, only scheduled for it.
      const after = await request(server)
        .get(`${PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(after.status).toBe(401);
    });
  });

  describe('donor OTP', () => {
    const TEST_EMAILS = [
      'auth-spec-known@example.test',
      'auth-spec-unknown@example.test',
      'auth-spec-quiet@example.test',
    ];

    beforeAll(async () => {
      /**
       * Clear prior codes for these addresses.
       *
       * The service caps requests at three per address per fifteen minutes —
       * correctly, and it is tested in the rate-limit suite. Without this the
       * outcome of this suite would depend on how recently it last ran, which
       * is the definition of a flaky test.
       */
      const database = app.get<{ db: { execute(query: unknown): Promise<unknown> } }>(DATABASE);
      await database.db.execute(
        sql`DELETE FROM otp_codes WHERE identifier IN (${sql.join(
          TEST_EMAILS.map((email) => sql`${email}`),
          sql`, `,
        )})`,
      );
    });

    it('returns the same answer for a known and an unknown address', async () => {
      // Anything else makes this a donor-enumeration oracle — a way to find out
      // who has given, which is exactly what a donor expects to stay private.
      const known = await request(server)
        .post(`${PREFIX}/auth/donor/otp/request`)
        .send({ email: TEST_EMAILS[0] });
      const unknown = await request(server)
        .post(`${PREFIX}/auth/donor/otp/request`)
        .send({ email: TEST_EMAILS[1] });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toMatchObject({ data: { sent: true } });
      expect(unknown.body).toMatchObject({ data: { sent: true } });
    });

    it('never returns the code itself', async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/donor/otp/request`)
        .send({ email: TEST_EMAILS[2] });

      expect(JSON.stringify(response.body)).not.toMatch(/\b\d{6}\b/);
    });

    it('rejects a wrong code', async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/donor/otp/verify`)
        .send({ email: 'auth-spec-known@example.test', code: '000000' });

      expect(response.status).toBe(401);
    });
  });
});
