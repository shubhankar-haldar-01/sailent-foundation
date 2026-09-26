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
  fakeStorage,
  type Envelope,
} from './harness.js';

/**
 * The media library.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * OBJECT STORAGE IS SUBSTITUTED; THE RULES ARE NOT.
 *
 * `fakeStorage()` keeps objects in a Map, so these tests assert the things
 * that actually go wrong — a row pointing at no object, an image deleted out
 * from under a campaign gallery, a "private" file still sitting in the public
 * bucket — without needing credentials, a network or a bucket.
 *
 * What is NOT faked: `inspectImage` reads real bytes here, exactly as it will
 * in production. A file declared `image/png` that is a shell script is
 * refused by the same code path either way.
 *
 * The real provider is exercised by the R2 round-trip in
 * docs/phase-10.6.md, which needs credentials and is run deliberately.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** A real 1×1 PNG. Small, and genuinely a PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Media (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;
  let storage: ReturnType<typeof fakeStorage>;

  const created: string[] = [];

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function reauth(token = staff) {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  async function upload(
    body: Buffer = PNG,
    fields: { altText?: string; visibility?: string; filename?: string; contentType?: string } = {},
  ) {
    const response = await request(server)
      .post(`${PREFIX}/admin/media`)
      .set(auth(staff))
      .field('altText', fields.altText ?? 'A test image')
      .field('visibility', fields.visibility ?? 'public')
      .attach('file', body, {
        filename: fields.filename ?? 'photo.png',
        contentType: fields.contentType ?? 'image/png',
      });

    if (response.status === 201) created.push((response.body as Envelope<{ id: string }>).data!.id);
    return response;
  }

  beforeAll(async () => {
    storage = fakeStorage();
    app = await createTestApp({ storage });
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    for (const id of created) {
      await db().execute(sql`DELETE FROM campaign_gallery WHERE media_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM media WHERE id = ${id}::uuid`);
    }
    await db().execute(sql`DELETE FROM media WHERE alt_text LIKE 'A test image%'`);
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated list', async () => {
      expect((await request(server).get(`${PREFIX}/admin/media`)).status).toBe(401);
    });

    it('refuses an unauthenticated upload', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/media`)
        .field('altText', 'nope')
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(response.status).toBe(401);
    });

    it('refuses a non-staff token outright', async () => {
      /*
        An audience failure, not a permission one: a donor or volunteer token
        is signed with a different key and does not verify on a staff route at
        all. Donors and volunteers cannot reach media, and that is structural.
      */
      expect(
        (await request(server).get(`${PREFIX}/admin/media`).set(auth('not-a-staff-token'))).status,
      ).toBe(401);
    });

    it('requires a FRESH re-authentication to delete', async () => {
      const media = await upload();
      const id = (media.body as Envelope<{ id: string }>).data!.id;

      const fresh = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD });
      const token = (fresh.body as Envelope<{ accessToken: string }>).data!.accessToken;

      const response = await request(server).delete(`${PREFIX}/admin/media/${id}`).set(auth(token));

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });
  });

  // =========================================================================
  describe('upload validation', () => {
    it('stores a real PNG and records its metadata', async () => {
      const response = await upload();
      expect(response.status).toBe(201);

      const data = (response.body as Envelope<Record<string, unknown>>).data!;
      expect(data.mimeType).toBe('image/png');
      expect(data.width).toBe(1);
      expect(data.height).toBe(1);
      expect(data.sizeBytes).toBe(PNG.byteLength);
      // The object is really there, not merely recorded.
      expect(storage.bucketOf(data.storageKey as string)).toBe('public');
    });

    it('REFUSES a script that claims to be a PNG', async () => {
      /*
        The attack the whole validator exists for. `Content-Type: image/png` on
        a shell script is accepted by anything that reads the header.
      */
      const script = Buffer.from('#!/bin/sh\nrm -rf /\n');
      const response = await upload(script, { contentType: 'image/png', filename: 'evil.png' });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toMatch(/not a JPEG, PNG or WebP/i);
    });

    it('REFUSES an SVG, and explains why', async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
      const response = await upload(svg, { contentType: 'image/svg+xml', filename: 'x.svg' });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toMatch(/SVG is not accepted/);
    });

    it('requires alt text', async () => {
      // NOT NULL in the database, and an image without it is unusable to
      // anybody reading the site with a screen reader.
      const response = await request(server)
        .post(`${PREFIX}/admin/media`)
        .set(auth(staff))
        .field('altText', '   ')
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });

      expect(response.status).toBe(422);
    });

    it('refuses an upload with no file at all', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/media`)
        .set(auth(staff))
        .field('altText', 'A test image with no file');
      expect(response.status).toBe(422);
    });

    it('NEVER uses the original filename in the storage key', async () => {
      /*
        The filename is attacker-controlled. This one tries to traverse, to
        collide, and to end in an extension that changes how a browser treats
        the response — none of it may appear anywhere in the key.
      */
      const response = await upload(PNG, {
        filename: '../../../../etc/passwd.html',
        altText: 'A test image with a hostile filename',
      });

      expect(response.status).toBe(201);
      const key = (response.body as Envelope<{ storageKey: string }>).data!.storageKey;

      expect(key).not.toContain('..');
      expect(key).not.toContain('passwd');
      expect(key).not.toContain('etc');
      expect(key).not.toContain('.html');
      // `<prefix>/<yyyy>/<mm>/<random>.<ext>` — nothing of the caller's in it.
      expect(key).toMatch(/^media\/\d{4}\/\d{2}\/[a-z0-9]+\.(jpg|png|webp)$/);
    });
  });

  // =========================================================================
  describe('public and private', () => {
    it('gives a PUBLIC image a URL', async () => {
      const response = await upload(PNG, { visibility: 'public' });
      const data = (response.body as Envelope<{ url: string }>).data!;
      expect(data.url).toMatch(/^https:\/\//);
    });

    it('gives a PRIVATE image NO public URL, only a signed one', async () => {
      /*
        `media_private_has_no_url` enforces the null in the database. The
        signed URL is a separate, expiring field — so a private image can be
        previewed in the admin screen without ever having a permanent address.
      */
      const response = await upload(PNG, { visibility: 'private' });
      const data = (response.body as Envelope<Record<string, unknown>>).data!;

      expect(data.url).toBeNull();
      expect(data.signedUrl).toMatch(/^https:\/\//);

      const rows = await db().execute(sql`SELECT url FROM media WHERE id = ${data.id}::uuid`);
      expect(rows.rows![0]!.url).toBeNull();
    });

    it('puts private objects in the private bucket', async () => {
      const response = await upload(PNG, { visibility: 'private' });
      const key = (response.body as Envelope<{ storageKey: string }>).data!.storageKey;
      expect(storage.bucketOf(key)).toBe('private');
    });

    it('MOVES the object when visibility changes public → private', async () => {
      /*
        The single most breakable thing in this phase. The two buckets differ
        in exactly the way that matters — one has a public hostname — so
        flipping the column alone would leave a "private" image still served
        from a URL anybody who saw it once can keep using.
      */
      const media = await upload(PNG, { visibility: 'public' });
      const { id, storageKey } = (media.body as Envelope<{ id: string; storageKey: string }>).data!;
      expect(storage.bucketOf(storageKey)).toBe('public');

      const response = await request(server)
        .patch(`${PREFIX}/admin/media/${id}`)
        .set(auth(staff))
        .send({ visibility: 'private' });

      expect(response.status).toBe(200);
      expect(storage.bucketOf(storageKey)).toBe('private');
      expect((response.body as Envelope<{ url: unknown }>).data!.url).toBeNull();
    });

    it('MOVES it back on private → public, and restores the URL', async () => {
      const media = await upload(PNG, { visibility: 'private' });
      const { id, storageKey } = (media.body as Envelope<{ id: string; storageKey: string }>).data!;

      const response = await request(server)
        .patch(`${PREFIX}/admin/media/${id}`)
        .set(auth(staff))
        .send({ visibility: 'public' });

      expect(response.status).toBe(200);
      expect(storage.bucketOf(storageKey)).toBe('public');
      expect((response.body as Envelope<{ url: string }>).data!.url).toMatch(/^https:\/\//);
    });

    it('leaves exactly ONE object after a move, never two', async () => {
      // Copy-then-delete. A move that forgets the delete pays for the object
      // twice and leaves it readable from the bucket it was moved out of.
      const media = await upload(PNG, { visibility: 'public' });
      const { id, storageKey } = (media.body as Envelope<{ id: string; storageKey: string }>).data!;

      await request(server)
        .patch(`${PREFIX}/admin/media/${id}`)
        .set(auth(staff))
        .send({ visibility: 'private' });

      expect(storage.copiesOf(storageKey)).toBe(1);
    });
  });

  // =========================================================================
  describe('metadata', () => {
    it('edits alt text', async () => {
      const media = await upload();
      const id = (media.body as Envelope<{ id: string }>).data!.id;

      const response = await request(server)
        .patch(`${PREFIX}/admin/media/${id}`)
        .set(auth(staff))
        .send({ altText: 'A test image, described better' });

      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ altText: string }>).data!.altText).toBe(
        'A test image, described better',
      );
    });

    it('refuses to blank alt text', async () => {
      const media = await upload();
      const id = (media.body as Envelope<{ id: string }>).data!.id;

      const response = await request(server)
        .patch(`${PREFIX}/admin/media/${id}`)
        .set(auth(staff))
        .send({ altText: '   ' });

      expect(response.status).toBe(422);
    });

    it('REFUSES to edit fields that describe the stored object', async () => {
      /*
        `storageKey`, `mimeType`, `sizeBytes` and `uploadedBy` describe what was
        actually stored. Letting somebody retype them would let the row
        disagree with the object it names — `.strict()` refuses rather than
        silently dropping them.
      */
      const media = await upload();
      const id = (media.body as Envelope<{ id: string }>).data!.id;

      for (const forbidden of [
        { storageKey: 'media/2026/09/somebody-elses.png' },
        { mimeType: 'text/html' },
        { sizeBytes: 1 },
        { uploadedBy: randomUUID() },
        { createdAt: new Date().toISOString() },
      ]) {
        const response = await request(server)
          .patch(`${PREFIX}/admin/media/${id}`)
          .set(auth(staff))
          .send(forbidden);
        expect(response.status, JSON.stringify(forbidden)).toBe(422);
      }
    });
  });

  // =========================================================================
  describe('deletion', () => {
    it('deletes the row AND the object', async () => {
      const media = await upload();
      const { id, storageKey } = (media.body as Envelope<{ id: string; storageKey: string }>).data!;

      await reauth();
      const response = await request(server).delete(`${PREFIX}/admin/media/${id}`).set(auth(staff));

      expect(response.status).toBe(200);
      expect(storage.copiesOf(storageKey)).toBe(0);

      const rows = await db().execute(sql`SELECT id FROM media WHERE id = ${id}::uuid`);
      expect(rows.rows).toHaveLength(0);
    });

    it('REFUSES to delete an image used by a campaign gallery', async () => {
      /*
        ══════════════════════════════════════════════════════════════════════
        THE REGRESSION TEST THIS PHASE MOST NEEDS.

        `campaign_gallery.media_id` is ON DELETE CASCADE. The database would
        not stop this delete — it would quietly remove the gallery row too, and
        a campaign page would lose an image with nothing anywhere recording
        why.

        So the protection is in the service, and this proves it is there.
        ══════════════════════════════════════════════════════════════════════
      */
      const media = await upload();
      const id = (media.body as Envelope<{ id: string }>).data!.id;

      const [campaign] = (await db().execute(sql`SELECT id FROM campaigns LIMIT 1`)).rows as {
        id: string;
      }[];

      await db().execute(sql`
        INSERT INTO campaign_gallery (campaign_id, media_id, display_order)
        VALUES (${campaign!.id}::uuid, ${id}::uuid, 99)
      `);

      await reauth();
      const response = await request(server).delete(`${PREFIX}/admin/media/${id}`).set(auth(staff));

      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toMatch(/in use/i);

      // And nothing was destroyed on the way to refusing.
      const rows = await db().execute(sql`SELECT id FROM media WHERE id = ${id}::uuid`);
      expect(rows.rows).toHaveLength(1);
      const gallery = await db().execute(
        sql`SELECT media_id FROM campaign_gallery WHERE media_id = ${id}::uuid`,
      );
      expect(gallery.rows).toHaveLength(1);
    });

    it('reports where an image is used, so the refusal is actionable', async () => {
      const media = await upload();
      const id = (media.body as Envelope<{ id: string }>).data!.id;

      const [campaign] = (await db().execute(sql`SELECT id FROM campaigns LIMIT 1`)).rows as {
        id: string;
      }[];
      await db().execute(sql`
        INSERT INTO campaign_gallery (campaign_id, media_id, display_order)
        VALUES (${campaign!.id}::uuid, ${id}::uuid, 98)
      `);

      const response = await request(server).get(`${PREFIX}/admin/media/${id}`).set(auth(staff));
      const references = (response.body as Envelope<{ references: { kind: string }[] }>).data!
        .references;

      expect(references.length).toBeGreaterThan(0);
      expect(references[0]!.kind).toContain('campaign gallery');
    });
  });

  // =========================================================================
  describe('listing and audit', () => {
    it('paginates rather than returning everything', async () => {
      const response = await request(server).get(`${PREFIX}/admin/media?limit=2`).set(auth(staff));

      const body = response.body as Envelope<{ items: unknown[]; pagination: { limit: number } }>;
      expect(body.data!.items.length).toBeLessThanOrEqual(2);
      expect(body.data!.pagination.limit).toBe(2);
    });

    it('searches alt text', async () => {
      await upload(PNG, { altText: 'A test image of a distinctive kingfisher' });

      const response = await request(server)
        .get(`${PREFIX}/admin/media?q=kingfisher`)
        .set(auth(staff));

      const items = (response.body as Envelope<{ items: { altText: string }[] }>).data!.items;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]!.altText).toContain('kingfisher');
    });

    it('writes audit entries for upload, update and delete', async () => {
      const media = await upload();
      const id = (media.body as Envelope<{ id: string }>).data!.id;

      await request(server)
        .patch(`${PREFIX}/admin/media/${id}`)
        .set(auth(staff))
        .send({ altText: 'A test image, audited' });

      await reauth();
      await request(server).delete(`${PREFIX}/admin/media/${id}`).set(auth(staff));

      const rows = await db().execute(sql`
        SELECT action, severity, new_values::text AS new_values, actor_email_snapshot
          FROM audit_logs WHERE entity_id = ${id}::uuid ORDER BY created_at
      `);

      const actions = (rows.rows ?? []).map((row) => row.action);
      expect(actions).toContain('media.upload');
      expect(actions).toContain('media.update');
      expect(actions).toContain('media.delete');

      // Metadata only — never the file itself.
      const uploadRow = (rows.rows ?? []).find((row) => row.action === 'media.upload')!;
      expect(uploadRow.new_values as string).not.toContain('iVBORw0KGgo');
      expect(uploadRow.actor_email_snapshot).toBe(TEST_USERS.superAdmin);
    });
  });
});
