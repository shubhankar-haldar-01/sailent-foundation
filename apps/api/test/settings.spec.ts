import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PasswordService } from '../src/modules/auth/password.service.js';
import { DATABASE } from '../src/modules/database/database.module.js';
import {
  PREFIX,
  TEST_PASSWORD,
  TEST_USERS,
  createTestApp,
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

  let original: Record<string, unknown> = {};
  /** A staff member who may read settings but not change them, and their role. */
  const limited = { userId: '', roleId: '', token: '' };

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;

    const stamp = Date.now().toString(36);
    const role = (
      await db().execute(sql`
        INSERT INTO roles (key, name, is_system, priority)
        VALUES (${'TEST_SETTINGS_READ_' + stamp}, 'Settings read-only (test)', false, 1)
        RETURNING id
      `)
    ).rows![0]!;
    limited.roleId = role.id as string;
    await db().execute(sql`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT ${limited.roleId}::uuid, id FROM permissions WHERE key = 'settings.read'
    `);
    const hash = await app.get(PasswordService).hash(TEST_PASSWORD);
    const user = (
      await db().execute(sql`
        INSERT INTO users (email, first_name, status, password_hash)
        VALUES (${'settings-reader-' + stamp + '@sailent.test'}, 'Reader', 'active', ${hash})
        RETURNING id, email
      `)
    ).rows![0]!;
    limited.userId = user.id as string;
    await db().execute(
      sql`INSERT INTO user_roles (user_id, role_id) VALUES (${limited.userId}::uuid, ${limited.roleId}::uuid)`,
    );
    const limitedLogin = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: user.email, password: TEST_PASSWORD });
    limited.token = (limitedLogin.body as Envelope<{ accessToken: string }>).data!.accessToken;

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
    if (limited.userId) {
      await db().execute(sql`DELETE FROM sessions WHERE user_id = ${limited.userId}::uuid`);
      await db().execute(sql`DELETE FROM user_roles WHERE user_id = ${limited.userId}::uuid`);
      await db().execute(sql`DELETE FROM users WHERE id = ${limited.userId}::uuid`);
    }
    if (limited.roleId) {
      await db().execute(sql`DELETE FROM roles WHERE id = ${limited.roleId}::uuid`);
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

    it('saves without a password re-confirmation, and audits who changed what', async () => {
      // Owner, 2026-11-19: a signed-in staff member with settings.update saves
      // straight away. A fresh login has never re-authenticated.
      const fresh = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD });
      const token = (fresh.body as Envelope<{ accessToken: string }>).data!.accessToken;
      const name = `Saved Without Re-auth ${Date.now()}`;

      const response = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(token))
        .send({ organization_name: name });

      expect(response.status).toBe(200);
      const audit = (
        await db().execute(sql`
          SELECT new_values FROM audit_logs
          WHERE action = 'settings.update' AND new_values->>'organization_name' = ${name}
        `)
      ).rows!;
      expect(audit).toHaveLength(1);
    });

    it('still refuses a staff member without settings.update, and changes nothing', async () => {
      const before = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));

      expect(
        (await request(server).get(`${PREFIX}/admin/settings`).set(auth(limited.token))).status,
      ).toBe(200);
      const response = await request(server)
        .patch(`${PREFIX}/admin/settings`)
        .set(auth(limited.token))
        .send({ organization_name: 'Renamed By A Reader' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('FORBIDDEN');
      const after = await request(server).get(`${PREFIX}/admin/settings`).set(auth(staff));
      expect((after.body as Envelope).data).toEqual((before.body as Envelope).data);
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
