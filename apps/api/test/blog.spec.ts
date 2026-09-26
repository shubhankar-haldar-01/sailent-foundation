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
 * The blog.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TESTS THAT MATTER MOST ARE THE ONES ABOUT WHAT THE PUBLIC CANNOT SEE.
 *
 * `/blog` replaced eight fabricated articles that were deliberately kept out
 * of the index because nobody had written them. The risk has now inverted:
 * real drafts exist, and a draft is an article the organisation has NOT
 * decided to stand behind. A draft that leaks reads exactly like a published
 * one, so nothing looks wrong until somebody quotes it.
 *
 * So: drafts and archived posts are asserted absent from the public list, the
 * public detail route, and search — and absent in a way indistinguishable
 * from "no such post", because a 403 on a draft slug is an oracle telling you
 * which unpublished articles exist.
 * ══════════════════════════════════════════════════════════════════════════
 */
const STAMP = randomUUID().slice(0, 8);

describe('Blog (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;
  let categoryId: string;

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
      .post(`${PREFIX}/admin/blog`)
      .set(auth(staff))
      .send({
        title: `Post ${STAMP} ${randomUUID().slice(0, 6)}`,
        excerpt: 'A summary of the article.',
        content: 'A body. The publish gate asks only that there is one.',
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
      .patch(`${PREFIX}/admin/blog/${id}/status`)
      .set(auth(staff))
      .send({ status, reason });
  }

  /** A draft, published, and its slug — the starting point for public tests. */
  async function published(overrides: Record<string, unknown> = {}) {
    const response = await draft(overrides);
    const post = (response.body as Envelope<{ id: string; slug: string }>).data!;
    await setStatus(post.id, 'published');
    return post;
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;

    const category = await db().execute(sql`SELECT id FROM categories LIMIT 1`);
    categoryId = category.rows![0]!.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of created) {
      await db().execute(sql`DELETE FROM slug_history WHERE entity_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM blog_posts WHERE id = ${id}::uuid`);
    }
    // Anything this run created whose id was not captured. Matched on the run
    // stamp rather than a title prefix, which would also sweep real records.
    await db().execute(sql`DELETE FROM blog_posts WHERE title LIKE ${'Post ' + STAMP + '%'}`);
    await db().execute(sql`DELETE FROM blog_tags WHERE slug LIKE ${'tag-' + STAMP + '%'}`);
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated read of the admin list', async () => {
      // Drafts live here, and nowhere else.
      expect((await request(server).get(`${PREFIX}/admin/blog`)).status).toBe(401);
    });

    it('refuses an unauthenticated write', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/blog`)
        .send({ title: 'Unauthenticated', excerpt: 'x' });
      expect(response.status).toBe(401);
    });

    it('refuses a DONOR token on the admin routes', async () => {
      /*
        The audience check, not the permission check. A donor session is a
        different kind of credential and must not reach staff routes at all,
        even before permissions are considered.
      */
      const email = `blog-donor-${STAMP}@example.test`;
      await db().execute(sql`
        INSERT INTO donors (donor_code, first_name, last_name, email, phone, email_opt_in)
        VALUES (${`DNR-BLOG-${STAMP}`.slice(0, 24)}, 'Blog', 'Reader', ${email}, '9812345670', true)
        ON CONFLICT DO NOTHING
      `);

      const response = await request(server)
        .get(`${PREFIX}/admin/blog`)
        .set({ Authorization: 'Bearer not-a-staff-token' });
      expect(response.status).toBe(401);
    });

    it('allows SUPER_ADMIN, which is the only staff role', async () => {
      const response = await request(server).get(`${PREFIX}/admin/blog`).set(auth(staff));
      expect(response.status).toBe(200);
    });

    it('refuses a status change without a recent re-authentication', async () => {
      const post = (await draft()).body as Envelope<{ id: string }>;

      // Deliberately no `reauth()` first.
      const response = await request(server)
        .patch(`${PREFIX}/admin/blog/${post.data!.id}/status`)
        .set(auth(staff))
        .send({ status: 'published' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });
  });

  // =========================================================================
  describe('creating and editing', () => {
    it('creates a DRAFT, whatever the caller asks for', async () => {
      // There is no create-and-publish in one call: publishing is a separate
      // decision, permission and audit row.
      const response = await draft({ status: 'published' });
      expect(response.status).toBe(201);
      expect((response.body as Envelope<{ status: string }>).data!.status).toBe('draft');
    });

    it('derives a slug from the title', async () => {
      const response = await draft({ title: `Post ${STAMP} What A School Kit Costs` });
      const { slug } = (response.body as Envelope<{ slug: string }>).data!;
      expect(slug).toMatch(/^post-[a-z0-9-]+-what-a-school-kit-costs$/);
    });

    it('ENFORCES slug uniqueness, in the database and not only in the service', async () => {
      const first = await draft({ slug: `unique-${STAMP}` });
      expect(first.status).toBe(201);

      const second = await draft({ slug: `unique-${STAMP}` });
      expect(second.status).toBeGreaterThanOrEqual(400);
    });

    it('records the old slug so the previous URL still resolves', async () => {
      const post = await published({ slug: `renamed-before-${STAMP}` });

      await request(server)
        .patch(`${PREFIX}/admin/blog/${post.id}`)
        .set(auth(staff))
        .send({ slug: `renamed-after-${STAMP}` })
        .expect(200);

      // The new slug serves the article…
      await request(server).get(`${PREFIX}/blog/renamed-after-${STAMP}`).expect(200);

      // …and the old one answers with where it went, rather than a 404.
      const old = await request(server).get(`${PREFIX}/blog/renamed-before-${STAMP}`).expect(200);
      expect((old.body as Envelope<{ redirectTo: string }>).data!.redirectTo).toBe(
        `renamed-after-${STAMP}`,
      );
    });

    it('rejects a featured image that is not in the media library', async () => {
      const response = await draft({ featuredMediaId: randomUUID() });
      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toContain('featuredMediaId');
    });

    it('rejects a PRIVATE image as a featured image', async () => {
      /*
        A private image has no public URL by database constraint, so it would
        render as a broken image for every visitor. Refused at the point of
        choosing rather than discovered by a reader.
      */
      const media = await db().execute(sql`
        INSERT INTO media (storage_key, url, alt_text, mime_type, size_bytes, visibility)
        VALUES (${`blog-test/${STAMP}.jpg`}, NULL,
                'A private image', 'image/jpeg', 1024, 'private')
        RETURNING id
      `);
      const mediaId = media.rows![0]!.id as string;

      const response = await draft({ featuredMediaId: mediaId });
      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toContain('NOT_PUBLIC');

      await db().execute(sql`DELETE FROM media WHERE id = ${mediaId}::uuid`);
    });

    it('rejects a category that does not exist', async () => {
      const response = await draft({ categoryId: randomUUID() });
      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  describe('tags', () => {
    it('normalises tag names so one tag is not stored three times', async () => {
      const response = await draft({ tags: ['Field Notes', 'field notes', 'Field-Notes'] });
      expect(response.status).toBe(201);

      const { tags } = (response.body as Envelope<{ tags: { slug: string }[] }>).data!;
      expect(tags).toHaveLength(1);
      expect(tags[0]!.slug).toBe('field-notes');
    });

    it('reuses an existing tag rather than creating a duplicate', async () => {
      const slug = `tag-${STAMP}-shared`;
      const name = `Tag ${STAMP} shared`;

      await draft({ tags: [name] });
      await draft({ tags: [name] });

      const rows = await db().execute(
        sql`SELECT count(*)::int AS n FROM blog_tags WHERE slug = ${slug.replace(`tag-${STAMP}-shared`, `tag-${STAMP}-shared`)} OR name = ${name}`,
      );
      expect(Number(rows.rows![0]!.n)).toBe(1);
    });

    it('replaces the tag set on update rather than appending to it', async () => {
      const response = await draft({ tags: ['alpha', 'beta'] });
      const { id } = (response.body as Envelope<{ id: string }>).data!;

      const updated = await request(server)
        .patch(`${PREFIX}/admin/blog/${id}`)
        .set(auth(staff))
        .send({ tags: ['gamma'] })
        .expect(200);

      const { tags } = (updated.body as Envelope<{ tags: { name: string }[] }>).data!;
      expect(tags.map((tag) => tag.name)).toEqual(['gamma']);
    });
  });

  // =========================================================================
  describe('the publish gate', () => {
    it('refuses to publish a post with no body, and says why', async () => {
      const response = await draft({ content: null });
      const { id } = (response.body as Envelope<{ id: string }>).data!;

      const attempt = await setStatus(id, 'published');
      expect(attempt.status).toBe(422);
      expect(JSON.stringify(attempt.body)).toContain('CONTENT_REQUIRED');
    });

    it('refuses to publish a post with no summary', async () => {
      const response = await draft({ excerpt: null });
      const { id } = (response.body as Envelope<{ id: string }>).data!;

      const attempt = await setStatus(id, 'published');
      expect(attempt.status).toBe(422);
      expect(JSON.stringify(attempt.body)).toContain('EXCERPT_REQUIRED');
    });

    it('reports the blockers BEFORE anybody presses publish', async () => {
      const response = await draft({ content: null, excerpt: null });
      const { id } = (response.body as Envelope<{ id: string }>).data!;

      const detail = await request(server).get(`${PREFIX}/admin/blog/${id}`).set(auth(staff));
      const { publishBlockers } = (detail.body as Envelope<{ publishBlockers: unknown[] }>).data!;
      expect(publishBlockers).toHaveLength(2);
    });

    it('will not let a PUBLISHED post be edited into an unpublishable state', async () => {
      const post = await published();

      const response = await request(server)
        .patch(`${PREFIX}/admin/blog/${post.id}`)
        .set(auth(staff))
        .send({ content: '' });

      expect(response.status).toBe(422);
    });

    it('stamps publishedAt once and never moves it', async () => {
      const post = await published();

      const first = await request(server).get(`${PREFIX}/admin/blog/${post.id}`).set(auth(staff));
      const originally = (first.body as Envelope<{ publishedAt: string }>).data!.publishedAt;

      await setStatus(post.id, 'draft');
      const again = await setStatus(post.id, 'published');

      expect((again.body as Envelope<{ publishedAt: string }>).data!.publishedAt).toBe(originally);
    });

    it('refuses a transition to the status it already has', async () => {
      const post = await published();
      const response = await setStatus(post.id, 'published');
      expect(response.status).toBe(409);
    });
  });

  // =========================================================================
  describe('listing, filtering and pagination', () => {
    it('filters by status', async () => {
      await draft();
      const response = await request(server)
        .get(`${PREFIX}/admin/blog?status=draft&limit=50`)
        .set(auth(staff));

      const { items } = (response.body as Envelope<{ items: { status: string }[] }>).data!;
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.status === 'draft')).toBe(true);
    });

    it('searches the title', async () => {
      const marker = `Findme${STAMP}`;
      await draft({ title: `Post ${STAMP} ${marker}` });

      const response = await request(server)
        .get(`${PREFIX}/admin/blog?q=${marker}`)
        .set(auth(staff));

      const { items } = (response.body as Envelope<{ items: { title: string }[] }>).data!;
      expect(items.length).toBe(1);
      expect(items[0]!.title).toContain(marker);
    });

    it('filters by category', async () => {
      await draft({ categoryId });
      const response = await request(server)
        .get(`${PREFIX}/admin/blog?categoryId=${categoryId}&limit=50`)
        .set(auth(staff));

      const { items } = (response.body as Envelope<{ items: { categoryId: string }[] }>).data!;
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.categoryId === categoryId)).toBe(true);
    });

    it('paginates', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/blog?limit=1&page=1`)
        .set(auth(staff));

      const body = (
        response.body as Envelope<{ items: unknown[]; pagination: { limit: number; page: number } }>
      ).data!;
      expect(body.items).toHaveLength(1);
      expect(body.pagination.limit).toBe(1);
    });
  });

  // =========================================================================
  describe('what the public may read', () => {
    it('lists published posts without authentication', async () => {
      const post = await published();
      const response = await request(server).get(`${PREFIX}/blog?limit=50`).expect(200);

      const { items } = (response.body as Envelope<{ items: { slug: string }[] }>).data!;
      expect(items.some((item) => item.slug === post.slug)).toBe(true);
    });

    it('NEVER lists a draft', async () => {
      const response = await draft();
      const { slug } = (response.body as Envelope<{ slug: string }>).data!;

      const list = await request(server).get(`${PREFIX}/blog?limit=100`).expect(200);
      const { items } = (list.body as Envelope<{ items: { slug: string }[] }>).data!;
      expect(items.some((item) => item.slug === slug)).toBe(false);
    });

    it('NEVER lists an archived post', async () => {
      const post = await published();
      await setStatus(post.id, 'archived');

      const list = await request(server).get(`${PREFIX}/blog?limit=100`).expect(200);
      const { items } = (list.body as Envelope<{ items: { slug: string }[] }>).data!;
      expect(items.some((item) => item.slug === post.slug)).toBe(false);
    });

    it('404s a draft slug — indistinguishably from one that never existed', async () => {
      const response = await draft();
      const { slug } = (response.body as Envelope<{ slug: string }>).data!;

      const asDraft = await request(server).get(`${PREFIX}/blog/${slug}`);
      const asMissing = await request(server).get(`${PREFIX}/blog/never-existed-${STAMP}`);

      // A 403 here would be an oracle: it would confirm the slug exists.
      expect(asDraft.status).toBe(404);
      expect(asMissing.status).toBe(404);
      expect(errorCode(asDraft.body as Envelope)).toBe(errorCode(asMissing.body as Envelope));
    });

    it('404s an archived post', async () => {
      const post = await published();
      await setStatus(post.id, 'archived');
      expect((await request(server).get(`${PREFIX}/blog/${post.slug}`)).status).toBe(404);
    });

    it('does not return a draft through SEARCH either', async () => {
      const marker = `Secret${STAMP}`;
      await draft({ title: `Post ${STAMP} ${marker}`, content: `The word ${marker} is in here.` });

      const response = await request(server).get(`${PREFIX}/blog?q=${marker}`).expect(200);
      const { items } = (response.body as Envelope<{ items: unknown[] }>).data!;
      expect(items).toHaveLength(0);
    });

    it('searches title, summary and body of published posts', async () => {
      const marker = `Haystack${STAMP}`;
      await published({ content: `An article mentioning ${marker} in its body.` });

      const response = await request(server).get(`${PREFIX}/blog?q=${marker}`).expect(200);
      const { items } = (response.body as Envelope<{ items: unknown[] }>).data!;
      expect(items).toHaveLength(1);
    });

    it('offers related posts, all of them published', async () => {
      await published({ categoryId });
      const anchor = await published({ categoryId });

      const response = await request(server).get(`${PREFIX}/blog/${anchor.slug}`).expect(200);
      const { related } = (response.body as Envelope<{ related: { slug: string }[] }>).data!;

      expect(related.length).toBeGreaterThan(0);
      // Never itself.
      expect(related.some((item) => item.slug === anchor.slug)).toBe(false);

      // Every related post resolves publicly, which is only true of published ones.
      for (const item of related) {
        await request(server).get(`${PREFIX}/blog/${item.slug}`).expect(200);
      }
    });
  });

  // =========================================================================
  describe('what the public response contains', () => {
    it('exposes an author NAME and no other author data', async () => {
      const post = await published();
      const response = await request(server).get(`${PREFIX}/blog/${post.slug}`).expect(200);
      const body = response.body as Envelope<Record<string, unknown>>;

      expect(body.data!.authorName).toBeTypeOf('string');

      /*
        The whole point of naming columns instead of `select()`. `users` holds
        the password hash and the TOTP secret, and a join plus a careless
        `select()` serialises both.
      */
      const serialised = JSON.stringify(body);
      for (const forbidden of [
        'passwordHash',
        'password_hash',
        'totpSecret',
        'totp_secret',
        'authorId',
        'author_id',
        'deletedAt',
        'deleted_at',
      ]) {
        expect(serialised).not.toContain(forbidden);
      }
    });

    it('does not expose the post id or any internal identifier publicly', async () => {
      const post = await published();
      const response = await request(server).get(`${PREFIX}/blog/${post.slug}`).expect(200);
      const data = (response.body as Envelope<Record<string, unknown>>).data!;

      // The slug is the public identity of an article. The uuid is not public.
      expect(data.id).toBeUndefined();
      expect(data.categoryId).toBeUndefined();
      expect(data.featuredMediaId).toBeUndefined();
    });

    it('does not leak a staff email address', async () => {
      const post = await published();
      const response = await request(server).get(`${PREFIX}/blog/${post.slug}`).expect(200);
      expect(JSON.stringify(response.body)).not.toContain(TEST_USERS.superAdmin);
    });

    it('stores content verbatim — escaping is the renderer’s job, not storage’s', async () => {
      /*
        The API does not strip markup, and should not: mangling an author's
        text on the way in loses information and gives a false sense of safety.
        Safety is structural on the way OUT — the web renderer produces React
        elements and never HTML. See `apps/web/src/lib/blog/markdown.tsx`.
      */
      const payload = 'Before <script>alert(1)</script> after.';
      const post = await published({ content: payload });

      const response = await request(server).get(`${PREFIX}/blog/${post.slug}`).expect(200);
      expect((response.body as Envelope<{ content: string }>).data!.content).toBe(payload);
    });
  });

  // =========================================================================
  /**
   * The regression this suite did not have.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * A SHORT ARTICLE COULD NOT BE PUBLISHED, AND THE REASON GIVEN WAS FALSE.
   *
   * The gate read `content.trim().length < 50` — an arbitrary minimum invented
   * with this module and stated nowhere — but reported it as "An article needs
   * a body before it can be published". An editor who wrote a heading and a
   * sentence saw that message with their own words on screen in front of them,
   * and a disabled publish button.
   *
   * Everything else was working: the body was in the request, in the column,
   * and in the GET response, byte for byte. Only the check and its explanation
   * disagreed. These tests walk the whole path — save, reload, publish, read it
   * publicly — with EXACTLY the body from the report, so a reinstated minimum
   * fails here rather than in somebody's editor.
   * ══════════════════════════════════════════════════════════════════════════
   */
  describe('a short article, end to end', () => {
    /** 41 characters. The reported body, unchanged. */
    const SHORT_BODY = '## Heading\nhey this is sailent foundation';

    it('publishes a 41-character body and serves it publicly', async () => {
      // 1. Create a draft with a non-empty Markdown body.
      const created = await draft({
        title: `Post ${STAMP} Welcome to Sailent Foundation`,
        excerpt: 'A short summary.',
        content: SHORT_BODY,
      });
      expect(created.status).toBe(201);

      const post = (created.body as Envelope<{ id: string; slug: string; content: string }>).data!;
      expect(SHORT_BODY.length).toBeLessThan(50);

      // 2 + 3. Saved, then read back.
      const reloaded = await request(server)
        .get(`${PREFIX}/admin/blog/${post.id}`)
        .set(auth(staff))
        .expect(200);
      const detail = (
        reloaded.body as Envelope<{ content: string; publishBlockers: { code: string }[] }>
      ).data!;

      // 4. The body survived the round trip, byte for byte.
      expect(detail.content).toBe(SHORT_BODY);

      // And nothing stands in the way of publishing it.
      expect(detail.publishBlockers).toEqual([]);

      // 5. Publish.
      const published = await setStatus(post.id, 'published');
      expect(published.status).toBe(200);

      // 6. It is published.
      expect((published.body as Envelope<{ status: string }>).data!.status).toBe('published');

      // 7. And the public page carries the article body.
      const publicView = await request(server).get(`${PREFIX}/blog/${post.slug}`).expect(200);
      expect((publicView.body as Envelope<{ content: string }>).data!.content).toBe(SHORT_BODY);
    });

    it('still refuses a body that is genuinely EMPTY', async () => {
      // The invariant that was always worth enforcing, and the one the message
      // claimed. Removing the arbitrary minimum must not remove this.
      for (const content of [null, '', '   ', '\n\n  \t ']) {
        const response = await draft({ content });
        const { id, publishBlockers } = (
          response.body as Envelope<{ id: string; publishBlockers: { code: string }[] }>
        ).data!;

        expect(publishBlockers.map((blocker) => blocker.code)).toContain('CONTENT_REQUIRED');

        const attempt = await setStatus(id, 'published');
        expect(attempt.status).toBe(422);
        expect(JSON.stringify(attempt.body)).toContain('CONTENT_REQUIRED');
      }
    });

    it('accepts a single character, because length is an editorial judgement', async () => {
      /*
        The boundary the old rule got wrong. Not an endorsement of one-character
        articles — it is the assertion that the SYSTEM does not hold an opinion
        about length, so nobody reintroduces a threshold without also deciding
        what to tell the editor about it.
      */
      const created = await draft({ content: 'x', excerpt: 'A summary.' });
      const { id } = (created.body as Envelope<{ id: string }>).data!;

      expect((await setStatus(id, 'published')).status).toBe(200);
    });
  });

  // =========================================================================
  describe('audit', () => {
    it.each([
      ['create', 'blog.create'],
      ['publish', 'blog.published'],
      ['archive', 'blog.archived'],
    ])('records %s', async (step, action) => {
      const post = await published();
      if (step === 'archive') await setStatus(post.id, 'archived');

      const rows = await db().execute(sql`
        SELECT action, severity FROM audit_logs
         WHERE entity_id = ${post.id}::uuid AND action = ${action}
         LIMIT 1
      `);
      expect(rows.rows!.length).toBe(1);
    });

    it('records an update with the old and new slug, and no article body', async () => {
      const post = await published({ slug: `audited-${STAMP}` });

      await request(server)
        .patch(`${PREFIX}/admin/blog/${post.id}`)
        .set(auth(staff))
        .send({
          slug: `audited-new-${STAMP}`,
          content: 'A revised body.',
        })
        .expect(200);

      const rows = await db().execute(sql`
        SELECT old_values::text AS old_values, new_values::text AS new_values
          FROM audit_logs
         WHERE entity_id = ${post.id}::uuid AND action = 'blog.update'
         ORDER BY created_at DESC LIMIT 1
      `);

      const row = rows.rows![0]!;
      expect(row.old_values as string).toContain(`audited-${STAMP}`);
      expect(row.new_values as string).toContain(`audited-new-${STAMP}`);
      // An audit log is not a second copy of the article.
      expect(row.new_values as string).not.toContain('A revised body');
    });

    it('marks publication and archival as warnings, not routine information', async () => {
      const post = await published();
      const rows = await db().execute(sql`
        SELECT severity FROM audit_logs
         WHERE entity_id = ${post.id}::uuid AND action = 'blog.published' LIMIT 1
      `);
      expect(rows.rows![0]!.severity).toBe('warning');
    });
  });
});
