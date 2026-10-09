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
 * Success stories.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TESTS THAT MATTER MOST ARE THE CONSENT ONES.
 *
 * A success story is somebody's account of their own life, published under the
 * organisation's name. The database has carried a publish-time consent check
 * since Phase 3 and nothing could reach it, because nothing could write a
 * story. These assert that the rule now fires as a sentence an editor can act
 * on, that it cannot be walked around by editing a story after publication,
 * and that an anonymised story does not leak the name it was anonymising.
 * ══════════════════════════════════════════════════════════════════════════
 */
const STAMP = randomUUID().slice(0, 8);

describe('Success stories (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;

  const created: string[] = [];

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** The status route is `@Sensitive()`; a fresh login is not a re-authentication. */
  async function reauth(token = staff) {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  async function draft(overrides: Record<string, unknown> = {}) {
    const response = await request(server)
      .post(`${PREFIX}/admin/stories`)
      .set(auth(staff))
      .send({
        title: `Story ${STAMP} ${randomUUID().slice(0, 6)}`,
        excerpt: 'A summary.',
        ...overrides,
      });

    if (response.status === 201) {
      created.push((response.body as Envelope<{ id: string }>).data!.id);
    }
    return response;
  }

  async function setStatus(id: string, status: string, reason?: string) {
    await reauth();
    return request(server)
      .patch(`${PREFIX}/admin/stories/${id}/status`)
      .set(auth(staff))
      .send({ status, reason });
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
    for (const id of created) {
      await db().execute(sql`DELETE FROM slug_history WHERE entity_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM success_stories WHERE id = ${id}::uuid`);
    }
    // Anything this run created whose id was not captured. Matched on the run
    // stamp, not a title prefix, which would also sweep seeded records.
    await db().execute(sql`DELETE FROM success_stories WHERE title LIKE ${'Story ' + STAMP + '%'}`);
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated read of the admin list', async () => {
      // Drafts live here. An unpublished story about a named person who has
      // not consented is exactly what must not be reachable.
      expect((await request(server).get(`${PREFIX}/admin/stories`)).status).toBe(401);
    });

    it('refuses an unauthenticated write', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/stories`)
        .send({ title: 'Should never exist' });
      expect(response.status).toBe(401);
    });

    it('refuses a non-staff token outright', async () => {
      /*
        An audience failure, not a permission one: a donor token is signed with
        a different key and does not verify on a staff route at all. Donors and
        volunteers cannot create or edit stories, and that is structural rather
        than a permission somebody could grant by mistake.
      */
      const response = await request(server)
        .post(`${PREFIX}/admin/stories`)
        .set(auth('not-a-staff-token'))
        .send({ title: 'Should never exist' });
      expect(response.status).toBe(401);
    });

    it('requires a FRESH re-authentication to change status', async () => {
      const story = await draft();
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      const fresh = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD });
      const token = (fresh.body as Envelope<{ accessToken: string }>).data!.accessToken;

      const response = await request(server)
        .patch(`${PREFIX}/admin/stories/${id}/status`)
        .set(auth(token))
        .send({ status: 'published' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });
  });

  // =========================================================================
  describe('drafting and editing', () => {
    it('creates a DRAFT, never a published story', async () => {
      const response = await draft();
      expect(response.status).toBe(201);

      const data = (response.body as Envelope<{ status: string; slug: string }>).data!;
      // Publishing is a separate decision with its own permission and gate.
      expect(data.status).toBe('draft');
      expect(data.slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('derives a slug from the title', async () => {
      const response = await draft({ title: `Sunita ${STAMP} Finished School` });
      const slug = (response.body as Envelope<{ slug: string }>).data!.slug;
      expect(slug).toContain('finished-school');
    });

    it('edits the narrative sections', async () => {
      const story = await draft();
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      const response = await request(server)
        .patch(`${PREFIX}/admin/stories/${id}`)
        .set(auth(staff))
        .send({
          challenge: 'She had to walk eleven kilometres.',
          intervention: 'A bicycle, and a road safety session.',
          journey: 'Two terms.',
          outcome: 'She finished school.',
        });

      expect(response.status).toBe(200);
      const data = (response.body as Envelope<{ outcome: string }>).data!;
      expect(data.outcome).toBe('She finished school.');
    });

    it('rejects an unknown field rather than ignoring it', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/stories`)
        .set(auth(staff))
        .send({ title: `Story ${STAMP} strict`, status: 'published', authorId: randomUUID() });

      // `.strict()`. Silently dropping `status` would let a caller believe it
      // had published something.
      expect(response.status).toBe(422);
    });

    it('refuses a programme that does not exist, as a field error', async () => {
      const response = await draft({ programId: randomUUID() });
      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toContain('programId');
    });
  });

  // =========================================================================
  describe('consent', () => {
    it('REFUSES to publish a story naming somebody without consent', async () => {
      /*
        The rule the database has enforced since Phase 3, now stated before it
        fires. The editor gets a sentence naming the field, not a 500 quoting
        a constraint.
      */
      const story = await draft({ subjectName: 'Ramesh' });
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      const response = await setStatus(id, 'published');
      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toContain('consentObtained');
      // And it says who, so the editor knows whose consent to seek.
      expect(JSON.stringify(response.body)).toContain('Ramesh');
    });

    it('publishes a named story once consent is recorded', async () => {
      const story = await draft({ subjectName: 'Ramesh', consentObtained: true });
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      const response = await setStatus(id, 'published');
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ status: string }>).data!.status).toBe('published');
    });

    it('publishes an ANONYMISED story without a consent record', async () => {
      // A story that names nobody identifies nobody. The constraint says so
      // and this is not stricter than the constraint.
      const story = await draft({ subjectName: 'Ramesh', isAnonymised: true });
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      expect((await setStatus(id, 'published')).status).toBe(200);
    });

    it('publishes a story that names nobody', async () => {
      const story = await draft();
      const id = (story.body as Envelope<{ id: string }>).data!.id;
      expect((await setStatus(id, 'published')).status).toBe(200);
    });

    it('does NOT require a consent document, because the schema does not', async () => {
      /*
        `consent_document_id` is nullable and the check constraint does not
        mention it. Consent given verbally and recorded by staff is still
        consent; demanding a signed PDF would be inventing a legal requirement
        this project never stated.
      */
      const story = await draft({ subjectName: 'Ramesh', consentObtained: true });
      const id = (story.body as Envelope<{ id: string }>).data!.id;
      expect((await setStatus(id, 'published')).status).toBe(200);
    });

    it('cannot be walked around by editing AFTER publication', async () => {
      /*
        THE GAP THE DATABASE CONSTRAINT DOES NOT WATCH.

        It fires on the status column. Publishing an anonymised story and then
        adding a name to it arrives at exactly the forbidden state by a route
        the constraint never sees.
      */
      const story = await draft({ isAnonymised: true });
      const id = (story.body as Envelope<{ id: string }>).data!.id;
      await setStatus(id, 'published');

      const response = await request(server)
        .patch(`${PREFIX}/admin/stories/${id}`)
        .set(auth(staff))
        .send({ subjectName: 'Ramesh', isAnonymised: false });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toContain('consentObtained');
    });

    it('reports publish blockers BEFORE an attempt is made', async () => {
      // So the form can explain why the button will not work, rather than
      // letting the editor discover it by pressing it.
      const story = await draft({ subjectName: 'Ramesh' });
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      const response = await request(server).get(`${PREFIX}/admin/stories/${id}`).set(auth(staff));

      const blockers = (response.body as Envelope<{ publishBlockers: { field: string }[] }>).data!
        .publishBlockers;
      expect(blockers.map((blocker) => blocker.field)).toContain('consentObtained');
    });

    it('refuses to publish a story with nothing to read', async () => {
      const story = await draft({ excerpt: null });
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      const response = await setStatus(id, 'published');
      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  describe('the public API — category (owner decision, 2026-10-08)', () => {
    /** A programme with a category, to file stories under. */
    async function programmeWithCategory() {
      const result = await db().execute(
        sql`SELECT id, category FROM programs WHERE category IS NOT NULL AND deleted_at IS NULL LIMIT 1`,
      );
      const row = result.rows?.[0] as { id: string; category: string } | undefined;
      if (!row) throw new Error('The test database has no programme with a category.');
      return row;
    }

    async function published(overrides: Record<string, unknown>) {
      const story = await draft(overrides);
      const { id, slug } = (story.body as Envelope<{ id: string; slug: string }>).data!;
      expect((await setStatus(id, 'published')).status).toBe(200);
      return slug;
    }

    type Item = { slug: string; category: string | null };
    async function list(query: string) {
      const response = await request(server).get(`${PREFIX}/stories?limit=100&${query}`);
      expect(response.status).toBe(200);
      return (response.body as Envelope<{ items: Item[] }>).data!.items;
    }

    it("takes the programme's category when the story has none", async () => {
      const programme = await programmeWithCategory();
      const slug = await published({ programId: programme.id });

      const all = await list('');
      expect(all.find((item) => item.slug === slug)?.category).toBe(programme.category);

      const filtered = await list(`category=${encodeURIComponent(programme.category)}`);
      expect(filtered.map((item) => item.slug)).toContain(slug);
      expect(filtered.every((item) => item.category === programme.category)).toBe(true);
    });

    it("prefers the story's own category, and files it ONLY there", async () => {
      const programme = await programmeWithCategory();
      const own = `Own ${STAMP}`;
      const slug = await published({ programId: programme.id, category: own });

      expect((await list(`category=${encodeURIComponent(own)}`)).map((i) => i.slug)).toEqual([
        slug,
      ]);
      const underProgramme = await list(`category=${encodeURIComponent(programme.category)}`);
      expect(underProgramme.map((item) => item.slug)).not.toContain(slug);
    });

    it('matches the category without regard to case', async () => {
      const own = `Case ${STAMP}`;
      const slug = await published({ category: own });
      const filtered = await list(`category=${encodeURIComponent(own.toUpperCase())}`);
      expect(filtered.map((item) => item.slug)).toEqual([slug]);
    });

    it('returns nothing for a category no story has, and refuses an absurd one', async () => {
      expect(await list(`category=${encodeURIComponent(`Nothing ${STAMP}`)}`)).toEqual([]);
      const tooLong = await request(server).get(`${PREFIX}/stories?category=${'x'.repeat(81)}`);
      // 422, the API's status for a query that fails validation.
      expect(tooLong.status).toBe(422);
    });
  });

  // =========================================================================
  describe('the public API', () => {
    it('does NOT list a draft', async () => {
      const story = await draft();
      const slug = (story.body as Envelope<{ slug: string }>).data!.slug;

      const listed = await request(server).get(`${PREFIX}/stories?limit=100`);
      expect(JSON.stringify(listed.body)).not.toContain(slug);
    });

    it('404s a draft by slug, rather than revealing it exists', async () => {
      const story = await draft();
      const slug = (story.body as Envelope<{ slug: string }>).data!.slug;

      expect((await request(server).get(`${PREFIX}/stories/${slug}`)).status).toBe(404);
    });

    it('serves a story once published, and hides it again when archived', async () => {
      const story = await draft();
      const { id, slug } = (story.body as Envelope<{ id: string; slug: string }>).data!;

      await setStatus(id, 'published');
      expect((await request(server).get(`${PREFIX}/stories/${slug}`)).status).toBe(200);

      await setStatus(id, 'archived', 'Subject asked for it to come down');
      expect((await request(server).get(`${PREFIX}/stories/${slug}`)).status).toBe(404);
    });

    it('NEVER exposes the name on an anonymised story', async () => {
      /*
        The flag was being recorded and then ignored: the public endpoint
        returned the whole row, so `subjectName` went out regardless. Somebody
        asked not to be named, or naming them would put them at risk.
      */
      const story = await draft({ subjectName: 'Ramesh', isAnonymised: true });
      const { id, slug } = (story.body as Envelope<{ id: string; slug: string }>).data!;
      await setStatus(id, 'published');

      const response = await request(server).get(`${PREFIX}/stories/${slug}`);
      const body = JSON.stringify(response.body);

      expect(response.status).toBe(200);
      expect(body).not.toContain('Ramesh');
      expect((response.body as Envelope<{ subjectName: unknown }>).data!.subjectName).toBeNull();
    });

    it('exposes the name when the story is NOT anonymised and consent was given', async () => {
      const story = await draft({ subjectName: 'Ramesh', consentObtained: true });
      const { id, slug } = (story.body as Envelope<{ id: string; slug: string }>).data!;
      await setStatus(id, 'published');

      const response = await request(server).get(`${PREFIX}/stories/${slug}`);
      expect((response.body as Envelope<{ subjectName: string }>).data!.subjectName).toBe('Ramesh');
    });

    it('never exposes internal or private fields', async () => {
      const story = await draft({ subjectName: 'Ramesh', consentObtained: true });
      const { id, slug } = (story.body as Envelope<{ id: string; slug: string }>).data!;
      await setStatus(id, 'published');

      const response = await request(server).get(`${PREFIX}/stories/${slug}`);
      const data = (response.body as Envelope<Record<string, unknown>>).data!;

      // An allowlist, not a delete list — the next column added to the table
      // must not become public by default.
      for (const forbidden of ['consentDocumentId', 'authorId', 'deletedAt']) {
        expect(data, forbidden).not.toHaveProperty(forbidden);
      }
    });
  });

  // =========================================================================
  describe('lifecycle and audit', () => {
    it('stamps publishedAt once and never moves it', async () => {
      const story = await draft();
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      const first = await setStatus(id, 'published');
      const publishedAt = (first.body as Envelope<{ publishedAt: string }>).data!.publishedAt;
      expect(publishedAt).toBeTruthy();

      await setStatus(id, 'draft', 'Fixing a typo');
      const again = await setStatus(id, 'published');

      /*
        Unpublishing to fix a typo must not restate the date the story was
        first told — that date is what a reader, and any citation, relies on.
      */
      expect((again.body as Envelope<{ publishedAt: string }>).data!.publishedAt).toBe(publishedAt);
    });

    it('refuses a no-op status change', async () => {
      const story = await draft();
      const id = (story.body as Envelope<{ id: string }>).data!.id;
      expect((await setStatus(id, 'draft')).status).toBe(409);
    });

    it('writes an audit entry for create, update and publish', async () => {
      const story = await draft();
      const id = (story.body as Envelope<{ id: string }>).data!.id;

      await request(server)
        .patch(`${PREFIX}/admin/stories/${id}`)
        .set(auth(staff))
        .send({ outcome: 'She finished school.' });
      await setStatus(id, 'published', 'Ready to go live');

      const rows = await db().execute(sql`
        SELECT action, severity, actor_email_snapshot
          FROM audit_logs WHERE entity_id = ${id}::uuid ORDER BY created_at
      `);

      const actions = (rows.rows ?? []).map((row) => row.action);
      expect(actions).toContain('story.create');
      expect(actions).toContain('story.update');
      expect(actions).toContain('story.published');

      // Publishing names a real person on a public website.
      const publish = (rows.rows ?? []).find((row) => row.action === 'story.published')!;
      expect(publish.severity).toBe('warning');
      // The Phase 8 snapshot behaviour, still working.
      expect(publish.actor_email_snapshot).toBe(TEST_USERS.superAdmin);
    });

    it('archives rather than deleting, so the consent record survives', async () => {
      /*
        There is no hard delete and no `story.delete` permission. The
        organisation holds a consent record against the row; destroying it
        would destroy the evidence that consent was ever given.
      */
      const story = await draft();
      const id = (story.body as Envelope<{ id: string }>).data!.id;
      await setStatus(id, 'published');
      await setStatus(id, 'archived', 'No longer current');

      const rows = await db().execute(sql`
        SELECT status, consent_obtained FROM success_stories WHERE id = ${id}::uuid
      `);
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows![0]!.status).toBe('archived');
    });
  });
});
