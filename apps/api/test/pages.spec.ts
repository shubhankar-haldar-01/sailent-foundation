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
 * The section composer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TESTS THAT MATTER MOST ARE THE ONES ABOUT WHAT CANNOT BE COMPOSED, AND
 * ABOUT WHAT A SCHEDULE MUST NOT REVEAL.
 *
 * `sections` is jsonb, which means the database will store whatever shape it
 * is given. The only thing standing between an editor and an arbitrary page
 * builder is the approved-type registry, checked on write — so these send what
 * the admin UI never would.
 *
 * And a page scheduled for next week must be INDISTINGUISHABLE from one that
 * does not exist. A 403, or a different error, would tell anyone who asked
 * what the organisation is about to announce.
 * ══════════════════════════════════════════════════════════════════════════
 */
const STAMP = randomUUID().slice(0, 8);

describe('Pages (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;

  const created: string[] = [];

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Status and revert are `@Sensitive()`; a fresh login is not a re-auth. */
  async function reauth(token = staff) {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  let counter = 0;
  async function draft(overrides: Record<string, unknown> = {}) {
    counter += 1;
    const response = await request(server)
      .post(`${PREFIX}/admin/pages`)
      .set(auth(staff))
      .send({
        slug: `page-${STAMP}-${counter}`,
        title: `Page ${STAMP} ${counter}`,
        sections: [{ type: 'hero' }, { type: 'impact' }],
        ...overrides,
      });

    if (response.status === 201) created.push((response.body as Envelope<{ id: string }>).data!.id);
    return response;
  }

  async function setStatus(id: string, body: Record<string, unknown>) {
    await reauth();
    return request(server).patch(`${PREFIX}/admin/pages/${id}/status`).set(auth(staff)).send(body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    await db().execute(sql`DELETE FROM pages WHERE slug LIKE ${'page-' + STAMP + '%'}`);
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated read of the admin list', async () => {
      expect((await request(server).get(`${PREFIX}/admin/pages`)).status).toBe(401);
    });

    it('refuses an unauthenticated write', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/pages`)
        .send({ slug: 'home', title: 'Home' });
      expect(response.status).toBe(401);
    });

    it('allows SUPER_ADMIN, the only staff role', async () => {
      expect((await request(server).get(`${PREFIX}/admin/pages`).set(auth(staff))).status).toBe(
        200,
      );
    });

    it('refuses a status change without a recent re-authentication', async () => {
      const { id } = ((await draft()).body as Envelope<{ id: string }>).data!;

      const response = await request(server)
        .patch(`${PREFIX}/admin/pages/${id}/status`)
        .set(auth(staff))
        .send({ status: 'published' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });
  });

  // =========================================================================
  describe('the approved-section registry', () => {
    it('accepts a page composed of approved sections, in order', async () => {
      const response = await draft({
        sections: [{ type: 'hero' }, { type: 'campaigns' }, { type: 'impact' }],
      });

      expect(response.status).toBe(201);
      const { sections } = (response.body as Envelope<{ sections: { type: string }[] }>).data!;
      expect(sections.map((section) => section.type)).toEqual(['hero', 'campaigns', 'impact']);
    });

    it('REFUSES a section type that is not approved', async () => {
      // The control that keeps this a composer. jsonb would happily store it.
      const response = await draft({ sections: [{ type: 'iframe', props: {} }] });
      expect(response.status).toBe(422);
    });

    it('REFUSES a section carrying raw markup', async () => {
      const response = await draft({
        sections: [{ type: 'html', props: { value: '<script>alert(1)</script>' } }],
      });
      expect(response.status).toBe(422);
    });

    it('REFUSES a prop the section does not declare', async () => {
      const response = await draft({ sections: [{ type: 'hero', props: { limit: 900 } }] });
      expect(response.status).toBe(422);
    });

    it('REFUSES the whole page when one section is invalid', async () => {
      const response = await draft({
        sections: [{ type: 'hero' }, { type: 'nope' }, { type: 'about' }],
      });
      expect(response.status).toBe(422);

      // And nothing was stored.
      const rows = await db().execute(
        sql`SELECT count(*)::int AS n FROM pages WHERE title LIKE ${'%' + STAMP + '%'} AND sections::text LIKE '%nope%'`,
      );
      expect(Number(rows.rows![0]!.n)).toBe(0);
    });

    it('refuses a second page for the same slug', async () => {
      const slug = `page-${STAMP}-dup`;
      expect((await draft({ slug })).status).toBe(201);
      expect((await draft({ slug })).status).toBe(409);
    });
  });

  // =========================================================================
  describe('revisions', () => {
    it('snapshots every save, and numbers them', async () => {
      const { id } = (
        (await draft({ sections: [{ type: 'hero' }] })).body as Envelope<{
          id: string;
        }>
      ).data!;

      await request(server)
        .patch(`${PREFIX}/admin/pages/${id}`)
        .set(auth(staff))
        .send({ sections: [{ type: 'hero' }, { type: 'about' }], note: 'Added the about band' })
        .expect(200);

      const detail = await request(server).get(`${PREFIX}/admin/pages/${id}`).set(auth(staff));
      const body = (
        detail.body as Envelope<{ version: number; revisions: { version: number; note: string }[] }>
      ).data!;

      expect(body.version).toBe(2);
      expect(body.revisions.map((revision) => revision.version)).toEqual([2, 1]);
      expect(body.revisions[0]!.note).toBe('Added the about band');
    });

    it('restores an earlier version as a NEW version, keeping the history', async () => {
      const { id } = (
        (await draft({ sections: [{ type: 'hero' }] })).body as Envelope<{
          id: string;
        }>
      ).data!;

      await request(server)
        .patch(`${PREFIX}/admin/pages/${id}`)
        .set(auth(staff))
        .send({ sections: [{ type: 'newsletter' }] })
        .expect(200);

      await reauth();
      const reverted = await request(server)
        .post(`${PREFIX}/admin/pages/${id}/revert`)
        .set(auth(staff))
        .send({ version: 1 })
        .expect(201);

      const body = (reverted.body as Envelope<{ version: number; sections: { type: string }[] }>)
        .data!;

      // Version 1's content, at version 3 — a rewind would have lost version 2.
      expect(body.sections.map((section) => section.type)).toEqual(['hero']);
      expect(body.version).toBe(3);
    });

    it('refuses to revert to a version that does not exist', async () => {
      const { id } = ((await draft()).body as Envelope<{ id: string }>).data!;
      await reauth();

      const response = await request(server)
        .post(`${PREFIX}/admin/pages/${id}/revert`)
        .set(auth(staff))
        .send({ version: 99 });

      expect(response.status).toBe(404);
    });

    it('records a revert in the audit log', async () => {
      const { id } = ((await draft()).body as Envelope<{ id: string }>).data!;
      await request(server)
        .patch(`${PREFIX}/admin/pages/${id}`)
        .set(auth(staff))
        .send({ title: `Page ${STAMP} changed` })
        .expect(200);

      await reauth();
      await request(server)
        .post(`${PREFIX}/admin/pages/${id}/revert`)
        .set(auth(staff))
        .send({ version: 1 })
        .expect(201);

      const rows = await db().execute(sql`
        SELECT severity FROM audit_logs
         WHERE entity_id = ${id}::uuid AND action = 'page.revert' LIMIT 1
      `);
      expect(rows.rows!.length).toBe(1);
      expect(rows.rows![0]!.severity).toBe('warning');
    });
  });

  // =========================================================================
  describe('publishing and scheduling', () => {
    it('refuses to publish a page with no sections', async () => {
      const { id } = ((await draft({ sections: [] })).body as Envelope<{ id: string }>).data!;

      const response = await setStatus(id, { status: 'published' });
      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toContain('SECTIONS_REQUIRED');
    });

    it('publishes, and serves the page publicly', async () => {
      const page = ((await draft()).body as Envelope<{ id: string; slug: string }>).data!;
      expect((await setStatus(page.id, { status: 'published' })).status).toBe(200);

      const publicView = await request(server).get(`${PREFIX}/pages/${page.slug}`).expect(200);
      const body = (publicView.body as Envelope<{ sections: { type: string }[] }>).data!;
      expect(body.sections.map((section) => section.type)).toEqual(['hero', 'impact']);
    });

    it('a page SCHEDULED for later is indistinguishable from one that does not exist', async () => {
      /*
        The assertion this section exists for. A different status code, or a
        different error, would tell anyone who asked what is about to be
        announced and when.
      */
      const page = ((await draft()).body as Envelope<{ id: string; slug: string }>).data!;
      const future = new Date(Date.now() + 86_400_000).toISOString();

      expect((await setStatus(page.id, { status: 'published', scheduledAt: future })).status).toBe(
        200,
      );

      const scheduled = await request(server).get(`${PREFIX}/pages/${page.slug}`);
      const missing = await request(server).get(`${PREFIX}/pages/never-existed-${STAMP}`);

      expect(scheduled.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(errorCode(scheduled.body as Envelope)).toBe(errorCode(missing.body as Envelope));
    });

    it('a schedule that has passed is live, with no job having run', async () => {
      const page = ((await draft()).body as Envelope<{ id: string; slug: string }>).data!;
      const past = new Date(Date.now() - 60_000).toISOString();

      await setStatus(page.id, { status: 'published', scheduledAt: past });
      await request(server).get(`${PREFIX}/pages/${page.slug}`).expect(200);
    });

    it('refuses a schedule on a page that is not being published', async () => {
      const page = ((await draft()).body as Envelope<{ id: string }>).data!;
      const response = await setStatus(page.id, {
        status: 'draft',
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(response.status).toBe(422);
    });

    it('never serves a draft', async () => {
      const page = ((await draft()).body as Envelope<{ slug: string }>).data!;
      expect((await request(server).get(`${PREFIX}/pages/${page.slug}`)).status).toBe(404);
    });

    it('never serves an archived page', async () => {
      const page = ((await draft()).body as Envelope<{ id: string; slug: string }>).data!;
      await setStatus(page.id, { status: 'published' });
      await setStatus(page.id, { status: 'archived' });

      expect((await request(server).get(`${PREFIX}/pages/${page.slug}`)).status).toBe(404);
    });

    it('stamps publishedAt once and never moves it', async () => {
      const page = ((await draft()).body as Envelope<{ id: string }>).data!;
      const first = await setStatus(page.id, { status: 'published' });
      const originally = (first.body as Envelope<{ publishedAt: string }>).data!.publishedAt;

      await setStatus(page.id, { status: 'draft' });
      const again = await setStatus(page.id, { status: 'published' });

      expect((again.body as Envelope<{ publishedAt: string }>).data!.publishedAt).toBe(originally);
    });
  });

  // =========================================================================
  describe('signed preview', () => {
    it('shows an UNPUBLISHED page to a correctly signed link', async () => {
      const page = ((await draft()).body as Envelope<{ id: string; slug: string }>).data!;

      const preview = await request(server)
        .post(`${PREFIX}/admin/pages/${page.id}/preview`)
        .set(auth(staff))
        .expect(201);
      const { token } = (preview.body as Envelope<{ token: string }>).data!;

      // Not public without the token…
      await request(server).get(`${PREFIX}/pages/${page.slug}`).expect(404);
      // …and visible with it.
      await request(server).get(`${PREFIX}/pages/${page.slug}?preview=${token}`).expect(200);
    });

    it('refuses a tampered token', async () => {
      const page = ((await draft()).body as Envelope<{ id: string; slug: string }>).data!;
      const preview = await request(server)
        .post(`${PREFIX}/admin/pages/${page.id}/preview`)
        .set(auth(staff))
        .expect(201);
      const { token } = (preview.body as Envelope<{ token: string }>).data!;

      const [id, expiry, signature] = token.split('.') as [string, string, string];

      for (const forged of [
        `${id}.${Date.now() + 86_400_000}.${signature}`, // a later expiry
        `${randomUUID()}.${expiry}.${signature}`, // a different page
        `${id}.${expiry}.${signature.slice(0, -2)}xx`, // a different signature
        `${id}.${expiry}`, // no signature at all
      ]) {
        const response = await request(server).get(
          `${PREFIX}/pages/${page.slug}?preview=${forged}`,
        );
        expect(response.status, forged.slice(0, 40)).toBe(404);
      }
    });

    it('will not open a DIFFERENT page than the one it names', async () => {
      // Otherwise one valid token would open every unpublished page.
      const mine = ((await draft()).body as Envelope<{ id: string }>).data!;
      const other = ((await draft()).body as Envelope<{ slug: string }>).data!;

      const preview = await request(server)
        .post(`${PREFIX}/admin/pages/${mine.id}/preview`)
        .set(auth(staff))
        .expect(201);
      const { token } = (preview.body as Envelope<{ token: string }>).data!;

      await request(server).get(`${PREFIX}/pages/${other.slug}?preview=${token}`).expect(404);
    });

    it('needs page.read to mint one', async () => {
      const page = ((await draft()).body as Envelope<{ id: string }>).data!;
      expect((await request(server).post(`${PREFIX}/admin/pages/${page.id}/preview`)).status).toBe(
        401,
      );
    });
  });

  // =========================================================================
  describe('what the public response contains', () => {
    it('exposes the composition and nothing about the editor', async () => {
      const page = ((await draft()).body as Envelope<{ id: string; slug: string }>).data!;
      await setStatus(page.id, { status: 'published' });

      const response = await request(server).get(`${PREFIX}/pages/${page.slug}`).expect(200);
      const data = (response.body as Envelope<Record<string, unknown>>).data!;

      expect(data.sections).toBeDefined();
      expect(data.title).toBeDefined();

      // No internal identifiers, no editorial trail, no schedule.
      for (const field of ['id', 'updatedBy', 'version', 'scheduledAt', 'deletedAt', 'revisions']) {
        expect(data[field], field).toBeUndefined();
      }
      expect(JSON.stringify(response.body)).not.toContain(TEST_USERS.superAdmin);
    });
  });

  // =========================================================================
  describe('audit', () => {
    it.each([
      ['page.create', 'create'],
      ['page.published', 'publish'],
      ['page.archived', 'archive'],
    ])('records %s', async (action, step) => {
      const page = ((await draft()).body as Envelope<{ id: string }>).data!;
      if (step !== 'create') await setStatus(page.id, { status: 'published' });
      if (step === 'archive') await setStatus(page.id, { status: 'archived' });

      const rows = await db().execute(sql`
        SELECT action FROM audit_logs
         WHERE entity_id = ${page.id}::uuid AND action = ${action} LIMIT 1
      `);
      expect(rows.rows!.length).toBe(1);
    });

    it('records the SHAPE of an edit, not a second copy of the page', async () => {
      const page = ((await draft()).body as Envelope<{ id: string }>).data!;
      await request(server)
        .patch(`${PREFIX}/admin/pages/${page.id}`)
        .set(auth(staff))
        .send({ sections: [{ type: 'hero' }, { type: 'about' }, { type: 'newsletter' }] })
        .expect(200);

      const rows = await db().execute(sql`
        SELECT new_values::text AS new_values FROM audit_logs
         WHERE entity_id = ${page.id}::uuid AND action = 'page.update'
         ORDER BY created_at DESC LIMIT 1
      `);

      // Parsed rather than substring-matched: Postgres renders jsonb with its
      // own spacing, so `"sections":3` and `"sections": 3` are the same value
      // and only one of them is a passing assertion.
      const values = JSON.parse(rows.rows![0]!.new_values as string) as Record<string, unknown>;
      expect(values.sections).toBe(3);
      // The composition itself lives in `page_revisions`, which is where a
      // revert reads it from. The audit row says what changed, not what it is.
      expect(JSON.stringify(values)).not.toContain('newsletter');
    });
  });
});
