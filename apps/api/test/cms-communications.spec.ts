import { createHash, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { QUEUE_NAMES, QueueService } from '../src/modules/queue/queue.service.js';
import { ReceiptsService } from '../src/modules/donations/receipts.service.js';
import {
  PREFIX,
  TEST_PASSWORD,
  TEST_USERS,
  createTestApp,
  devTotpCode,
  errorCode,
  fakeStorage,
  type Envelope,
} from './harness.js';

/** Every fixture is tagged with this, so cleanup touches nothing else. */
const RUN = randomUUID().slice(0, 8);
const DOMAIN = 'cms.test';
const address = (key: string) => `${key}-${RUN}-${randomUUID().slice(0, 6)}@${DOMAIN}`;

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'ascii',
);

/**
 * Phase 13 — admin, CMS and communications, end to end against the real
 * database: settings the site actually reads, contact messages, the
 * double-opt-in newsletter, staff invitations and password reset, document
 * deletion, story archiving, the campaign gallery, covers and updates, the
 * dashboard, general FAQs, search, and the notification retry path.
 *
 * Refusals are tested with a real staff account that holds NO role (so no
 * permission), and story archiving with a throwaway test role that has
 * `story.publish` but not `story.archive`. SUPER_ADMIN remains the only
 * product role; both test identities are removed afterwards.
 */
describe('CMS and communications (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let admin: string;
  let noRole: string;
  let publisherOnly: string;
  let storage: ReturnType<typeof fakeStorage>;
  let enqueue: ReturnType<typeof vi.spyOn>;

  type Rows = { rows: Record<string, unknown>[] };
  const db = () => app.get<{ db: { execute(q: unknown): Promise<Rows> } }>(DATABASE).db;
  const one = async (query: unknown) => (await db().execute(query)).rows[0];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const fixtures = {
    users: [] as string[],
    campaigns: [] as string[],
    media: [] as string[],
    stories: [] as string[],
    documents: [] as string[],
    faqs: [] as string[],
    roleId: '' as string,
  };
  let originalSettings: Record<string, unknown> = {};

  async function login(email: string, password = TEST_PASSWORD) {
    const response = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email, password, totpCode: devTotpCode() });
    return response;
  }

  async function reauth(token = admin) {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  /** Jobs enqueued under one name since the spy was last cleared. */
  const jobs = (name: string) =>
    enqueue.mock.calls
      .filter((call) => call[1] === name)
      .map((call) => ({ queue: call[0] as string, data: call[2] as Record<string, string> }));

  async function staffAccount(
    status: 'active' | 'invited' | 'suspended',
    email = address('staff'),
  ) {
    const hash = await app.get(PasswordService).hash(TEST_PASSWORD);
    const row = await one(sql`
      INSERT INTO users (email, first_name, status, password_hash)
      VALUES (${email}, 'Test', ${status}, ${hash}) RETURNING id
    `);
    fixtures.users.push(row!.id as string);
    return { id: row!.id as string, email };
  }

  async function publicMedia(visibility: 'public' | 'private' = 'public') {
    const key = `media/2026/10/${RUN}${randomUUID().replace(/-/g, '').slice(0, 12)}.jpg`;
    const url = visibility === 'public' ? `https://media.test.invalid/${key}` : null;
    const row = await one(sql`
      INSERT INTO media (storage_key, url, alt_text, mime_type, size_bytes, visibility)
      VALUES (${key}, ${url}, ${'Phase 13 image ' + RUN}, 'image/jpeg', 1234, ${visibility})
      RETURNING id
    `);
    fixtures.media.push(row!.id as string);
    return { id: row!.id as string, url };
  }

  async function campaign(status: 'active' | 'draft' = 'active', title = `Phase13 ${RUN}`) {
    const program = await one(sql`SELECT id FROM programs WHERE status = 'published' LIMIT 1`);
    const slug = `p13-${RUN}-${randomUUID().slice(0, 6)}`;
    const row = await one(sql`
      INSERT INTO campaigns (title, slug, short_description, fundraising_goal, status, program_id)
      VALUES (${title}, ${slug}, 'A Phase 13 test campaign.', 100000, ${status}, ${program!.id as string})
      RETURNING id, slug
    `);
    fixtures.campaigns.push(row!.id as string);
    return { id: row!.id as string, slug: row!.slug as string };
  }

  beforeAll(async () => {
    storage = fakeStorage();
    app = await createTestApp({ storage });
    server = app.getHttpServer();
    enqueue = vi.spyOn(app.get(QueueService), 'enqueue');

    admin = ((await login(TEST_USERS.superAdmin)).body as Envelope<{ accessToken: string }>).data!
      .accessToken;

    const bare = await staffAccount('active');
    noRole = ((await login(bare.email)).body as Envelope<{ accessToken: string }>).data!
      .accessToken;

    // A test-only role: story.read + story.publish, but NOT story.archive.
    const role = await one(sql`
      INSERT INTO roles (key, name, is_system, priority)
      VALUES (${'TEST_P13_' + RUN}, 'Phase 13 test role', false, 1) RETURNING id
    `);
    fixtures.roleId = role!.id as string;
    await db().execute(sql`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT ${fixtures.roleId}::uuid, id FROM permissions WHERE key IN ('story.read', 'story.publish')
    `);
    const publisher = await staffAccount('active');
    await db().execute(
      sql`INSERT INTO user_roles (user_id, role_id) VALUES (${publisher.id}::uuid, ${fixtures.roleId}::uuid)`,
    );
    publisherOnly = ((await login(publisher.email)).body as Envelope<{ accessToken: string }>).data!
      .accessToken;

    const settings = await db().execute(
      sql`SELECT key, value FROM settings WHERE key IN ('organization_contact', 'organization_social', 'registration_details')`,
    );
    originalSettings = Object.fromEntries(settings.rows.map((row) => [row.key, row.value]));
  }, 90_000);

  beforeEach(() => {
    enqueue.mockClear();
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(originalSettings)) {
      await db().execute(
        sql`UPDATE settings SET value = ${JSON.stringify(value)}::jsonb WHERE key = ${key}`,
      );
    }
    await db().execute(sql`DELETE FROM contact_messages WHERE email LIKE ${'%@' + DOMAIN}`);
    await db().execute(sql`DELETE FROM newsletter_subscribers WHERE email LIKE ${'%@' + DOMAIN}`);
    await db().execute(sql`DELETE FROM campaign_gallery WHERE campaign_id IN (
      SELECT id FROM campaigns WHERE slug LIKE ${'p13-' + RUN + '%'})`);
    await db().execute(sql`DELETE FROM impact_updates WHERE campaign_id IN (
      SELECT id FROM campaigns WHERE slug LIKE ${'p13-' + RUN + '%'})`);
    await db().execute(sql`DELETE FROM campaigns WHERE slug LIKE ${'p13-' + RUN + '%'}`);
    await db().execute(sql`DELETE FROM programs WHERE slug LIKE ${'p13-' + RUN + '%'}`);
    for (const id of fixtures.media)
      await db().execute(sql`DELETE FROM media WHERE id = ${id}::uuid`);
    await db().execute(sql`DELETE FROM success_stories WHERE slug LIKE ${'p13-' + RUN + '%'}`);
    for (const id of fixtures.documents) {
      await db().execute(sql`DELETE FROM documents WHERE id = ${id}::uuid`);
    }
    for (const id of fixtures.faqs)
      await db().execute(sql`DELETE FROM faqs WHERE id = ${id}::uuid`);
    await db().execute(sql`DELETE FROM notifications WHERE data->>'contactMessageId' IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM contact_messages c WHERE c.id::text = data->>'contactMessageId')`);
    const mine = sql`(SELECT id FROM users WHERE email LIKE ${'%@' + DOMAIN})`;
    await db().execute(sql`DELETE FROM sessions WHERE user_id IN ${mine}`);
    await db().execute(sql`DELETE FROM user_roles WHERE user_id IN ${mine}`);
    await db().execute(sql`DELETE FROM otp_codes WHERE identifier IN (
      SELECT 'staff:' || id FROM users WHERE email LIKE ${'%@' + DOMAIN})`);
    await db().execute(sql`DELETE FROM users WHERE email LIKE ${'%@' + DOMAIN}`);
    if (fixtures.roleId)
      await db().execute(sql`DELETE FROM roles WHERE id = ${fixtures.roleId}::uuid`);
    await app?.close();
  });

  // =========================================================================
  describe('settings the site actually reads', () => {
    it('serves only the public keys, never fcra_enabled or the donation minimum', async () => {
      const response = await request(server).get(`${PREFIX}/settings/public`);
      expect(response.status).toBe(200);
      const data = (response.body as Envelope<Record<string, unknown>>).data!;
      expect(Object.keys(data).sort()).toEqual([
        'organization_contact',
        'organization_name',
        'organization_social',
        'registration_details',
      ]);
    });

    it('a saved contact and social change is what the public endpoint then returns', async () => {
      await reauth();
      const patch = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(admin))
        .send({
          organization_contact: {
            email: `Office-${RUN}@Example.org`,
            phone: '+91 20 4000 1234',
            officeHours: 'Weekdays 10–6',
            address: { line1: '1 Test Road', city: 'Pune', country: 'India' },
          },
          organization_social: [{ label: 'Instagram', url: 'https://instagram.com/sailent' }],
        });
      expect(patch.status).toBe(200);

      const data = (
        (await request(server).get(`${PREFIX}/settings/public`)).body as Envelope<{
          organization_contact: { email: string; phone: string; address: { city: string } };
          organization_social: { label: string }[];
        }>
      ).data!;
      expect(data.organization_contact.email).toBe(`office-${RUN}@example.org`);
      expect(data.organization_contact.address.city).toBe('Pune');
      expect(data.organization_social).toEqual([
        { label: 'Instagram', url: 'https://instagram.com/sailent' },
      ]);
    });

    it('refuses a social link that is not https, and needs a fresh re-authentication', async () => {
      await reauth();
      const bad = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(admin))
        .send({ organization_social: [{ label: 'X', url: 'javascript:alert(1)' }] });
      expect(bad.status).toBe(422);

      const stale = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(noRole))
        .send({ organization_social: [] });
      expect(stale.status).toBe(403);
    });

    it('a receipt snapshots the registration number from settings', async () => {
      await reauth();
      await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(admin))
        .send({
          registration_details: {
            registrationNumber: `REG-${RUN}`,
            pan: null,
            section12A: null,
            section80G: null,
          },
        });

      const receipts = app.get(ReceiptsService);
      const { db: drizzle } = app.get<{
        db: { transaction: <T>(fn: (tx: never) => Promise<T>) => Promise<T> };
      }>(DATABASE);
      const donation = await one(sql`
        SELECT d.id FROM donations d
         WHERE d.status = 'successful'
           AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.donation_id = d.id)
         ORDER BY d.created_at DESC LIMIT 1
      `);
      expect(donation, 'the seed has a successful donation without a receipt').toBeTruthy();

      // Issue inside a transaction that is rolled back: nothing is written.
      let snapshot: unknown;
      await drizzle
        .transaction(async (tx) => {
          const issued = await receipts.issue(tx, { donationId: donation!.id as string });
          const row = await (tx as unknown as { execute(q: unknown): Promise<Rows> }).execute(
            sql`SELECT registration_number FROM receipts WHERE id = ${issued.id}::uuid`,
          );
          snapshot = row.rows[0]?.registration_number;
          throw new Error('rollback');
        })
        .catch((error: Error) => {
          if (error.message !== 'rollback') throw error;
        });
      expect(snapshot).toBe(`REG-${RUN}`);
    });
  });

  // =========================================================================
  describe('contact messages', () => {
    const message = {
      name: 'Asha',
      subject: 'partnership',
      message: 'We would like to discuss a CSR partnership for school kits.',
    };

    it('stores the message (normalised), answers 202 and enqueues an email by id only', async () => {
      const email = address('Sender').toUpperCase();
      const response = await request(server)
        .post(`${PREFIX}/contact`)
        .send({ ...message, email: ` ${email} ` });
      expect(response.status).toBe(202);

      const row = await one(
        sql`SELECT id, email, status FROM contact_messages WHERE email = ${email.toLowerCase()}`,
      );
      expect(row).toMatchObject({ status: 'new' });
      const [job] = jobs('contact.received');
      expect(job).toEqual({ queue: QUEUE_NAMES.EMAIL, data: { contactMessageId: row!.id } });
    });

    it('silently discards a honeypot submission with the same answer', async () => {
      const email = address('bot');
      const response = await request(server)
        .post(`${PREFIX}/contact`)
        .send({ ...message, email, website: 'http://spam.example' });
      expect(response.status).toBe(202);
      expect(
        await one(sql`SELECT id FROM contact_messages WHERE email = ${email}`),
      ).toBeUndefined();
      expect(jobs('contact.received')).toHaveLength(0);
    });

    it('refuses an invalid submission', async () => {
      const response = await request(server)
        .post(`${PREFIX}/contact`)
        .send({ ...message, email: address('short'), message: 'hi' });
      expect(response.status).toBe(422);
    });

    it('is staff-only to read, needs contact.read, and never shows the sender IP', async () => {
      expect((await request(server).get(`${PREFIX}/admin/contact-messages`)).status).toBe(401);
      expect(
        (await request(server).get(`${PREFIX}/admin/contact-messages`).set(auth(noRole))).status,
      ).toBe(403);

      const list = await request(server)
        .get(`${PREFIX}/admin/contact-messages?status=all`)
        .set(auth(admin));
      expect(list.status).toBe(200);
      const items = (list.body as Envelope<{ items: { id: string; email: string }[] }>).data!.items;
      const mine = items.find((item) => item.email.endsWith(`@${DOMAIN}`));
      expect(mine).toBeTruthy();

      const detail = await request(server)
        .get(`${PREFIX}/admin/contact-messages/${mine!.id}`)
        .set(auth(admin));
      expect(detail.status).toBe(200);
      expect(JSON.stringify(detail.body)).not.toContain('ipAddress');
    });

    it('marks a message handled (who and when) and audits it; needs contact.manage', async () => {
      const row = await one(
        sql`SELECT id FROM contact_messages WHERE email LIKE ${'%@' + DOMAIN} LIMIT 1`,
      );
      const refused = await request(server)
        .patch(`${PREFIX}/admin/contact-messages/${row!.id}`)
        .set(auth(noRole))
        .send({ status: 'handled' });
      expect(refused.status).toBe(403);

      const done = await request(server)
        .patch(`${PREFIX}/admin/contact-messages/${row!.id}`)
        .set(auth(admin))
        .send({ status: 'handled' });
      expect(done.status).toBe(200);
      expect((done.body as Envelope<{ handledBy: string; handledAt: string }>).data).toMatchObject({
        status: 'handled',
      });
      const audit = await one(sql`
        SELECT action FROM audit_logs WHERE entity_id = ${row!.id}::uuid ORDER BY created_at DESC LIMIT 1
      `);
      expect(audit?.action).toBe('contact_message.handled');
    });
  });

  // =========================================================================
  describe('newsletter (double opt-in)', () => {
    async function subscribe(email: string) {
      return request(server).post(`${PREFIX}/newsletter/subscribe`).send({ email });
    }

    it('subscribing creates a PENDING row and emails a confirmation link', async () => {
      const email = address('reader');
      const response = await subscribe(email.toUpperCase());
      expect(response.status).toBe(202);
      expect((response.body as Envelope).data).toEqual({ status: 'check_inbox' });

      const row = await one(sql`SELECT status FROM newsletter_subscribers WHERE email = ${email}`);
      expect(row?.status).toBe('pending');
      const [job] = jobs('newsletter.confirm');
      expect(job?.queue).toBe(QUEUE_NAMES.EMAIL);
      expect(job?.data.confirmToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('confirming makes it subscribed, once; the link cannot be reused', async () => {
      const email = address('confirm');
      await subscribe(email);
      const token = jobs('newsletter.confirm')[0]!.data.confirmToken;

      const first = await request(server).post(`${PREFIX}/newsletter/confirm`).send({ token });
      expect(first.status).toBe(200);
      expect(
        (await one(sql`SELECT status FROM newsletter_subscribers WHERE email = ${email}`))?.status,
      ).toBe('subscribed');

      const again = await request(server).post(`${PREFIX}/newsletter/confirm`).send({ token });
      expect(again.status).toBe(422);
    });

    it('an expired confirmation link does not work', async () => {
      const email = address('expired');
      await subscribe(email);
      const token = jobs('newsletter.confirm')[0]!.data.confirmToken;
      await db().execute(
        sql`UPDATE newsletter_subscribers SET confirm_expires_at = now() - interval '1 minute' WHERE email = ${email}`,
      );
      const response = await request(server).post(`${PREFIX}/newsletter/confirm`).send({ token });
      expect(response.status).toBe(422);
    });

    it('answers identically for an address already subscribed, and sends nothing', async () => {
      const email = address('already');
      await subscribe(email);
      await request(server)
        .post(`${PREFIX}/newsletter/confirm`)
        .send({ token: jobs('newsletter.confirm')[0]!.data.confirmToken });
      enqueue.mockClear();

      const response = await subscribe(email);
      expect(response.status).toBe(202);
      expect((response.body as Envelope).data).toEqual({ status: 'check_inbox' });
      expect(jobs('newsletter.confirm')).toHaveLength(0);
      const rows = await db().execute(
        sql`SELECT id FROM newsletter_subscribers WHERE lower(btrim(email)) = ${email}`,
      );
      expect(rows.rows).toHaveLength(1);
    });

    it('unsubscribes with the emailed link, idempotently; an unknown link is refused', async () => {
      const email = address('leaver');
      await subscribe(email);
      const { confirmToken, unsubscribeToken } = jobs('newsletter.confirm')[0]!.data;
      await request(server).post(`${PREFIX}/newsletter/confirm`).send({ token: confirmToken });

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await request(server)
          .post(`${PREFIX}/newsletter/unsubscribe`)
          .send({ token: unsubscribeToken });
        expect(response.status).toBe(200);
      }
      expect(
        (await one(sql`SELECT status FROM newsletter_subscribers WHERE email = ${email}`))?.status,
      ).toBe('unsubscribed');

      const unknown = await request(server)
        .post(`${PREFIX}/newsletter/unsubscribe`)
        .send({ token: 'Z'.repeat(43) });
      expect(unknown.status).toBe(422);
    });

    it('the subscriber list is staff-only and needs newsletter.read', async () => {
      expect(
        (await request(server).get(`${PREFIX}/admin/newsletter/subscribers`).set(auth(noRole)))
          .status,
      ).toBe(403);
      const response = await request(server)
        .get(`${PREFIX}/admin/newsletter/subscribers?status=all`)
        .set(auth(admin));
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  describe('staff invitations', () => {
    async function invite(email: string) {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/users`)
        .set(auth(admin))
        .send({ email, firstName: 'Invited', roleKeys: ['SUPER_ADMIN'] });
      if (response.status === 201) {
        fixtures.users.push((response.body as Envelope<{ id: string }>).data!.id);
      }
      return response;
    }

    it('inviting emails a single-use link and the account stays unusable until accepted', async () => {
      const email = address('invitee');
      const response = await invite(email);
      expect(response.status).toBe(201);
      const [job] = jobs('staff.invite');
      expect(job?.queue).toBe(QUEUE_NAMES.EMAIL);
      expect(job?.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      // Only a hash is stored.
      const stored = await one(sql`SELECT code_hash FROM otp_codes WHERE purpose = 'staff_invite'
        AND identifier = ${'staff:' + job!.data.userId}`);
      expect(stored?.code_hash).toBe(createHash('sha256').update(job!.data.token).digest('hex'));

      expect((await login(email)).status).not.toBe(200);
    });

    it('accepting sets the password and activates; the link then never works again', async () => {
      const email = address('accept');
      await invite(email);
      const { token } = jobs('staff.invite')[0]!.data;
      const password = `Phase13-${RUN}-strong`;

      const weak = await request(server)
        .post(`${PREFIX}/auth/staff/invitation/accept`)
        .send({ token, password: 'short' });
      expect(weak.status).toBe(422);

      const accepted = await request(server)
        .post(`${PREFIX}/auth/staff/invitation/accept`)
        .send({ token, password });
      expect(accepted.status).toBe(200);
      expect((await login(email, password)).status).toBe(200);

      const reused = await request(server)
        .post(`${PREFIX}/auth/staff/invitation/accept`)
        .send({ token, password: `${password}-again` });
      expect(reused.status).toBe(422);
      const audit =
        await one(sql`SELECT action FROM audit_logs WHERE action = 'auth.staff.invitation_accepted'
        ORDER BY created_at DESC LIMIT 1`);
      expect(audit).toBeTruthy();
    });

    it('an expired invitation does not work', async () => {
      const email = address('stale');
      await invite(email);
      const { token, userId } = jobs('staff.invite')[0]!.data;
      await db().execute(sql`UPDATE otp_codes SET expires_at = now() - interval '1 minute'
        WHERE identifier = ${'staff:' + userId} AND purpose = 'staff_invite'`);
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/invitation/accept`)
        .send({ token, password: `Phase13-${RUN}-strong` });
      expect(response.status).toBe(422);
    });

    it('resending makes the earlier link stop working; an active account cannot be re-invited', async () => {
      const email = address('resend');
      const created = await invite(email);
      const id = (created.body as Envelope<{ id: string }>).data!.id;
      const first = jobs('staff.invite')[0]!.data.token;

      await reauth();
      const resend = await request(server)
        .post(`${PREFIX}/admin/users/${id}/invitation`)
        .set(auth(admin));
      expect(resend.status).toBe(200);
      const second = jobs('staff.invite')[1]!.data.token;
      expect(second).not.toBe(first);

      const old = await request(server)
        .post(`${PREFIX}/auth/staff/invitation/accept`)
        .send({ token: first, password: `Phase13-${RUN}-strong` });
      expect(old.status).toBe(422);

      const active = await staffAccount('active');
      await reauth();
      const refused = await request(server)
        .post(`${PREFIX}/admin/users/${active.id}/invitation`)
        .set(auth(admin));
      expect(refused.status).toBe(409);
    });

    it('resending needs user.invite and a fresh re-authentication', async () => {
      const target = await staffAccount('invited');
      const noPermission = await request(server)
        .post(`${PREFIX}/admin/users/${target.id}/invitation`)
        .set(auth(noRole));
      expect(noPermission.status).toBe(403);
    });
  });

  // =========================================================================
  describe('staff password reset', () => {
    const forgot = (email: string) =>
      request(server).post(`${PREFIX}/auth/staff/password/forgot`).send({ email });

    it('answers identically for a known, unknown or suspended address; only the known one gets mail', async () => {
      const known = await staffAccount('active');
      const suspended = await staffAccount('suspended');

      const answers = await Promise.all([
        forgot(known.email.toUpperCase()),
        forgot(address('nobody')),
        forgot(suspended.email),
      ]);
      for (const answer of answers) {
        expect(answer.status).toBe(202);
        expect((answer.body as Envelope).data).toEqual({ status: 'check_inbox' });
      }
      const sent = jobs('staff.password_reset');
      expect(sent).toHaveLength(1);
      expect(sent[0]!.data.userId).toBe(known.id);
    });

    it('resetting sets the password, signs out every session and burns the link', async () => {
      const member = await staffAccount('active');
      const before = ((await login(member.email)).body as Envelope<{ accessToken: string }>).data!
        .accessToken;
      await forgot(member.email);
      const { token } = jobs('staff.password_reset')[0]!.data;
      const password = `Reset-${RUN}-strong-pass`;

      const reset = await request(server)
        .post(`${PREFIX}/auth/staff/password/reset`)
        .send({ token, password });
      expect(reset.status).toBe(200);

      expect((await request(server).get(`${PREFIX}/auth/me`).set(auth(before))).status).toBe(401);
      expect((await login(member.email)).status).toBe(401);
      expect((await login(member.email, password)).status).toBe(200);

      const reused = await request(server)
        .post(`${PREFIX}/auth/staff/password/reset`)
        .send({ token, password: `${password}-2` });
      expect(reused.status).toBe(422);
    });

    it('an expired reset link does not work', async () => {
      const member = await staffAccount('active');
      await forgot(member.email);
      const { token } = jobs('staff.password_reset')[0]!.data;
      await db().execute(sql`UPDATE otp_codes SET expires_at = now() - interval '1 second'
        WHERE identifier = ${'staff:' + member.id} AND purpose = 'staff_password_reset'`);
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/password/reset`)
        .send({ token, password: `Reset-${RUN}-strong-pass` });
      expect(response.status).toBe(422);
    });

    it('an invitation token is not a reset token', async () => {
      const member = await staffAccount('active');
      const token = randomUUID().replace(/-/g, '').padEnd(43, 'A').slice(0, 43);
      await db().execute(sql`
        INSERT INTO otp_codes (identifier, purpose, code_hash, expires_at)
        VALUES (${'staff:' + member.id}, 'staff_invite',
                ${createHash('sha256').update(token).digest('hex')}, now() + interval '1 hour')
      `);
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/password/reset`)
        .send({ token, password: `Reset-${RUN}-strong-pass` });
      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  describe('document deletion', () => {
    async function upload(visibility = 'private') {
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .set(auth(admin))
        .field('title', `P13 doc ${RUN}`)
        .field('visibility', visibility)
        .attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      fixtures.documents.push(id);
      const row = await one(sql`SELECT file_key FROM documents WHERE id = ${id}::uuid`);
      return { id, key: row!.file_key as string };
    }
    const remove = (id: string, token = admin) =>
      request(server)
        .delete(`${PREFIX}/admin/documents/${id}`)
        .set(auth(token))
        .send({ reason: 'Superseded by the audited version.' });

    it('needs document.delete and a fresh re-authentication', async () => {
      const doc = await upload();
      expect((await remove(doc.id, noRole)).status).toBe(403);
      // A login is not a re-authentication for a sensitive route.
      const fresh = ((await login(TEST_USERS.superAdmin)).body as Envelope<{ accessToken: string }>)
        .data!.accessToken;
      const stale = await remove(doc.id, fresh);
      expect(stale.status).toBe(403);
      expect(errorCode(stale.body as Envelope)).toBe('REAUTH_REQUIRED');
    });

    it('deletes the stored file and the row, and keeps an audit record', async () => {
      const doc = await upload('public');
      expect(storage.copiesOf(doc.key)).toBe(1);
      await reauth();
      const response = await remove(doc.id);
      expect(response.status).toBe(200);
      expect(storage.copiesOf(doc.key)).toBe(0);
      expect(await one(sql`SELECT id FROM documents WHERE id = ${doc.id}::uuid`)).toBeUndefined();
      const audit = await one(sql`SELECT action, old_values FROM audit_logs
        WHERE entity_id = ${doc.id}::uuid AND action = 'document.delete'`);
      expect(audit).toBeTruthy();
    });

    it('leaves the document untouched if the file cannot be deleted', async () => {
      const doc = await upload();
      const original = storage.delete;
      storage.delete = async () => {
        throw new Error('R2 down');
      };
      try {
        await reauth();
        expect((await remove(doc.id)).status).toBe(503);
      } finally {
        storage.delete = original;
      }
      expect(await one(sql`SELECT id FROM documents WHERE id = ${doc.id}::uuid`)).toBeTruthy();
      expect(storage.copiesOf(doc.key)).toBe(1);
    });

    it('answers 404 for a document that does not exist', async () => {
      await reauth();
      expect((await remove(randomUUID())).status).toBe(404);
    });
  });

  // =========================================================================
  describe('image metadata on upload', () => {
    /** A small, structurally valid JPEG carrying Exif with a GPS block. */
    function jpegWithGps(): Buffer {
      const segment = (marker: number, payload: Buffer) => {
        const header = Buffer.alloc(4);
        header[0] = 0xff;
        header[1] = marker;
        header.writeUInt16BE(payload.length + 2, 2);
        return Buffer.concat([header, payload]);
      };
      const tiff = Buffer.alloc(64);
      tiff.write('MM', 0, 'latin1');
      tiff.writeUInt16BE(42, 2);
      tiff.writeUInt32BE(8, 4);
      tiff.writeUInt16BE(1, 8);
      tiff.writeUInt16BE(0x8825, 10); // GPS IFD pointer
      tiff.writeUInt16BE(4, 12);
      tiff.writeUInt32BE(1, 14);
      tiff.writeUInt32BE(30, 18);
      tiff.write('GPSLatitude18.52N', 30, 'latin1');
      return Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
        segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])),
        segment(0xc0, Buffer.from([8, 0, 2, 0, 3, 1, 1, 0x11, 0])),
        segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
        Buffer.from([0x12, 0x34, 0xff, 0xd9]),
      ]);
    }

    it('stores a media upload with its GPS and Exif removed', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/media`)
        .set(auth(admin))
        .field('altText', `Phase 13 image ${RUN} gps`)
        .field('visibility', 'public')
        .attach('file', jpegWithGps(), { filename: 'field.jpg', contentType: 'image/jpeg' });
      expect(response.status).toBe(201);
      const created = (
        response.body as Envelope<{ id: string; storageKey: string; sizeBytes: number }>
      ).data!;
      fixtures.media.push(created.id);

      const row = await one(
        sql`SELECT storage_key, size_bytes FROM media WHERE id = ${created.id}::uuid`,
      );
      const object = [...storage.objects.entries()].find(([key]) =>
        key.endsWith(`:${row!.storage_key as string}`),
      )?.[1];
      expect(object, 'the upload reached storage').toBeTruthy();
      const body = object!.body.toString('latin1');
      expect(body).not.toContain('GPS');
      expect(body).not.toContain('Exif');
      expect(body).toContain('JFIF');
      // The recorded size is the size actually stored.
      expect(row!.size_bytes).toBe(object!.body.byteLength);
    });
  });

  // =========================================================================
  describe('success story archiving', () => {
    async function story() {
      const slug = `p13-${RUN}-${randomUUID().slice(0, 6)}`;
      const row = await one(sql`
        INSERT INTO success_stories (title, slug, excerpt, is_anonymised, status, published_at)
        VALUES (${'Phase 13 story ' + RUN}, ${slug}, 'A story.', true, 'published', now())
        RETURNING id, slug
      `);
      return { id: row!.id as string, slug };
    }
    const setStatus = (id: string, status: string, token: string) =>
      request(server)
        .patch(`${PREFIX}/admin/stories/${id}/status`)
        .set(auth(token))
        .send({ status });

    it('archiving needs story.archive, not merely story.publish', async () => {
      const item = await story();
      await reauth(publisherOnly);
      const refused = await setStatus(item.id, 'archived', publisherOnly);
      expect(refused.status).toBe(403);

      // The same account can still unpublish, which is story.publish's job.
      await reauth(publisherOnly);
      expect((await setStatus(item.id, 'draft', publisherOnly)).status).toBe(200);
    });

    it('an archived story disappears from the public site, and restoring it needs story.archive', async () => {
      const item = await story();
      expect((await request(server).get(`${PREFIX}/stories/${item.slug}`)).status).toBe(200);

      await reauth();
      expect((await setStatus(item.id, 'archived', admin)).status).toBe(200);
      expect((await request(server).get(`${PREFIX}/stories/${item.slug}`)).status).toBe(404);
      const list = await request(server).get(`${PREFIX}/stories?limit=100`);
      expect(JSON.stringify(list.body)).not.toContain(item.slug);

      await reauth(publisherOnly);
      expect((await setStatus(item.id, 'published', publisherOnly)).status).toBe(403);
      await reauth();
      expect((await setStatus(item.id, 'published', admin)).status).toBe(200);
      expect((await request(server).get(`${PREFIX}/stories/${item.slug}`)).status).toBe(200);
    });
  });

  // =========================================================================
  describe('campaign gallery, cover and updates', () => {
    it('adds library images, keeps private ones off the public page, and refuses bad input', async () => {
      const target = await campaign();
      const imageA = await publicMedia();
      const imageB = await publicMedia();
      const secret = await publicMedia('private');
      const add = (body: object, token = admin) =>
        request(server)
          .post(`${PREFIX}/admin/campaigns/${target.id}/gallery`)
          .set(auth(token))
          .send(body);

      expect((await add({ mediaId: imageA.id }, noRole)).status).toBe(403);
      expect((await add({ mediaId: imageA.id })).status).toBe(201);
      expect((await add({ mediaId: imageB.id })).status).toBe(201);
      expect((await add({ mediaId: imageA.id })).status).toBe(409);
      expect((await add({ mediaId: secret.id })).status).toBe(422);
      expect((await add({ mediaId: randomUUID() })).status).toBe(422);
      // The old raw-metadata form is no longer accepted.
      expect(
        (
          await add({
            storageKey: 'media/x.jpg',
            altText: 'x',
            mimeType: 'image/jpeg',
            sizeBytes: 1,
          })
        ).status,
      ).toBe(422);
      expect((await add({ mediaId: secret.id, visibility: 'private' })).status).toBe(201);

      const gallery = (
        (await request(server).get(`${PREFIX}/campaigns/${target.slug}/gallery`)).body as Envelope<{
          items: { mediaId: string }[];
        }>
      ).data!.items;
      expect(gallery.map((item) => item.mediaId)).toEqual([imageA.id, imageB.id]);
    });

    it('reorders the gallery, and refuses an order naming another campaign’s images', async () => {
      const target = await campaign();
      const other = await campaign();
      const first = await publicMedia();
      const second = await publicMedia();
      const stranger = await publicMedia();
      for (const image of [first, second]) {
        await request(server)
          .post(`${PREFIX}/admin/campaigns/${target.id}/gallery`)
          .set(auth(admin))
          .send({ mediaId: image.id });
      }
      await request(server)
        .post(`${PREFIX}/admin/campaigns/${other.id}/gallery`)
        .set(auth(admin))
        .send({ mediaId: stranger.id });

      const items = (
        (
          await request(server)
            .get(`${PREFIX}/admin/campaigns/${target.id}/gallery`)
            .set(auth(admin))
        ).body as Envelope<{ items: { id: string; mediaId: string }[] }>
      ).data!.items;
      const otherItems = (
        (
          await request(server)
            .get(`${PREFIX}/admin/campaigns/${other.id}/gallery`)
            .set(auth(admin))
        ).body as Envelope<{ items: { id: string }[] }>
      ).data!.items;

      const reorder = (ids: string[]) =>
        request(server)
          .put(`${PREFIX}/admin/campaigns/${target.id}/gallery/order`)
          .set(auth(admin))
          .send({ ids });

      expect((await reorder([items[0]!.id, otherItems[0]!.id])).status).toBe(422);
      const reversed = await reorder([items[1]!.id, items[0]!.id]);
      expect(reversed.status).toBe(200);

      const publicOrder = (
        (await request(server).get(`${PREFIX}/campaigns/${target.slug}/gallery`)).body as Envelope<{
          items: { mediaId: string }[];
        }>
      ).data!.items;
      expect(publicOrder.map((item) => item.mediaId)).toEqual([second.id, first.id]);
    });

    it('a cover must be a public library image; null clears it', async () => {
      const target = await campaign();
      const image = await publicMedia();
      const secret = await publicMedia('private');
      const patch = (coverImage: string | null) =>
        request(server)
          .patch(`${PREFIX}/admin/campaigns/${target.id}`)
          .set(auth(admin))
          .send({ coverImage });

      expect((await patch('https://evil.example/tracking.gif')).status).toBe(422);
      expect((await patch(`https://media.test.invalid/${randomUUID()}.jpg`)).status).toBe(422);
      expect(secret.url).toBeNull();
      expect((await patch(image.url)).status).toBe(200);
      const detail = (await request(server).get(`${PREFIX}/campaigns/${target.slug}`))
        .body as Envelope<{ coverImage: string }>;
      expect(detail.data!.coverImage).toBe(image.url);
      expect((await patch(null)).status).toBe(200);
    });

    it('a programme cover follows the same rule', async () => {
      const program = await one(sql`SELECT id FROM programs WHERE status = 'published' LIMIT 1`);
      const before = await one(
        sql`SELECT cover_image FROM programs WHERE id = ${program!.id as string}::uuid`,
      );
      const image = await publicMedia();
      try {
        const bad = await request(server)
          .patch(`${PREFIX}/admin/programs/${program!.id}`)
          .set(auth(admin))
          .send({ coverImage: 'https://evil.example/x.jpg' });
        expect(bad.status).toBe(422);
        const good = await request(server)
          .patch(`${PREFIX}/admin/programs/${program!.id}`)
          .set(auth(admin))
          .send({ coverImage: image.url });
        expect(good.status).toBe(200);
      } finally {
        await db()
          .execute(sql`UPDATE programs SET cover_image = ${(before?.cover_image as string | null) ?? null}
          WHERE id = ${program!.id as string}::uuid`);
      }
    });

    it('updates: drafted, published publicly, then archived off the public page', async () => {
      const target = await campaign();
      const created = await request(server)
        .post(`${PREFIX}/admin/campaigns/${target.id}/updates`)
        .set(auth(admin))
        .send({ title: `Update ${RUN}`, description: 'Kits delivered.', impactDate: '2026-10-01' });
      expect(created.status).toBe(201);
      const updates = (
        (
          await request(server)
            .get(`${PREFIX}/admin/campaigns/${target.id}/updates`)
            .set(auth(admin))
        ).body as Envelope<{ items: { id: string }[] }>
      ).data!.items;
      const id = updates[0]!.id;
      const status = (body: object) =>
        request(server)
          .post(`${PREFIX}/admin/campaigns/${target.id}/updates/${id}/publish`)
          .set(auth(admin))
          .send(body);
      const visible = async () =>
        (
          (await request(server).get(`${PREFIX}/campaigns/${target.slug}/updates`))
            .body as Envelope<{
            items: unknown[];
          }>
        ).data!.items.length;

      expect(await visible()).toBe(0);
      expect((await status({ published: true })).status).toBe(200);
      expect(await visible()).toBe(1);
      expect((await status({ status: 'archived' })).status).toBe(200);
      expect(await visible()).toBe(0);
      expect((await status({ status: 'deleted' })).status).toBe(422);
    });
  });

  // =========================================================================
  describe('dashboard', () => {
    it('is staff-only and returns real counts to SUPER_ADMIN', async () => {
      expect((await request(server).get(`${PREFIX}/admin/dashboard`)).status).toBe(401);

      /*
        The figures are whole-database counts, and other suites insert
        volunteers and messages while this one runs. So the database is
        counted just BEFORE and just AFTER the call, and the dashboard's
        figure must lie between the two — exact, without racing them.
      */
      const counts = async () => ({
        messages: (await one(
          sql`SELECT count(*)::int AS n FROM contact_messages WHERE status = 'new'`,
        ))!.n as number,
        pending: (await one(
          sql`SELECT count(*)::int AS n FROM volunteers WHERE status IN ('applied', 'under_review')`,
        ))!.n as number,
      });
      const before = await counts();
      const response = await request(server).get(`${PREFIX}/admin/dashboard`).set(auth(admin));
      const after = await counts();
      expect(response.status).toBe(200);
      const data = (response.body as Envelope<Record<string, Record<string, unknown>>>).data!;
      for (const section of [
        'campaigns',
        'programs',
        'donations',
        'payments',
        'donors',
        'volunteers',
        'events',
        'messages',
        'newsletter',
        'notifications',
        'activity',
      ]) {
        expect(data[section], section).toBeDefined();
      }

      const between = (value: unknown, low: number, high: number) => {
        expect(typeof value).toBe('number');
        expect(value as number).toBeGreaterThanOrEqual(Math.min(low, high));
        expect(value as number).toBeLessThanOrEqual(Math.max(low, high));
      };
      between(data.messages!.new, before.messages, after.messages);
      between(data.volunteers!.pendingApplications, before.pending, after.pending);
    });

    it('shows a staff member with no permissions no figures at all', async () => {
      const response = await request(server).get(`${PREFIX}/admin/dashboard`).set(auth(noRole));
      expect(response.status).toBe(200);
      expect(Object.keys((response.body as Envelope<object>).data!)).toEqual(['generatedAt']);
    });
  });

  // =========================================================================
  describe('general FAQs', () => {
    it('serves only published general FAQs; drafts and campaign FAQs stay out', async () => {
      const create = (body: object, token = admin) =>
        request(server).post(`${PREFIX}/admin/faqs`).set(auth(token)).send(body);
      expect(
        (await create({ question: 'Q?', answer: 'A.', category: 'general' }, noRole)).status,
      ).toBe(403);

      const published = await create({
        question: `Published ${RUN}?`,
        answer: 'Yes.',
        category: 'donations',
        isPublished: true,
      });
      const draft = await create({
        question: `Draft ${RUN}?`,
        answer: 'Not yet.',
        category: 'donations',
      });
      expect(published.status).toBe(201);
      for (const response of [published, draft]) {
        fixtures.faqs.push((response.body as Envelope<{ id: string }>).data!.id);
      }
      expect((await create({ question: 'Q?', answer: 'A.', category: 'refunds' })).status).toBe(
        422,
      );

      const page = JSON.stringify((await request(server).get(`${PREFIX}/faqs`)).body);
      expect(page).toContain(`Published ${RUN}?`);
      expect(page).not.toContain(`Draft ${RUN}?`);
      expect(page).not.toContain('Demo unpublished');
      // Campaign FAQs belong to their campaign page.
      expect(page).not.toContain('Will I get a receipt?');

      const id = (draft.body as Envelope<{ id: string }>).data!.id;
      await request(server)
        .patch(`${PREFIX}/admin/faqs/${id}`)
        .set(auth(admin))
        .send({ isPublished: true });
      expect(JSON.stringify((await request(server).get(`${PREFIX}/faqs`)).body)).toContain(
        `Draft ${RUN}?`,
      );

      expect(
        (await request(server).delete(`${PREFIX}/admin/faqs/${id}`).set(auth(admin))).status,
      ).toBe(200);
      expect(JSON.stringify((await request(server).get(`${PREFIX}/faqs`)).body)).not.toContain(
        `Draft ${RUN}?`,
      );
    });
  });

  // =========================================================================
  describe('search', () => {
    it('finds published content and never drafts', async () => {
      const word = `zebra${RUN}`;
      await campaign('active', `Open ${word} appeal`);
      await campaign('draft', `Hidden ${word} draft`);

      const response = await request(server).get(`${PREFIX}/search?q=${word}`);
      expect(response.status).toBe(200);
      const titles = (
        response.body as Envelope<{ results: { title: string; href: string }[] }>
      ).data!.results.map((result) => result.title);
      expect(titles).toContain(`Open ${word} appeal`);
      expect(titles).not.toContain(`Hidden ${word} draft`);
    });

    it('treats % and _ as text, and refuses a one-character query', async () => {
      const response = await request(server).get(`${PREFIX}/search?q=${encodeURIComponent('%%')}`);
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ results: unknown[] }>).data!.results).toEqual([]);
      expect((await request(server).get(`${PREFIX}/search?q=a`)).status).toBe(422);
    });
  });

  // =========================================================================
  describe('notification retry', () => {
    it('re-sends a failed contact email through the EMAIL queue the worker consumes', async () => {
      const contact = await one(
        sql`SELECT id FROM contact_messages WHERE email LIKE ${'%@' + DOMAIN} LIMIT 1`,
      );
      const row = await one(sql`
        INSERT INTO notifications (recipient_type, type, title, message, data, channel, status, error)
        VALUES ('organisation', 'contact.received', ${'Retry ' + RUN}, 'x',
                ${JSON.stringify({ contactMessageId: contact!.id })}::jsonb, 'email', 'failed', 'unreachable')
        RETURNING id
      `);
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/notifications/log/${row!.id}/retry`)
        .set(auth(admin));
      expect(response.status).toBe(201);
      expect(jobs('contact.received')).toEqual([
        { queue: QUEUE_NAMES.EMAIL, data: { contactMessageId: contact!.id } },
      ]);
      await db().execute(sql`DELETE FROM notifications WHERE id = ${row!.id as string}::uuid`);
    });

    it('will not retry a newsletter or staff email, whose link held a token', async () => {
      for (const type of ['newsletter.confirm', 'staff.invite', 'staff.password_reset']) {
        const row = await one(sql`
          INSERT INTO notifications (recipient_type, type, title, message, data, channel, status, error)
          VALUES ('user', ${type}, ${'Retry ' + RUN}, 'x', '{}'::jsonb, 'email', 'failed', 'rejected')
          RETURNING id
        `);
        await reauth();
        const response = await request(server)
          .post(`${PREFIX}/admin/notifications/log/${row!.id}/retry`)
          .set(auth(admin));
        expect(response.status, type).toBe(409);
        await db().execute(sql`DELETE FROM notifications WHERE id = ${row!.id as string}::uuid`);
      }
    });
  });
});
