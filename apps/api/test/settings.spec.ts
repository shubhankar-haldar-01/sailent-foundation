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
 * Organisation settings.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE THING THIS MUST NOT BECOME IS `/me/settings`.
 *
 * That route is a DONOR's own preferences on the donor token audience. These
 * are the organisation's, on the staff audience, and they include the PAN and
 * the 80G number printed on every receipt. Different data, different people,
 * and the only thing they share is the word — so the first tests here are
 * about who can reach what.
 * ══════════════════════════════════════════════════════════════════════════
 */
describe('Settings (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** The update is `@Sensitive()`; a fresh login is not a re-authentication. */
  async function reauth(token = staff) {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  let original: Record<string, unknown> = {};

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;

    await reauth();
    const current = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
    original = (current.body as Envelope<Record<string, unknown>>).data ?? {};
  }, 60_000);

  afterAll(async () => {
    // Settings are shared reference data, not fixtures this suite owns. Put
    // them back exactly, or every later run starts from whatever this one left.
    for (const [key, value] of Object.entries(original)) {
      await db().execute(sql`
        UPDATE settings SET value = ${JSON.stringify(value)}::jsonb WHERE key = ${key}
      `);
    }
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated read', async () => {
      // `registration_details` holds the organisation's PAN.
      const response = await request(server).get(`${PREFIX}/admin/settings`);
      expect(response.status).toBe(401);
    });

    it('refuses an unauthenticated write', async () => {
      const response = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .send({ organization_name: 'Not The Foundation' });
      expect(response.status).toBe(401);
    });

    it('refuses a DONOR token outright', async () => {
      /*
        Not a permission failure — an audience one. A donor token is signed
        with a different key and does not verify on a staff route at all, which
        is the boundary that keeps `/me/settings` and this apart no matter what
        a future permission edit does.
      */
      const response = await request(server)
        .get(`${PREFIX}/admin/settings`)
        .set(auth('not-a-staff-token'));
      expect(response.status).toBe(401);
    });

    it('lets a staff member read', async () => {
      const response = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      expect(response.status).toBe(200);
    });

    it('requires a FRESH re-authentication to write', async () => {
      // A new session has never re-authenticated, so the sensitive gate closes.
      const fresh = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD });
      const token = (fresh.body as Envelope<{ accessToken: string }>).data!.accessToken;

      const response = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(token))
        .send({ organization_name: 'Renamed Without Re-auth' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });
  });

  // =========================================================================
  describe('reading', () => {
    it('returns every known setting and nothing else', async () => {
      const response = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      const data = (response.body as Envelope<Record<string, unknown>>).data!;

      // Six since Phase 13 (migration 0023 added the two organisation rows).
      expect(Object.keys(data).sort()).toEqual([
        'donation_minimum_paise',
        'fcra_enabled',
        'organization_contact',
        'organization_name',
        'organization_social',
        'registration_details',
      ]);
    });

    it('returns each value in its own type, not as strings', async () => {
      // The column is `jsonb`. A number arriving as "1000" would fail far away
      // from the edit that caused it.
      const response = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      const data = (response.body as Envelope<Record<string, unknown>>).data!;

      expect(typeof data.organization_name).toBe('string');
      expect(typeof data.donation_minimum_paise).toBe('number');
      expect(typeof data.fcra_enabled).toBe('boolean');
      expect(typeof data.registration_details).toBe('object');
    });
  });

  // =========================================================================
  describe('validation', () => {
    async function patch(body: Record<string, unknown>) {
      await reauth();
      return request(server).patch(`${PREFIX}/admin/settings`).set(auth(staff)).send(body);
    }

    it('refuses an empty organisation name', async () => {
      // It goes on every receipt. A receipt from nobody is worse than none.
      expect((await patch({ organization_name: '   ' })).status).toBe(422);
    });

    it('refuses a negative or fractional minimum', async () => {
      expect((await patch({ donation_minimum_paise: -1 })).status).toBe(422);
      // Money is integer paise everywhere (decision A2).
      expect((await patch({ donation_minimum_paise: 10.5 })).status).toBe(422);
    });

    it('refuses a malformed PAN', async () => {
      const response = await patch({
        registration_details: {
          registrationNumber: null,
          pan: 'NOTAPAN',
          section12A: null,
          section80G: null,
        },
      });
      expect(response.status).toBe(422);
    });

    it('refuses a key nobody reads', async () => {
      /*
        The key set is closed. A key/value table with an open write route fills
        up with settings that look meaningful and govern nothing.
      */
      expect((await patch({ made_up_setting: true })).status).toBe(422);
    });

    it('refuses an unknown field inside registration details', async () => {
      const response = await patch({
        registration_details: {
          registrationNumber: null,
          pan: null,
          section12A: null,
          section80G: null,
          csrNumber: 'CSR123',
        },
      });
      expect(response.status).toBe(422);
    });

    it('refuses an empty update', async () => {
      expect((await patch({})).status).toBe(422);
    });

    it('accepts null identifiers, which mean "not issued yet"', async () => {
      // The launch-blocking state the seed describes. An empty string would
      // read as "supplied, and blank".
      const response = await patch({
        registration_details: {
          registrationNumber: null,
          pan: null,
          section12A: null,
          section80G: null,
        },
      });
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  describe('writing', () => {
    it('saves a change and returns the new state', async () => {
      await reauth();
      const response = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(staff))
        .send({ organization_name: 'Sailent Foundation (test)' });

      expect(response.status).toBe(200);
      expect(
        (response.body as Envelope<{ organization_name: string }>).data!.organization_name,
      ).toBe('Sailent Foundation (test)');
    });

    it('leaves untouched settings ALONE', async () => {
      await reauth();
      const before = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      const minimumBefore = (before.body as Envelope<{ donation_minimum_paise: number }>).data!
        .donation_minimum_paise;

      await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(staff))
        .send({ organization_name: 'Only The Name Changed' });

      const after = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      expect(
        (after.body as Envelope<{ donation_minimum_paise: number }>).data!.donation_minimum_paise,
      ).toBe(minimumBefore);
    });

    it('records ONE audit entry holding only what changed', async () => {
      await reauth();
      await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(staff))
        .send({ organization_name: 'Audited Name', reason: 'Testing the audit entry' });

      const rows = await db().execute(sql`
        SELECT action, severity, reason, old_values, new_values, actor_email_snapshot
          FROM audit_logs
         WHERE action = 'settings.update'
         ORDER BY created_at DESC LIMIT 1
      `);

      const entry = rows.rows![0]!;
      expect(entry.action).toBe('settings.update');
      // Statutory identifiers and the name on every receipt. Not routine.
      expect(entry.severity).toBe('warning');
      expect(entry.reason).toBe('Testing the audit entry');
      // Only the changed key, not a dump of all four.
      expect(Object.keys(entry.new_values as Record<string, unknown>)).toEqual([
        'organization_name',
      ]);
      expect((entry.new_values as Record<string, unknown>).organization_name).toBe('Audited Name');
      // The Phase 8 snapshot behaviour, still working.
      expect(entry.actor_email_snapshot).toBe(TEST_USERS.superAdmin);
    });

    it('does not roll a rejected value halfway in', async () => {
      /*
        Both keys in one statement, one of them invalid. The transaction must
        leave neither applied — a name saved beside registration details that
        were refused is the kind of partial state nobody goes looking for.
      */
      await reauth();
      const before = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      const nameBefore = (before.body as Envelope<{ organization_name: string }>).data!
        .organization_name;

      const response = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(staff))
        .send({
          organization_name: 'Should Not Persist',
          registration_details: {
            registrationNumber: null,
            pan: 'INVALID',
            section12A: null,
            section80G: null,
          },
        });
      expect(response.status).toBe(422);

      const after = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      expect((after.body as Envelope<{ organization_name: string }>).data!.organization_name).toBe(
        nameBefore,
      );
    });
  });
});
