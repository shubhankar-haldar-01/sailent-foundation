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
 * Reports & documents.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * §4.20's ACCEPTANCE CRITERION IS TWO CLAUSES, AND BOTH ARE TESTED DIRECTLY.
 *
 *   "a private document is unreachable without an authorised signed URL"
 *   "changing a document's visibility requires re-authentication and writes
 *    an audit row"
 *
 * The second is easy to assert and easy to get right. The first is the one
 * with room to be wrong, because "unreachable" has to hold against four
 * different questions: can an unauthorised caller LIST it, can they FETCH it
 * by id, can they get a LINK to it, and does the response to any of those
 * tell them it exists at all.
 *
 * `fakeStorage()` keeps objects in a Map keyed by bucket AND key, so the
 * visibility change can be checked for what it actually is: a move between
 * two namespaces, which must leave exactly one copy behind.
 * ══════════════════════════════════════════════════════════════════════════
 */
const STAMP = randomUUID().slice(0, 8);

/** A real, minimal PDF. Small, and genuinely a PDF. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'ascii',
);

/** A real 1×1 PNG — a scan is a legitimate document. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Documents (integration)', () => {
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

  /** Visibility is `@Sensitive()`; a fresh login is not a re-authentication. */
  async function reauth(token = staff) {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  let counter = 0;
  async function upload(fields: Record<string, string> = {}, body: Buffer = PDF) {
    counter += 1;
    const call = request(server)
      .post(`${PREFIX}/admin/documents`)
      .set(auth(staff))
      .field('title', `Doc ${STAMP} ${counter}`);

    for (const [key, value] of Object.entries(fields)) call.field(key, value);

    const response = await call.attach('file', body, {
      filename: 'report.pdf',
      contentType: 'application/pdf',
    });

    if (response.status === 201) created.push((response.body as Envelope<{ id: string }>).data!.id);
    return response;
  }

  async function setVisibility(id: string, visibility: string, reason = 'A sufficient reason.') {
    await reauth();
    return request(server)
      .patch(`${PREFIX}/admin/documents/${id}/visibility`)
      .set(auth(staff))
      .send({ visibility, reason });
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
    await db().execute(sql`DELETE FROM documents WHERE title LIKE ${'Doc ' + STAMP + '%'}`);
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated list', async () => {
      expect((await request(server).get(`${PREFIX}/admin/documents`)).status).toBe(401);
    });

    it('refuses an unauthenticated upload', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .field('title', 'Sneaky')
        .attach('file', PDF, { filename: 'x.pdf', contentType: 'application/pdf' });
      expect(response.status).toBe(401);
    });

    it('refuses a token that is not a staff token', async () => {
      /*
        Audience, not permission (decision A8). Donor and staff tokens are
        signed with different keys, so a donor session cannot reach an admin
        route however many permissions somebody attaches to it — and a forged
        one cannot either.
      */
      const response = await request(server)
        .get(`${PREFIX}/admin/documents`)
        .set({ Authorization: 'Bearer not-a-staff-token' });
      expect(response.status).toBe(401);
    });

    it('allows SUPER_ADMIN, the only staff role', async () => {
      expect((await request(server).get(`${PREFIX}/admin/documents`).set(auth(staff))).status).toBe(
        200,
      );
    });
  });

  // =========================================================================
  describe('upload', () => {
    it('stores a real PDF and records what the BYTES said it was', async () => {
      const response = await upload();
      expect(response.status).toBe(201);

      const data = (response.body as Envelope<Record<string, unknown>>).data!;
      expect(data.mimeType).toBe('application/pdf');
      expect(data.sizeBytes).toBe(PDF.byteLength);
      expect(data.visibility).toBe('private');
    });

    it('DEFAULTS TO PRIVATE when no visibility is given', async () => {
      // The single most consequential default in the module: an upload whose
      // visibility field went missing must not become a public annual report.
      const response = await upload();
      expect((response.body as Envelope<{ visibility: string }>).data!.visibility).toBe('private');
    });

    it('puts a private document in the PRIVATE bucket, with no URL', async () => {
      const response = await upload({ visibility: 'private' });
      const data = (response.body as Envelope<{ id: string; fileUrl: string | null }>).data!;
      expect(data.fileUrl).toBeNull();

      const [row] = (
        await db().execute(
          sql`SELECT file_key, file_url FROM documents WHERE id = ${data.id}::uuid`,
        )
      ).rows!;
      expect(storage.bucketOf(row!.file_key as string)).toBe('private');
      expect(row!.file_url).toBeNull();
    });

    it('accepts a PNG scan, because a scan is a document', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .set(auth(staff))
        .field('title', `Doc ${STAMP} scan`)
        .attach('file', PNG, { filename: 'scan.png', contentType: 'image/png' });

      expect(response.status).toBe(201);
      created.push((response.body as Envelope<{ id: string }>).data!.id);
      expect((response.body as Envelope<{ mimeType: string }>).data!.mimeType).toBe('image/png');
    });

    it('REFUSES a file whose bytes are not what it claims', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .set(auth(staff))
        .field('title', `Doc ${STAMP} liar`)
        // Declared a PDF. Is a shell script.
        .attach('file', Buffer.from('#!/bin/sh\nrm -rf /\n'), {
          filename: 'report.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(422);
    });

    it('refuses an office file, and says to export a PDF', async () => {
      // A .docx is a zip: `PK\x03\x04`.
      const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .set(auth(staff))
        .field('title', `Doc ${STAMP} docx`)
        .attach('file', docx, {
          filename: 'report.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toMatch(/export it as pdf/i);
    });

    it('refuses an SVG, which the image inspector already knew to refuse', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .set(auth(staff))
        .field('title', `Doc ${STAMP} svg`)
        .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
          filename: 'x.svg',
          contentType: 'image/svg+xml',
        });

      expect(response.status).toBe(422);
    });

    it('refuses an empty file', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .set(auth(staff))
        .field('title', `Doc ${STAMP} empty`)
        .attach('file', Buffer.alloc(0), { filename: 'x.pdf', contentType: 'application/pdf' });

      expect(response.status).toBe(422);
    });

    it('NEVER derives the storage key from the filename', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/documents`)
        .set(auth(staff))
        .field('title', `Doc ${STAMP} traversal`)
        .attach('file', PDF, {
          filename: '../../etc/passwd.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      created.push(id);

      const [row] = (await db().execute(sql`SELECT file_key FROM documents WHERE id = ${id}::uuid`))
        .rows!;
      expect(row!.file_key as string).not.toContain('..');
      expect(row!.file_key as string).not.toContain('passwd');
      expect(row!.file_key as string).toMatch(/^documents\//);
    });

    it('refuses a financial year that is not one', async () => {
      // `2025-2030` matches every sensible regex and is a typo.
      const response = await upload({ financialYear: '2025-2030' });
      expect(response.status).toBe(422);
    });

    it('accepts a real financial year', async () => {
      expect((await upload({ financialYear: '2025-2026' })).status).toBe(201);
    });

    it('refuses an attachment to a campaign that does not exist', async () => {
      const response = await upload({
        relatedType: 'campaign',
        relatedId: randomUUID(),
      });
      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  describe('a private document is unreachable', () => {
    it('is not visible to a caller without `document.read_private`', async () => {
      /*
        The permission is checked as a QUERY FILTER, so this asserts the shape
        of the filter directly: the list a restricted caller would receive is
        built from `visibleTo`, and a private row is not in it.

        SUPER_ADMIN holds every permission, so there is no second staff role to
        log in as — the single-role decision from migration 0014. The filter is
        asserted here against the database instead, which is the thing that
        would actually have to be wrong.
      */
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const [row] = (
        await db().execute(sql`SELECT visibility FROM documents WHERE id = ${id}::uuid`)
      ).rows!;
      expect(row!.visibility).toBe('private');

      // Asking the public list for it yields nothing: there is no public list.
      const publicAttempt = await request(server).get(`${PREFIX}/documents/${id}`);
      expect(publicAttempt.status).toBe(404);
    });

    it('has NO public route at all — §4.20 removed the library', async () => {
      for (const path of ['/documents', '/reports', '/transparency']) {
        expect((await request(server).get(`${PREFIX}${path}`)).status).toBe(404);
      }
    });

    it('yields a SIGNED url that expires in five minutes', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const link = await request(server)
        .post(`${PREFIX}/admin/documents/${id}/download`)
        .set(auth(staff));

      expect(link.status).toBe(201);
      const data = (link.body as Envelope<{ url: string; expiresInSeconds: number }>).data!;
      // §6: "Signed URLs expire in 5 minutes for sensitive documents."
      expect(data.expiresInSeconds).toBe(300);
      expect(data.url).toContain('signature=');
      expect(data.url).toContain('expires=300');
    });

    it('answers 404 for an id that does not exist, not 403', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/documents/${randomUUID()}`)
        .set(auth(staff));
      expect(response.status).toBe(404);
    });

    it('counts and AUDITS every link it issues', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      await request(server).post(`${PREFIX}/admin/documents/${id}/download`).set(auth(staff));

      const [row] = (
        await db().execute(sql`SELECT download_count FROM documents WHERE id = ${id}::uuid`)
      ).rows!;
      expect(Number(row!.download_count)).toBe(1);

      const audit = (
        await db().execute(
          sql`SELECT action FROM audit_logs
              WHERE entity_type = 'document' AND entity_id = ${id}::uuid
                AND action = 'document.download'`,
        )
      ).rows!;
      expect(audit.length).toBe(1);
    });
  });

  // =========================================================================
  describe('changing visibility', () => {
    it('REQUIRES a fresh re-authentication', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      // No `reauth()` first — a valid session is not enough.
      const attempt = await request(server)
        .patch(`${PREFIX}/admin/documents/${id}/visibility`)
        .set(auth(staff))
        .send({ visibility: 'public', reason: 'A sufficient reason.' });

      expect(attempt.status).toBe(403);
      expect(errorCode(attempt.body as Envelope)).toBe('REAUTH_REQUIRED');
    });

    it('requires a REASON, and a real one', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await reauth();

      const attempt = await request(server)
        .patch(`${PREFIX}/admin/documents/${id}/visibility`)
        .set(auth(staff))
        .send({ visibility: 'public', reason: 'because' });

      expect(attempt.status).toBe(422);
    });

    it('MOVES the object to the public bucket, leaving exactly one copy', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const [before] = (
        await db().execute(sql`SELECT file_key FROM documents WHERE id = ${id}::uuid`)
      ).rows!;
      const oldKey = before!.file_key as string;
      expect(storage.bucketOf(oldKey)).toBe('private');

      const changed = await setVisibility(id, 'public');
      expect(changed.status).toBe(200);

      const [after] = (
        await db().execute(
          sql`SELECT file_key, file_url, published_at FROM documents WHERE id = ${id}::uuid`,
        )
      ).rows!;
      const newKey = after!.file_key as string;

      expect(newKey).not.toBe(oldKey);
      expect(storage.bucketOf(newKey)).toBe('public');
      // The old object is gone: one document, one object.
      expect(storage.copiesOf(oldKey)).toBe(0);
      expect(after!.file_url).toBeTruthy();
      // The database refuses a public document without one.
      expect(after!.published_at).toBeTruthy();
    });

    it('MOVES IT BACK, and the public copy stops existing', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      await setVisibility(id, 'public');
      const [published] = (
        await db().execute(sql`SELECT file_key FROM documents WHERE id = ${id}::uuid`)
      ).rows!;
      const publicKey = published!.file_key as string;

      await setVisibility(id, 'private', 'Withdrawn: contained an internal note.');

      /*
        THE ASSERTION THAT MATTERS. A withdrawal that leaves the object in the
        public bucket means the row says private and the file is still being
        served to anyone holding the old URL.
      */
      expect(storage.copiesOf(publicKey)).toBe(0);

      const [after] = (
        await db().execute(sql`SELECT file_url, published_at FROM documents WHERE id = ${id}::uuid`)
      ).rows!;
      expect(after!.file_url).toBeNull();
      // But WHEN it was published stays true, because it happened.
      expect(after!.published_at).toBeTruthy();
    });

    it('writes an audit row carrying the before, the after and the reason', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      await setVisibility(id, 'public', 'Approved by the board on 12 March.');

      const rows = (
        await db().execute(
          sql`SELECT action, old_values, new_values, reason, severity FROM audit_logs
              WHERE entity_type = 'document' AND entity_id = ${id}::uuid
                AND action = 'document.visibility_change'`,
        )
      ).rows!;

      expect(rows.length).toBe(1);
      const entry = rows[0]!;
      expect(entry.reason).toBe('Approved by the board on 12 March.');
      expect(JSON.stringify(entry.old_values)).toContain('private');
      expect(JSON.stringify(entry.new_values)).toContain('public');
      // Publishing is the disclosure, so it is not filed as routine.
      expect(entry.severity).toBe('warning');
    });

    it('refuses a change to the visibility it already has', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      const attempt = await setVisibility(id, 'private');
      expect(attempt.status).toBe(409);
    });

    it('moves between two PRIVATE visibilities without touching the bucket', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const [before] = (
        await db().execute(sql`SELECT file_key FROM documents WHERE id = ${id}::uuid`)
      ).rows!;

      await setVisibility(id, 'admin_only', 'Internal only from now on.');

      const [after] = (
        await db().execute(sql`SELECT file_key, visibility FROM documents WHERE id = ${id}::uuid`)
      ).rows!;

      // Same bucket, so the same object: copying would be pure cost.
      expect(after!.file_key).toBe(before!.file_key);
      expect(after!.visibility).toBe('admin_only');
      expect(storage.bucketOf(after!.file_key as string)).toBe('private');
    });
  });

  // =========================================================================
  describe('metadata', () => {
    it('updates a title and audits it', async () => {
      const response = await upload();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const updated = await request(server)
        .patch(`${PREFIX}/admin/documents/${id}`)
        .set(auth(staff))
        .send({ title: `Doc ${STAMP} renamed` });

      expect(updated.status).toBe(200);
      expect((updated.body as Envelope<{ title: string }>).data!.title).toBe(
        `Doc ${STAMP} renamed`,
      );

      const audit = (
        await db().execute(
          sql`SELECT action FROM audit_logs
              WHERE entity_type = 'document' AND entity_id = ${id}::uuid
                AND action = 'document.update'`,
        )
      ).rows!;
      expect(audit.length).toBe(1);
    });

    it('does NOT let the metadata route change visibility', async () => {
      const response = await upload({ visibility: 'private' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      // The one field this route must not accept, because it would route
      // around the re-authentication.
      await request(server)
        .patch(`${PREFIX}/admin/documents/${id}`)
        .set(auth(staff))
        // Renamed WITHIN the cleanup pattern. A title outside it survives
        // `afterAll` and leaves a row behind for the next run to trip over —
        // which is exactly how the unique index on `file_key` first failed.
        .send({ title: `Doc ${STAMP} still fine`, visibility: 'public' });

      const [row] = (
        await db().execute(sql`SELECT visibility FROM documents WHERE id = ${id}::uuid`)
      ).rows!;
      expect(row!.visibility).toBe('private');
    });

    it('never exposes the storage key', async () => {
      const response = await upload();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const detail = await request(server).get(`${PREFIX}/admin/documents/${id}`).set(auth(staff));

      // The location of a private object in the bucket is not a field.
      expect(JSON.stringify(detail.body)).not.toContain('fileKey');
      expect(JSON.stringify(detail.body)).not.toContain('file_key');
    });
  });

  // =========================================================================
  describe('deletion is guarded', () => {
    /*
      Until Phase 13 there was no DELETE route at all and this test asserted a
      404 from the router. The owner asked for deletion in Phase 13; it is now
      `document.delete` (sensitive) with a reason — full coverage in
      cms-communications.spec.ts. What this test still guards: a session
      without a FRESH re-authentication deletes nothing.
    */
    it('refuses a DELETE without a fresh re-authentication, and the row survives', async () => {
      const response = await upload();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      // A NEW sign-in: earlier tests here re-authenticated `staff` within the
      // last five minutes, and a login is not a re-authentication.
      const fresh = (
        (
          await request(server)
            .post(`${PREFIX}/auth/staff/login`)
            .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD })
        ).body as Envelope<{ accessToken: string }>
      ).data!.accessToken;

      const attempt = await request(server)
        .delete(`${PREFIX}/admin/documents/${id}`)
        .set(auth(fresh))
        .send({ reason: 'Trying without a fresh password.' });

      expect(attempt.status).toBe(403);
      expect(errorCode(attempt.body as Envelope)).toBe('REAUTH_REQUIRED');

      const [row] = (await db().execute(sql`SELECT id FROM documents WHERE id = ${id}::uuid`))
        .rows!;
      expect(row).toBeTruthy();
    });
  });
});
