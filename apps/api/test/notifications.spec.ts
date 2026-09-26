import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import {
  PREFIX,
  TEST_PASSWORD,
  TEST_USERS,
  createTestApp,
  devTotpCode,
  errorCode,
  type Envelope,
} from './harness.js';

/**
 * Notifications: the inbox, the send log and the templates.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO PROPERTIES CARRY THIS PHASE, AND BOTH ARE ABOUT CONTAINMENT.
 *
 * 1. AN ADMINISTRATOR SEES THEIR OWN INBOX AND NOBODY ELSE'S. The scoping is
 *    a WHERE clause on `user_id`, so there is no id to tamper with — but a
 *    test that only reads its own feed would pass whether or not that were
 *    true. So one is written directly into another user's name and the feed is
 *    checked for its absence.
 *
 * 2. A TEMPLATE CANNOT BE EDITED INTO AN INJECTION. `{{{name}}}` inserts
 *    without escaping, and turning `{{donorName}}` into `{{{donorName}}}` is a
 *    one-character edit that reads as a formatting tweak. The API refuses it,
 *    and this asserts the refusal rather than the documentation of it.
 * ══════════════════════════════════════════════════════════════════════════
 */
const STAMP = randomUUID().slice(0, 8);

describe('Notifications (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;
  let staffId: string;

  const db = () =>
    app.get<{
      db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> };
    }>(DATABASE).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** The retry is `@Sensitive()`; a fresh login is not a re-authentication. */
  async function reauth() {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(staff))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  /** Write a log row directly — the worker is what normally produces these. */
  async function seedLogRow(
    overrides: {
      type?: string;
      status?: string;
      channel?: string;
      userId?: string | null;
      data?: string;
      title?: string;
    } = {},
  ): Promise<string> {
    const rows = (
      await db().execute(sql`
        INSERT INTO notifications
          (recipient_type, user_id, type, title, message, data, channel, status, error)
        VALUES (
          ${overrides.userId ? 'user' : 'donor'},
          ${overrides.userId ?? null}::uuid,
          ${overrides.type ?? `test.${STAMP}`},
          ${overrides.title ?? `Test ${STAMP}`},
          ${'A message'},
          ${overrides.data ?? null}::jsonb,
          ${overrides.channel ?? 'email'},
          ${overrides.status ?? 'failed'},
          ${'unreachable'}
        )
        RETURNING id
      `)
    ).rows!;
    return rows[0]!.id as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });

    const body = login.body as Envelope<{ accessToken: string; actor: { id: string } }>;
    staff = body.data!.accessToken;
    staffId = body.data!.actor.id;
  }, 60_000);

  afterAll(async () => {
    await db().execute(sql`DELETE FROM notifications WHERE title LIKE ${'%' + STAMP + '%'}`);
    await db().execute(sql`DELETE FROM notifications WHERE type LIKE ${'test.' + STAMP + '%'}`);
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated inbox', async () => {
      expect((await request(server).get(`${PREFIX}/admin/notifications`)).status).toBe(401);
    });

    it('refuses an unauthenticated send log', async () => {
      expect((await request(server).get(`${PREFIX}/admin/notifications/log`)).status).toBe(401);
    });

    it('refuses an unauthenticated template list', async () => {
      expect((await request(server).get(`${PREFIX}/admin/notification-templates`)).status).toBe(
        401,
      );
    });

    it('refuses a token that is not a staff token', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/notifications/log`)
        .set({ Authorization: 'Bearer not-a-staff-token' });
      expect(response.status).toBe(401);
    });

    it('has NO public route', async () => {
      for (const path of ['/notifications', '/notification-templates']) {
        expect((await request(server).get(`${PREFIX}${path}`)).status).toBe(404);
      }
    });
  });

  // =========================================================================
  describe('the inbox', () => {
    it('returns this administrator’s in-app notifications', async () => {
      await seedLogRow({
        userId: staffId,
        channel: 'in_app',
        status: 'sent',
        title: `Inbox ${STAMP}`,
      });

      const response = await request(server).get(`${PREFIX}/admin/notifications`).set(auth(staff));
      expect(response.status).toBe(200);

      const body = response.body as Envelope<{ items: { title: string }[] }>;
      expect(body.data!.items.some((item) => item.title === `Inbox ${STAMP}`)).toBe(true);
    });

    it('NEVER returns another administrator’s notifications', async () => {
      /*
        The property that matters. Written straight into the table in somebody
        else's name, so the only thing that can exclude it is the `user_id`
        predicate in the query.
      */
      const otherUser = (
        await db().execute(
          sql`SELECT id FROM users WHERE id <> ${staffId}::uuid AND status = 'active' LIMIT 1`,
        )
      ).rows![0];

      if (!otherUser) return; // Only one staff account in this database.

      await seedLogRow({
        userId: otherUser.id as string,
        channel: 'in_app',
        status: 'sent',
        title: `Someone else ${STAMP}`,
      });

      const response = await request(server)
        .get(`${PREFIX}/admin/notifications`)
        .set(auth(staff))
        .query({ pageSize: 50 });

      const body = response.body as Envelope<{ items: { title: string }[] }>;
      expect(body.data!.items.some((item) => item.title === `Someone else ${STAMP}`)).toBe(false);
    });

    it('excludes EMAIL rows from the inbox — the log is a different screen', async () => {
      await seedLogRow({ userId: staffId, channel: 'email', title: `Not inbox ${STAMP}` });

      const response = await request(server)
        .get(`${PREFIX}/admin/notifications`)
        .set(auth(staff))
        .query({ pageSize: 50 });

      const body = response.body as Envelope<{ items: { title: string }[] }>;
      expect(body.data!.items.some((item) => item.title === `Not inbox ${STAMP}`)).toBe(false);
    });

    it('counts the unread', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/notifications/unread-count`)
        .set(auth(staff));

      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ unread: number }>).data!.unread).toBeGreaterThan(0);
    });

    it('marks one read, and the count falls', async () => {
      const id = await seedLogRow({
        userId: staffId,
        channel: 'in_app',
        status: 'sent',
        title: `To read ${STAMP}`,
      });

      const before = (
        (await request(server).get(`${PREFIX}/admin/notifications/unread-count`).set(auth(staff)))
          .body as Envelope<{ unread: number }>
      ).data!.unread;

      expect(
        (await request(server).patch(`${PREFIX}/admin/notifications/${id}/read`).set(auth(staff)))
          .status,
      ).toBe(200);

      const after = (
        (await request(server).get(`${PREFIX}/admin/notifications/unread-count`).set(auth(staff)))
          .body as Envelope<{ unread: number }>
      ).data!.unread;

      expect(after).toBe(before - 1);
    });

    it('REFUSES to mark somebody else’s notification read', async () => {
      const otherUser = (
        await db().execute(
          sql`SELECT id FROM users WHERE id <> ${staffId}::uuid AND status = 'active' LIMIT 1`,
        )
      ).rows![0];

      if (!otherUser) return;

      const id = await seedLogRow({
        userId: otherUser.id as string,
        channel: 'in_app',
        status: 'sent',
        title: `Theirs ${STAMP}`,
      });

      // 404, not 403: "forbidden" would confirm the id names something real.
      const response = await request(server)
        .patch(`${PREFIX}/admin/notifications/${id}/read`)
        .set(auth(staff));
      expect(response.status).toBe(404);

      const [row] = (
        await db().execute(sql`SELECT read_at FROM notifications WHERE id = ${id}::uuid`)
      ).rows!;
      expect(row!.read_at).toBeNull();
    });

    it('marks everything read at once', async () => {
      await seedLogRow({
        userId: staffId,
        channel: 'in_app',
        status: 'sent',
        title: `Bulk ${STAMP}`,
      });

      const response = await request(server)
        .post(`${PREFIX}/admin/notifications/read-all`)
        .set(auth(staff));
      expect(response.status).toBe(201);

      const after = (
        (await request(server).get(`${PREFIX}/admin/notifications/unread-count`).set(auth(staff)))
          .body as Envelope<{ unread: number }>
      ).data!.unread;
      expect(after).toBe(0);
    });
  });

  // =========================================================================
  describe('the send log', () => {
    it('lists sends with their delivery status', async () => {
      await seedLogRow({ type: `test.${STAMP}.log`, status: 'failed', title: `Logged ${STAMP}` });

      const response = await request(server)
        .get(`${PREFIX}/admin/notifications/log`)
        .set(auth(staff))
        .query({ type: `test.${STAMP}.log` });

      expect(response.status).toBe(200);
      const body = response.body as Envelope<{
        items: { status: string; retryCount: number; error: string }[];
      }>;
      expect(body.data!.items.length).toBe(1);
      expect(body.data!.items[0]!.status).toBe('failed');
      expect(body.data!.items[0]!.error).toBe('unreachable');
      // The column exists and is not null, which is what "visible to admins" needs.
      expect(body.data!.items[0]!.retryCount).toBe(0);
    });

    it('filters by status', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/notifications/log`)
        .set(auth(staff))
        .query({ status: 'sent', pageSize: 5 });

      expect(response.status).toBe(200);
      for (const item of (response.body as Envelope<{ items: { status: string }[] }>).data!.items) {
        expect(item.status).toBe('sent');
      }
    });

    it('refuses a status the enum does not have', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/notifications/log`)
        .set(auth(staff))
        .query({ status: 'delivered' });
      expect(response.status).toBe(422);
    });

    it('never exposes a recipient’s address', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/notifications/log`)
        .set(auth(staff))
        .query({ pageSize: 20 });

      // Recipients appear by id. An administrator browsing the log is not
      // entitled to a list of donor addresses.
      expect(JSON.stringify(response.body)).not.toContain('recipientEmail');
      expect(JSON.stringify(response.body)).not.toContain('@sailent.test');
    });

    it('counts outstanding failures', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/notifications/failures`)
        .set(auth(staff));
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ failed: number }>).data!.failed).toBeGreaterThanOrEqual(
        1,
      );
    });
  });

  // =========================================================================
  describe('retrying a failed send', () => {
    it('REQUIRES a fresh re-authentication', async () => {
      const id = await seedLogRow({
        type: 'donation.confirmation',
        status: 'failed',
        title: `Retry ${STAMP}`,
        data: JSON.stringify({ donationId: randomUUID() }),
      });

      const response = await request(server)
        .post(`${PREFIX}/admin/notifications/log/${id}/retry`)
        .set(auth(staff));

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });

    it('refuses to retry something that did not fail', async () => {
      const id = await seedLogRow({
        type: 'donation.confirmation',
        status: 'sent',
        title: `Sent already ${STAMP}`,
        data: JSON.stringify({ donationId: randomUUID() }),
      });

      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/notifications/log/${id}/retry`)
        .set(auth(staff));
      expect(response.status).toBe(409);
    });

    it('refuses a type with NO retry path', async () => {
      /*
        `donor.login_code` is deliberately absent from the map: the code is
        hashed and gone, and re-sending a sign-in code on an administrator's
        say-so is an account-takeover primitive rather than a convenience.
      */
      const id = await seedLogRow({
        type: 'donor.login_code',
        status: 'failed',
        title: `No retry ${STAMP}`,
      });

      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/notifications/log/${id}/retry`)
        .set(auth(staff));
      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toMatch(/no retry path/i);
    });

    it('refuses an entry that carries no id to act on', async () => {
      const id = await seedLogRow({
        type: 'donation.confirmation',
        status: 'failed',
        title: `No data ${STAMP}`,
        data: JSON.stringify({}),
      });

      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/notifications/log/${id}/retry`)
        .set(auth(staff));
      expect(response.status).toBe(409);
    });

    it('LEAVES the failed entry exactly as it was, and audits the attempt', async () => {
      const id = await seedLogRow({
        type: 'donation.confirmation',
        status: 'failed',
        title: `Real retry ${STAMP}`,
        data: JSON.stringify({ donationId: randomUUID() }),
      });

      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/notifications/log/${id}/retry`)
        .set(auth(staff));
      expect(response.status).toBe(201);

      const [row] = (
        await db().execute(
          sql`SELECT status, error, retry_count FROM notifications WHERE id = ${id}::uuid`,
        )
      ).rows!;

      // Still failed, still carrying why. The history of what was tried has to
      // stay readable; overwriting destroys the evidence of the first failure.
      expect(row!.status).toBe('failed');
      expect(row!.error).toBe('unreachable');
      expect(Number(row!.retry_count)).toBe(1);

      const audit = (
        await db().execute(
          sql`SELECT action FROM audit_logs
              WHERE entity_type = 'notification' AND entity_id = ${id}::uuid
                AND action = 'notification.retry'`,
        )
      ).rows!;
      expect(audit.length).toBe(1);
    });
  });

  // =========================================================================
  describe('templates', () => {
    async function firstTemplate(): Promise<{ id: string; slug: string }> {
      const response = await request(server)
        .get(`${PREFIX}/admin/notification-templates`)
        .set(auth(staff));
      const items = (response.body as Envelope<{ items: { id: string; slug: string }[] }>).data!
        .items;
      return items.find((item) => item.slug === 'volunteer.approved') ?? items[0]!;
    }

    it('every transactional email has one', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/notification-templates`)
        .set(auth(staff));

      expect(response.status).toBe(200);
      const slugs = (response.body as Envelope<{ items: { slug: string }[] }>).data!.items.map(
        (item) => item.slug,
      );

      // §4.21: "every transactional email has a template".
      for (const slug of [
        'donation.confirmation',
        'donor.login_code',
        'event.registration.confirmed',
        'event.cancelled',
        'volunteer.application.received',
        'volunteer.approved',
        'volunteer.rejected',
        'volunteer.assigned',
        'volunteer.certificate.issued',
      ]) {
        expect(slugs).toContain(slug);
      }
    });

    it('shows the variables the sender actually supplies', async () => {
      const template = await firstTemplate();
      const response = await request(server)
        .get(`${PREFIX}/admin/notification-templates/${template.id}`)
        .set(auth(staff));

      expect(response.status).toBe(200);
      const body = response.body as Envelope<{ expectedVariables: Record<string, string> }>;
      expect(Object.keys(body.data!.expectedVariables).length).toBeGreaterThan(0);
    });

    it('saves a NEW VERSION and snapshots the old one', async () => {
      const template = await firstTemplate();

      const before = (
        (
          await request(server)
            .get(`${PREFIX}/admin/notification-templates/${template.id}`)
            .set(auth(staff))
        ).body as Envelope<{ version: number }>
      ).data!.version;

      const response = await request(server)
        .patch(`${PREFIX}/admin/notification-templates/${template.id}`)
        .set(auth(staff))
        .send({ subject: `Edited ${STAMP}`, note: 'A test edit.' });

      expect(response.status).toBe(200);
      const after = (response.body as Envelope<{ version: number; revisions: unknown[] }>).data!;
      expect(after.version).toBe(before + 1);
      expect(after.revisions.length).toBeGreaterThan(0);
    });

    it('CANNOT change the slug', async () => {
      const template = await firstTemplate();
      await request(server)
        .patch(`${PREFIX}/admin/notification-templates/${template.id}`)
        .set(auth(staff))
        .send({ subject: `Slug attempt ${STAMP}`, slug: 'something.else' });

      const [row] = (
        await db().execute(
          sql`SELECT slug FROM notification_templates WHERE id = ${template.id}::uuid`,
        )
      ).rows!;
      expect(row!.slug).toBe(template.slug);
    });

    it('REFUSES an unescaped placeholder the slug does not permit', async () => {
      const template = await firstTemplate();

      const response = await request(server)
        .patch(`${PREFIX}/admin/notification-templates/${template.id}`)
        .set(auth(staff))
        .send({
          // A one-character edit that would inject an unescaped, user-supplied
          // name into an email this organisation signs.
          bodyHtml: '<p>Hello {{{volunteerName}}}, this is a long enough body to pass.</p>',
        });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toMatch(/without escaping/i);
    });

    it('PERMITS the one raw placeholder the donation receipt needs', async () => {
      const list = (
        (await request(server).get(`${PREFIX}/admin/notification-templates`).set(auth(staff)))
          .body as Envelope<{ items: { id: string; slug: string }[] }>
      ).data!.items;

      const receipt = list.find((item) => item.slug === 'donation.confirmation')!;

      const response = await request(server)
        .patch(`${PREFIX}/admin/notification-templates/${receipt.id}`)
        .set(auth(staff))
        .send({
          bodyHtml: `<div><p>Hello {{donorName}}</p><table>{{{itemsHtml}}}</table></div>`,
          note: `Raw allowed ${STAMP}`,
        });

      expect(response.status).toBe(200);
    });

    it('reverts to an earlier version, FORWARD as a new one', async () => {
      const template = await firstTemplate();

      const current = (
        (
          await request(server)
            .get(`${PREFIX}/admin/notification-templates/${template.id}`)
            .set(auth(staff))
        ).body as Envelope<{ version: number; revisions: { version: number }[] }>
      ).data!;

      const target = current.revisions.at(-1)!.version;

      const response = await request(server)
        .post(`${PREFIX}/admin/notification-templates/${template.id}/revert`)
        .set(auth(staff))
        .send({ version: target });

      expect(response.status).toBe(201);
      const after = (response.body as Envelope<{ version: number }>).data!;
      // Forward: nothing is lost by going back.
      expect(after.version).toBe(current.version + 1);
    });

    it('refuses a version that does not exist', async () => {
      const template = await firstTemplate();
      const response = await request(server)
        .post(`${PREFIX}/admin/notification-templates/${template.id}/revert`)
        .set(auth(staff))
        .send({ version: 9999 });
      expect(response.status).toBe(404);
    });

    it('previews without sending or writing anything', async () => {
      const template = await firstTemplate();

      const before = (await db().execute(sql`SELECT count(*)::int AS n FROM notifications`))
        .rows![0]!.n;

      const response = await request(server)
        .post(`${PREFIX}/admin/notification-templates/${template.id}/preview`)
        .set(auth(staff))
        .send({
          subject: 'Hello {{volunteerName}}',
          bodyHtml: '<p>Hello {{volunteerName}}, this body is long enough to pass.</p>',
          bodyText: 'Hello {{volunteerName}}, long enough.',
          values: { volunteerName: 'Meera & Co' },
        });

      expect(response.status).toBe(201);
      const preview = (response.body as Envelope<{ subject: string; html: string }>).data!;
      expect(preview.subject).toBe('Hello Meera & Co');
      // Escaped in the HTML, not in the subject.
      expect(preview.html).toContain('Meera &amp; Co');

      const after = (await db().execute(sql`SELECT count(*)::int AS n FROM notifications`))
        .rows![0]!.n;
      expect(after).toBe(before);
    });

    it('fills an unsupplied variable visibly, rather than blank', async () => {
      const template = await firstTemplate();
      const response = await request(server)
        .post(`${PREFIX}/admin/notification-templates/${template.id}/preview`)
        .set(auth(staff))
        .send({
          subject: 'Hello {{volunteerName}}',
          bodyHtml: '<p>Hello {{volunteerName}}, this body is long enough to pass.</p>',
          bodyText: 'Hello {{volunteerName}}, long enough.',
        });

      expect(response.status).toBe(201);
      // A gap in the preview should be visible, not silently empty.
      expect((response.body as Envelope<{ subject: string }>).data!.subject).toContain('«');
    });
  });
});
