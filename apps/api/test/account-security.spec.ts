import { createHash, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

import { DATABASE } from '../src/modules/database/database.module.js';
import { QueueService } from '../src/modules/queue/queue.service.js';
import {
  TEST_PASSWORD,
  TEST_USERS,
  PREFIX,
  createTestApp,
  devTotpCode,
  type Envelope,
} from './harness.js';

// The internal secret, so the trusted-address tests can vouch for a client.
// Set before the app is built, because the API reads its config at startup.
const INTERNAL_SECRET = 'internal-secret-for-account-security-tests-0123';
process.env.INTERNAL_API_SECRET = INTERNAL_SECRET;

/** Every fixture address is on this domain, so cleanup touches nothing else. */
const DOMAIN = 'security.test';
const address = (key: string) => `${key}-${randomUUID().slice(0, 8)}@${DOMAIN}`;

/**
 * Phase 12 — accounts, authentication and security hardening, end to end.
 *
 * Sign-in for volunteers who never donated, one spelling of an email address,
 * verified email changes, checkout that cannot rewrite somebody else's record,
 * the volunteer self-service allow-list, atomic refresh rotation, logout,
 * authentication audit events, audit addresses that cannot be spoofed, and the
 * donor tax id encrypted at rest.
 */
describe('Account and authentication security (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  type Db = { db: { execute(q: unknown): Promise<{ rows: Record<string, unknown>[] }> } };
  const db = () => app.get<Db>(DATABASE).db;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  }, 60_000);

  afterAll(async () => {
    const mine = sql`(SELECT id FROM donors WHERE email LIKE ${'%@' + DOMAIN})`;
    await db().execute(sql`DELETE FROM sessions WHERE donor_id IN ${mine}`);
    await db().execute(
      sql`DELETE FROM donation_items WHERE donation_id IN (SELECT id FROM donations WHERE donor_id IN ${mine})`,
    );
    await db().execute(
      sql`DELETE FROM payments WHERE donation_id IN (SELECT id FROM donations WHERE donor_id IN ${mine})`,
    );
    await db().execute(sql`DELETE FROM donations WHERE donor_id IN ${mine}`);
    await db().execute(sql`DELETE FROM donors WHERE email LIKE ${'%@' + DOMAIN}`);
    await db().execute(
      sql`DELETE FROM volunteer_applications WHERE volunteer_id IN (SELECT id FROM volunteers WHERE email LIKE ${'%@' + DOMAIN})`,
    );
    await db().execute(sql`DELETE FROM volunteers WHERE email LIKE ${'%@' + DOMAIN}`);
    await db().execute(sql`DELETE FROM otp_codes WHERE identifier LIKE ${'%@' + DOMAIN}`);
    await app?.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** A code the test knows, written as the service would (it stores only a hash). */
  async function plantCode(identifier: string, purpose: string, code = '424242') {
    await db().execute(sql`
      INSERT INTO otp_codes (identifier, purpose, code_hash, expires_at)
      VALUES (${identifier}, ${purpose}, ${createHash('sha256').update(code).digest('hex')},
              now() + interval '10 minutes')
    `);
    return code;
  }

  async function donorAccount(key: string) {
    const email = address(key);
    const [row] = (
      await db().execute(sql`
        INSERT INTO donors (donor_code, email, first_name, last_name, phone)
        VALUES (${'DNR-SEC-' + randomUUID().slice(0, 8)}, ${email}, 'Original', 'Name', '9811199999')
        RETURNING id
      `)
    ).rows;
    const code = await plantCode(email, 'donor_login');
    const signedIn = await request(server)
      .post(`${PREFIX}/auth/donor/otp/verify`)
      .send({ email, code })
      .expect(200);
    const data = (signedIn.body as Envelope<{ accessToken: string; refreshToken: string }>).data!;
    return { id: row!.id as string, email, token: data.accessToken, refresh: data.refreshToken };
  }

  async function staffSession() {
    const response = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() })
      .expect(200);
    return (response.body as Envelope<{ accessToken: string; refreshToken: string }>).data!;
  }

  const lastAudit = async (action: string) =>
    (
      await db().execute(sql`
        SELECT action, entity_id, user_id, ip_address, new_values, old_values
          FROM audit_logs WHERE action = ${action}
         ORDER BY created_at DESC LIMIT 1
      `)
    ).rows[0];

  // =========================================================================
  describe('sign-in for volunteers who never donated', () => {
    it('sends a code to a volunteer address with no donor account, and signs them in', async () => {
      const email = address('volunteer');
      await request(server)
        .post(`${PREFIX}/volunteers/apply`)
        .send({
          firstName: 'Vee',
          lastName: 'Lunteer',
          email,
          phone: `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
          city: 'Pune',
          skills: ['Teaching'],
          emergencyContactName: 'Sibling',
          emergencyContactPhone: '9876543210',
          emergencyContactRelation: 'Sister',
        })
        .expect(201);

      const enqueue = vi.spyOn(app.get(QueueService), 'enqueue');
      await request(server)
        .post(`${PREFIX}/auth/donor/otp/request`)
        .send({ email: email.toUpperCase() })
        .expect(200);
      const sent = enqueue.mock.calls.find(([, name]) => name === 'donor.login_code');
      expect(sent?.[2]).toMatchObject({ email });
      enqueue.mockRestore();

      // Entering the code opens the account, and the volunteer record is found.
      const code = await plantCode(email, 'donor_login');
      const verified = await request(server)
        .post(`${PREFIX}/auth/donor/otp/verify`)
        .send({ email, code })
        .expect(200);
      const token = (verified.body as Envelope<{ accessToken: string }>).data!.accessToken;
      const mine = await request(server)
        .get(`${PREFIX}/me/volunteering`)
        .set(auth(token))
        .expect(200);
      expect((mine.body as Envelope<{ isVolunteer: boolean }>).data!.isVolunteer).toBe(true);
    });

    it('still sends nothing to an address it holds no record of — and says the same', async () => {
      const enqueue = vi.spyOn(app.get(QueueService), 'enqueue');
      const response = await request(server)
        .post(`${PREFIX}/auth/donor/otp/request`)
        .send({ email: address('stranger') })
        .expect(200);
      expect((response.body as Envelope<{ sent: boolean }>).data).toEqual({ sent: true });
      expect(enqueue.mock.calls.some(([, name]) => name === 'donor.login_code')).toBe(false);
      enqueue.mockRestore();
    });
  });

  // =========================================================================
  describe('one spelling of an email address', () => {
    it('signs staff in however the address is capitalised or spaced', async () => {
      await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({
          email: `  ${TEST_USERS.superAdmin.toUpperCase()}  `,
          password: TEST_PASSWORD,
          totpCode: devTotpCode(),
        })
        .expect(200);
    });
  });

  // =========================================================================
  describe('changing an email address', () => {
    it('no longer changes the address on a plain profile update', async () => {
      const donor = await donorAccount('patch-email');
      const response = await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(donor.token))
        .send({ email: address('hijack') });
      expect(response.status).toBe(422);
      const me = await request(server).get(`${PREFIX}/me`).set(auth(donor.token)).expect(200);
      expect((me.body as Envelope<{ email: string }>).data!.email).toBe(donor.email);
    });

    it('changes it only after the code sent to the new address is entered', async () => {
      const donor = await donorAccount('change');
      const next = address('new');

      const enqueue = vi.spyOn(app.get(QueueService), 'enqueue');
      await request(server)
        .post(`${PREFIX}/me/email/change`)
        .set(auth(donor.token))
        .send({ email: next.toUpperCase() })
        .expect(200);
      // The code goes to the NEW address.
      const sent = enqueue.mock.calls.find(([, name]) => name === 'donor.login_code');
      expect(sent?.[2]).toMatchObject({ email: next, purpose: 'email_change' });
      enqueue.mockRestore();

      // Not yet changed.
      let me = await request(server).get(`${PREFIX}/me`).set(auth(donor.token)).expect(200);
      expect((me.body as Envelope<{ email: string }>).data!.email).toBe(donor.email);

      // A wrong code changes nothing.
      const identifier = `email_change:${donor.id}:${next}`;
      await plantCode(identifier, 'email_change', '111111');
      await request(server)
        .post(`${PREFIX}/me/email/verify`)
        .set(auth(donor.token))
        .send({ email: next, code: '222222' })
        .expect(401);

      await request(server)
        .post(`${PREFIX}/me/email/verify`)
        .set(auth(donor.token))
        .send({ email: next, code: '111111' })
        .expect(200);
      me = await request(server).get(`${PREFIX}/me`).set(auth(donor.token)).expect(200);
      expect((me.body as Envelope<{ email: string }>).data!.email).toBe(next);

      const audited = await lastAudit('donor.email_change_verified');
      expect(audited?.entity_id).toBe(donor.id);
    });

    it("refuses another account's code, and an address that is already taken", async () => {
      const alice = await donorAccount('alice');
      const bob = await donorAccount('bob');
      const next = address('wanted');

      // A code issued for Alice's change cannot finish one on Bob's account.
      await plantCode(`email_change:${alice.id}:${next}`, 'email_change', '333333');
      await request(server)
        .post(`${PREFIX}/me/email/verify`)
        .set(auth(bob.token))
        .send({ email: next, code: '333333' })
        .expect(401);

      // Bob proves he owns Alice's address — it is still Alice's.
      await plantCode(`email_change:${bob.id}:${alice.email}`, 'email_change', '444444');
      const taken = await request(server)
        .post(`${PREFIX}/me/email/verify`)
        .set(auth(bob.token))
        .send({ email: alice.email, code: '444444' });
      expect(taken.status).toBe(409);
    });
  });

  // =========================================================================
  describe('guest checkout', () => {
    it("never rewrites an existing donor's name or phone", async () => {
      const donor = await donorAccount('guest');
      const campaign = (
        await db().execute(sql`SELECT slug FROM campaigns WHERE slug = 'school-kits-jharkhand'`)
      ).rows[0]!.slug as string;

      // No Razorpay keys in this suite, so the order call fails AFTER the
      // donation (and the donor lookup) committed — exactly the path at issue.
      await request(server)
        .post(`${PREFIX}/donations`)
        .send({
          campaignSlug: campaign,
          items: [],
          customAmount: 50_000,
          donor: { name: 'Someone Else', email: donor.email.toUpperCase(), phone: '9811100999' },
        });

      const row = (
        await db().execute(
          sql`SELECT first_name, last_name, phone FROM donors WHERE id = ${donor.id}::uuid`,
        )
      ).rows[0]!;
      expect(row).toMatchObject({ first_name: 'Original', last_name: 'Name', phone: '9811199999' });
    });
  });

  // =========================================================================
  describe('volunteer self-service', () => {
    it.each([
      ['status', { status: 'active' }],
      ['volunteer id', { volunteerId: 'VOL-2026-99999' }],
      ['email', { email: 'someone@example.test' }],
      ['verified hours', { verifiedHours: 500 }],
      ['role', { role: 'admin' }],
    ])('refuses to let a volunteer set their own %s', async (_label, body) => {
      const donor = await donorAccount('self-service');
      const response = await request(server)
        .patch(`${PREFIX}/me/volunteering`)
        .set(auth(donor.token))
        .send(body);
      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  describe('refresh tokens and logout', () => {
    it('lets only one of two simultaneous refreshes with the same token succeed', async () => {
      const donor = await donorAccount('race');
      const [a, b] = await Promise.all([
        request(server).post(`${PREFIX}/auth/refresh`).send({ refreshToken: donor.refresh }),
        request(server).post(`${PREFIX}/auth/refresh`).send({ refreshToken: donor.refresh }),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 401]);

      // The loser was treated as a replay: the family is revoked and audited.
      const audited = await lastAudit('auth.refresh_reuse_detected');
      expect(audited).toBeTruthy();
    });

    it('stops the access token working the moment its session is logged out', async () => {
      const staff = await staffSession();
      await request(server).get(`${PREFIX}/auth/me`).set(auth(staff.accessToken)).expect(200);

      await request(server)
        .post(`${PREFIX}/auth/logout`)
        .send({ refreshToken: staff.refreshToken })
        .expect((response) => expect(response.status).toBeLessThan(300));

      await request(server).get(`${PREFIX}/auth/me`).set(auth(staff.accessToken)).expect(401);
      await request(server)
        .post(`${PREFIX}/auth/refresh`)
        .send({ refreshToken: staff.refreshToken })
        .expect(401);
    });
  });

  // =========================================================================
  describe('authentication audit events', () => {
    it('records a failed staff sign-in without the password', async () => {
      await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.superAdmin, password: 'definitely-wrong-password' })
        .expect(401);
      const audited = await lastAudit('auth.staff.login_failed');
      expect(audited?.new_values).toMatchObject({ reason: 'wrong_password' });
      expect(JSON.stringify(audited)).not.toContain('definitely-wrong-password');
    });

    it('records a failed sign-in code without the code or the address', async () => {
      const email = address('otp-fail');
      await plantCode(email, 'donor_login', '555555');
      await request(server)
        .post(`${PREFIX}/auth/donor/otp/verify`)
        .send({ email, code: '666666' })
        .expect(401);
      const audited = await lastAudit('auth.donor.otp_failed');
      const text = JSON.stringify(audited);
      expect(text).toContain('wrong_code');
      expect(text).not.toContain('666666');
      expect(text).not.toContain(email);
    });

    it('records successful sign-ins and logouts', async () => {
      const staff = await staffSession();
      expect(await lastAudit('auth.staff.login_succeeded')).toBeTruthy();
      await request(server)
        .post(`${PREFIX}/auth/logout`)
        .send({ refreshToken: staff.refreshToken });
      const logout = await lastAudit('auth.logout');
      expect(JSON.stringify(logout)).not.toContain(staff.refreshToken);
    });
  });

  // =========================================================================
  describe('audited addresses cannot be spoofed', () => {
    it('ignores X-Forwarded-For when recording who signed in', async () => {
      await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .set('X-Forwarded-For', '203.0.113.66')
        .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() })
        .expect(200);
      const audited = await lastAudit('auth.staff.login_succeeded');
      expect(audited?.ip_address).not.toBe('203.0.113.66');
    });

    it('records the address the web server vouched for, with the internal secret', async () => {
      await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .set(INTERNAL_AUTH_HEADER, INTERNAL_SECRET)
        .set(CLIENT_IP_HEADER, '198.51.100.23')
        .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() })
        .expect(200);
      expect((await lastAudit('auth.staff.login_succeeded'))?.ip_address).toBe('198.51.100.23');
    });

    it('ignores a vouched-for address without the right secret', async () => {
      await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .set(INTERNAL_AUTH_HEADER, 'not-the-secret')
        .set(CLIENT_IP_HEADER, '198.51.100.99')
        .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() })
        .expect(200);
      expect((await lastAudit('auth.staff.login_succeeded'))?.ip_address).not.toBe('198.51.100.99');
    });
  });

  // =========================================================================
  describe('the donor tax id (PAN)', () => {
    it('is stored encrypted, shown masked to the donor, and never echoed in full', async () => {
      const donor = await donorAccount('pan');
      const response = await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(donor.token))
        .send({ taxIdType: 'pan', taxIdNumber: 'abcde1234f' })
        .expect(200);

      const body = (response.body as Envelope<{ hasTaxId: boolean; taxIdNumberMasked: string }>)
        .data!;
      expect(body.hasTaxId).toBe(true);
      expect(body.taxIdNumberMasked).toBe('XXXXXX234F');
      expect(JSON.stringify(response.body)).not.toContain('ABCDE1234F');

      const stored = (
        await db().execute(sql`SELECT tax_id_number FROM donors WHERE id = ${donor.id}::uuid`)
      ).rows[0]!.tax_id_number as string;
      expect(stored.startsWith('enc:v1:')).toBe(true);
      expect(stored).not.toContain('ABCDE1234F');
    });

    it('shows the full number only to staff allowed to read sensitive donor data', async () => {
      const donor = await donorAccount('pan-admin');
      await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(donor.token))
        .send({ taxIdType: 'pan', taxIdNumber: 'FGHIJ5678K' })
        .expect(200);
      const staff = await staffSession();
      const detail = await request(server)
        .get(`${PREFIX}/admin/donors/${donor.id}`)
        .set(auth(staff.accessToken))
        .expect(200);
      expect((detail.body as Envelope<{ taxIdNumber: string }>).data!.taxIdNumber).toBe(
        'FGHIJ5678K',
      );
    });
  });
});
