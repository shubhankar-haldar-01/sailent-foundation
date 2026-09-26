import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import { StorageService } from '../src/modules/storage/storage.service.js';
import {
  PREFIX,
  TEST_PASSWORD,
  TEST_USERS,
  createTestApp,
  devTotpCode,
  type Envelope,
} from './harness.js';

/**
 * THE REAL CLOUDFLARE R2 ROUND-TRIP.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS MOCKED. This talks to the actual buckets.
 *
 * `media.spec.ts` substitutes storage so the rules can be tested without
 * credentials. That is the right trade for a suite that must always run — but
 * it proves the rules, not the provider. A fake cannot tell you that R2
 * rejects a key, that a signed URL actually resolves, that public access is
 * really enabled on the public bucket, or that a copy-then-delete leaves what
 * it should.
 *
 * So this exists, and it is SKIPPED when R2 is unconfigured rather than faked
 * — a skipped test says "not verified", a faked one says "verified" and is
 * lying.
 *
 * SAFETY: every object is written under `media/` with a random key generated
 * by the service, and every one is removed in teardown. Nothing pre-existing
 * is read, moved or deleted. The database is the LOCAL test one.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Real images, not buffers of zeroes — the validator reads their signatures. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const WEBP = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');

const configured = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_PUBLIC_BASE_URL,
);

describe.skipIf(!configured)('Cloudflare R2 round-trip (REAL)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let storage: StorageService;
  let staff: string;

  /** Everything this run created, as `[bucket, key]`, for teardown. */
  const written: { bucket: 'public' | 'private'; key: string }[] = [];
  const rows: string[] = [];

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function reauth() {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(staff))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  async function upload(body: Buffer, contentType: string, visibility: 'public' | 'private') {
    const response = await request(server)
      .post(`${PREFIX}/admin/media`)
      .set(auth(staff))
      .field('altText', `R2 round-trip ${visibility} ${Date.now()}`)
      .field('visibility', visibility)
      .attach('file', body, { filename: 'upload.bin', contentType });

    if (response.status === 201) {
      const data = (response.body as Envelope<{ id: string; storageKey: string }>).data!;
      rows.push(data.id);
      written.push({ bucket: visibility, key: data.storageKey });
    }
    return response;
  }

  beforeAll(async () => {
    // NO storage override — this is the real service against the real buckets.
    app = await createTestApp();
    server = app.getHttpServer();
    storage = app.get(StorageService);

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    /*
      Remove every object this run created, from BOTH buckets — a move may have
      left it in either. Failures are swallowed: teardown must not mask a real
      result, and a stray test object costs a fraction of a penny.
    */
    for (const { key } of written) {
      for (const bucket of ['public', 'private'] as const) {
        await storage.delete(bucket, key).catch(() => undefined);
      }
    }
    for (const id of rows) {
      await db()
        .execute(sql`DELETE FROM media WHERE id = ${id}::uuid`)
        .catch(() => undefined);
    }
    await db()
      .execute(sql`DELETE FROM media WHERE alt_text LIKE 'R2 round-trip%'`)
      .catch(() => undefined);
    await app?.close();
  }, 60_000);

  // =========================================================================
  it('1–5. uploads a JPEG to the PUBLIC bucket, records it, and serves it', async () => {
    const response = await upload(JPEG, 'image/jpeg', 'public');
    expect(response.status).toBe(201);

    const data = (response.body as Envelope<Record<string, unknown>>).data!;
    const key = data.storageKey as string;

    // 3. The object is really in sailent-public.
    expect(await storage.exists('public', key)).toBe(true);
    // …and NOT in the private bucket.
    expect(await storage.exists('private', key)).toBe(false);

    // 4. The row exists, with metadata read from the file itself.
    const stored = await db().execute(sql`
      SELECT mime_type, size_bytes, width, height, visibility, url FROM media
       WHERE storage_key = ${key}
    `);
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows![0]!.mime_type).toBe('image/jpeg');
    expect(Number(stored.rows![0]!.size_bytes)).toBe(JPEG.byteLength);
    expect(stored.rows![0]!.visibility).toBe('public');

    // 5. The public URL actually resolves and returns the bytes.
    const url = data.url as string;
    expect(url).toContain(key);

    const fetched = await fetch(url);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get('content-type')).toContain('image/jpeg');
    expect((await fetched.arrayBuffer()).byteLength).toBe(JPEG.byteLength);
  }, 60_000);

  it('2. uploads a PNG and a WebP, reading their real dimensions', async () => {
    const png = await upload(PNG, 'image/png', 'public');
    expect(png.status).toBe(201);
    expect((png.body as Envelope<Record<string, unknown>>).data!).toMatchObject({
      mimeType: 'image/png',
      width: 1,
      height: 1,
    });

    const webp = await upload(WEBP, 'image/webp', 'public');
    expect(webp.status).toBe(201);
    expect((webp.body as Envelope<{ mimeType: string }>).data!.mimeType).toBe('image/webp');
  }, 60_000);

  it('refuses a disguised file against the real bucket too', async () => {
    // The validator runs before storage is touched, so nothing is written.
    const response = await upload(Buffer.from('#!/bin/sh\necho hi\n'), 'image/png', 'public');
    expect(response.status).toBe(422);
  }, 60_000);

  // =========================================================================
  it('6–8. a PRIVATE object has no public URL, and its signed URL works', async () => {
    const response = await upload(PNG, 'image/png', 'private');
    expect(response.status).toBe(201);

    const data = (response.body as Envelope<Record<string, unknown>>).data!;
    const key = data.storageKey as string;

    // 6. It is in sailent-private, not sailent-public.
    expect(await storage.exists('private', key)).toBe(true);
    expect(await storage.exists('public', key)).toBe(false);

    // 7. No public URL — in the response and in the database.
    expect(data.url).toBeNull();
    const stored = await db().execute(sql`SELECT url FROM media WHERE storage_key = ${key}`);
    expect(stored.rows![0]!.url).toBeNull();

    /*
      And the public hostname genuinely cannot reach it. This is the assertion
      the whole two-bucket design exists for: if the private bucket were
      public, or if the object had gone to the wrong one, this would return 200.
    */
    const publicAttempt = await fetch(`${process.env.R2_PUBLIC_BASE_URL}/${key}`);
    expect(publicAttempt.status).toBeGreaterThanOrEqual(400);

    // 8. The signed URL does resolve.
    const signed = await storage.signedUrl(key);
    const fetched = await fetch(signed);
    expect(fetched.status).toBe(200);
    expect((await fetched.arrayBuffer()).byteLength).toBe(PNG.byteLength);
  }, 60_000);

  // =========================================================================
  it('9–12. moves public → private, leaving exactly one copy', async () => {
    const response = await upload(JPEG, 'image/jpeg', 'public');
    const { id, storageKey: key } = (response.body as Envelope<{ id: string; storageKey: string }>)
      .data!;

    expect(await storage.exists('public', key)).toBe(true);

    const moved = await request(server)
      .patch(`${PREFIX}/admin/media/${id}`)
      .set(auth(staff))
      .send({ visibility: 'private' });
    expect(moved.status).toBe(200);

    // 11. The copy survived — the delete removed the OLD object, not the new one.
    expect(await storage.exists('private', key)).toBe(true);
    // 12. …and the old one is gone.
    expect(await storage.exists('public', key)).toBe(false);

    // The URL is cleared, and the old public address stops working.
    expect((moved.body as Envelope<{ url: unknown }>).data!.url).toBeNull();
    const publicAttempt = await fetch(`${process.env.R2_PUBLIC_BASE_URL}/${key}`);
    expect(publicAttempt.status).toBeGreaterThanOrEqual(400);
  }, 60_000);

  it('10. moves private → public, and the image becomes fetchable', async () => {
    const response = await upload(PNG, 'image/png', 'private');
    const { id, storageKey: key } = (response.body as Envelope<{ id: string; storageKey: string }>)
      .data!;

    const moved = await request(server)
      .patch(`${PREFIX}/admin/media/${id}`)
      .set(auth(staff))
      .send({ visibility: 'public' });
    expect(moved.status).toBe(200);

    expect(await storage.exists('public', key)).toBe(true);
    expect(await storage.exists('private', key)).toBe(false);

    const url = (moved.body as Envelope<{ url: string }>).data!.url;
    expect(url).toBeTruthy();
    expect((await fetch(url)).status).toBe(200);
  }, 60_000);

  // =========================================================================
  it('13. persists a metadata change without touching the object', async () => {
    const response = await upload(PNG, 'image/png', 'public');
    const { id, storageKey: key } = (response.body as Envelope<{ id: string; storageKey: string }>)
      .data!;

    const updated = await request(server)
      .patch(`${PREFIX}/admin/media/${id}`)
      .set(auth(staff))
      .send({ altText: 'R2 round-trip described differently', caption: 'A caption' });

    expect(updated.status).toBe(200);
    expect((updated.body as Envelope<{ altText: string }>).data!.altText).toBe(
      'R2 round-trip described differently',
    );
    // The bytes are untouched by a metadata edit.
    expect(await storage.exists('public', key)).toBe(true);
  }, 60_000);

  // =========================================================================
  it('14. REFUSES to delete an image a campaign gallery references', async () => {
    const response = await upload(PNG, 'image/png', 'public');
    const { id, storageKey: key } = (response.body as Envelope<{ id: string; storageKey: string }>)
      .data!;

    const [campaign] = (await db().execute(sql`SELECT id FROM campaigns LIMIT 1`)).rows as {
      id: string;
    }[];
    await db().execute(sql`
      INSERT INTO campaign_gallery (campaign_id, media_id, display_order)
      VALUES (${campaign!.id}::uuid, ${id}::uuid, 97)
    `);

    await reauth();
    const deleted = await request(server).delete(`${PREFIX}/admin/media/${id}`).set(auth(staff));

    expect(deleted.status).toBe(409);
    // 16. And nothing was destroyed on the way to refusing — in either place.
    expect(await storage.exists('public', key)).toBe(true);
    const stored = await db().execute(sql`SELECT id FROM media WHERE id = ${id}::uuid`);
    expect(stored.rows).toHaveLength(1);

    await db().execute(sql`DELETE FROM campaign_gallery WHERE media_id = ${id}::uuid`);
  }, 60_000);

  it('15–16. deletes an unreferenced image from both the database and R2', async () => {
    const response = await upload(PNG, 'image/png', 'public');
    const { id, storageKey: key } = (response.body as Envelope<{ id: string; storageKey: string }>)
      .data!;

    expect(await storage.exists('public', key)).toBe(true);

    await reauth();
    const deleted = await request(server).delete(`${PREFIX}/admin/media/${id}`).set(auth(staff));
    expect(deleted.status).toBe(200);

    // 16. Row and object both gone — no dangling reference, no orphan.
    expect(await storage.exists('public', key)).toBe(false);
    const stored = await db().execute(sql`SELECT id FROM media WHERE id = ${id}::uuid`);
    expect(stored.rows).toHaveLength(0);

    // And the public URL stops serving it.
    const fetched = await fetch(`${process.env.R2_PUBLIC_BASE_URL}/${key}`);
    expect(fetched.status).toBeGreaterThanOrEqual(400);
  }, 60_000);
});
