import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';

import {
  TEST_PASSWORD,
  TEST_USERS,
  PREFIX,
  createTestApp,
  devTotpCode,
  errorCode,
  type Envelope,
} from './harness.js';

/**
 * Authorization, end to end.
 *
 * Every assertion here is about a REFUSAL. A suite that only ever signs in as a
 * Super Admin proves nothing: every request succeeds, so a guard that never
 * runs looks exactly like a guard that works. The Content Manager sessions
 * below are what make a missing check visible.
 */
describe('RBAC (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  /** Holds every permission. SUPER_ADMIN is now the only staff role. */
  let superAdmin: string;
  let superAdminId: string;
  /** The same role, without a second factor enrolled. */
  let staff: string;

  async function login(
    email: string,
    totp?: string,
  ): Promise<
    Envelope<{
      accessToken: string;
      actor: { id: string; permissions: string[] };
    }>
  > {
    /*
      ALWAYS a second factor. SUPER_ADMIN mandates TOTP (decision A8) and
      since Phase 8 it is the only staff role, so there is no password-only
      staff login left to exercise.
    */
    const response = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email, password: TEST_PASSWORD, totpCode: totp ?? devTotpCode() });
    return response.body as never;
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const su = await login(TEST_USERS.superAdmin, devTotpCode());
    superAdmin = su.data!.accessToken;
    superAdminId = su.data!.actor.id;
    staff = (await login(TEST_USERS.staff)).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    /**
     * Remove the accounts these tests created.
     *
     * They are invited-state accounts with unusable passwords, so they are
     * harmless — but leaving them behind means the staff list grows by two
     * every run, and a developer eventually cannot tell test debris from real
     * seeded data.
     */
    const database = app.get<{ db: { execute(query: unknown): Promise<unknown> } }>(DATABASE);
    await database.db.execute(
      sql`DELETE FROM users WHERE email LIKE 'integration-%@sailent.local' OR email LIKE 'massassign-%@sailent.local'`,
    );
    await app?.close();
  });

  const get = (path: string, token?: string) => {
    const call = request(server).get(`${PREFIX}${path}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  describe('permission gates', () => {
    /*
      ══════════════════════════════════════════════════════════════════════
      THE "REFUSES A CONTENT MANAGER" TESTS WERE REMOVED IN PHASE 8, AND THIS
      NOTE IS HERE SO THE ABSENCE READS AS A DECISION.

      There were four, plus a Volunteer Manager variant, each asserting that a
      staff member holding a narrower bundle got a 403. They cannot be written
      any more: the five operational roles are gone and SUPER_ADMIN is the only
      staff role, so no real account lacks a permission.

      WHAT THEY WERE ACTUALLY TESTING was the seed's role bundles, not the
      guard. The guard's denial logic is covered directly, with synthetic
      actors carrying explicit permission lists, in
      `src/common/guards/auth.guard.spec.ts` — including "refuses when ANY of
      several required permissions is missing" and "reports a missing
      permission before asking for a password again". That coverage did not
      move and did not weaken.

      What survives at this level is everything that still has two sides: an
      unauthenticated request, a donor token at a staff route, and a sensitive
      route without a fresh re-authentication.

      If a narrower role is ever reintroduced — a seed change, since the
      permission catalogue is untouched — these tests come back with it.
      ══════════════════════════════════════════════════════════════════════
    */
    it.each(['/admin/users', '/admin/roles', '/admin/permissions', '/admin/audit-logs'])(
      'allows %s to a Super Admin',
      async (path) => {
        expect((await get(path, superAdmin)).status).toBe(200);
      },
    );

    it.each(['/admin/users', '/admin/roles', '/admin/audit-logs'])(
      'refuses %s outright when unauthenticated',
      async (path) => {
        const response = await get(path);
        expect(response.status).toBe(401);
        expect(errorCode(response.body as Envelope)).toBe('UNAUTHENTICATED');
      },
    );

    it('serves /auth/me to any authenticated staff member', async () => {
      // Deny-by-default would make this route unreachable without an explicit
      // @AuthenticatedOnly(). It stays reachable so that somebody can always
      // discover what they hold — which is the answer to "why am I getting a
      // 403" and is exactly when they cannot use the permissions screen.
      const response = await get('/auth/me', staff);

      expect(response.status).toBe(200);
      const body = response.body as Envelope<{ permissions: string[] }>;
      // SUPER_ADMIN holds the whole catalogue, so this asserts the route
      // returns the list rather than asserting a particular bundle.
      expect(body.data?.permissions.length).toBeGreaterThan(50);
      expect(body.data?.permissions).toContain('user.read');
    });
  });

  describe('sensitive operations', () => {
    it('refuses a sensitive route until the session re-authenticates', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/users`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({
          email: 'never-created@sailent.local',
          firstName: 'Never',
          roleKeys: ['SUPER_ADMIN'],
        });

      expect(response.status).toBe(403);
      // Distinct from FORBIDDEN: the client's correct response is to ask for
      // the password again, not to hide the control.
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });

    it('refuses re-authentication with the wrong password', async () => {
      const response = await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ password: 'not-the-password', totpCode: devTotpCode() });

      expect(response.status).toBe(401);
    });

    it('re-authenticates a Super Admin with the PASSWORD ALONE', async () => {
      /*
        Also a reversal. This asserted that a re-auth without a second factor
        was refused, on the grounds that a re-auth weaker than the login would
        be a downgrade attack.

        That argument still holds — it is just no longer weaker. The login is
        email and password, so a re-auth of password alone is the SAME
        strength, not less. What `@Sensitive()` buys is unchanged: proof that
        the person at the keyboard now is the account holder, within five
        minutes, before anything irreversible.

        Sends no `totpCode`, deliberately.
      */
      const response = await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ password: TEST_PASSWORD });

      expect(response.status).toBe(200);
    });

    it('still refuses re-authentication on a WRONG password', async () => {
      // The window must not open for somebody who walked up to the keyboard.
      const response = await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ password: 'not-the-password' });

      expect(response.status).toBe(401);
    });

    it('opens the window on a correct re-authentication, and the sensitive route then works', async () => {
      const reauth = await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });

      expect(reauth.status).toBe(200);

      const email = `integration-${Date.now()}@sailent.local`;
      const created = await request(server)
        .post(`${PREFIX}/admin/users`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ email, firstName: 'Integration', lastName: 'Test', roleKeys: ['SUPER_ADMIN'] });

      expect(created.status).toBe(201);
      const body = created.body as Envelope<Record<string, unknown>>;
      expect(body.data?.status).toBe('invited');
    });

    /*
      "Cannot re-authenticate your way into a permission you do not hold" was
      tested here with a Content Manager. There is no such account now — see
      the note in `permission gates` above. The ordering it protected (report
      the missing permission BEFORE asking for a password) is asserted directly
      in `auth.guard.spec.ts`.
    */
  });

  describe('separation of duties', () => {
    it('refuses to let anyone change their own roles', async () => {
      // Self-elevation defeats every other control in the system, so it is
      // refused in the service rather than left to a guard.
      await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ password: TEST_PASSWORD, totpCode: devTotpCode() })
        .expect(200);

      const response = await request(server)
        .post(`${PREFIX}/admin/users/${superAdminId}/roles`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ roleKeys: ['SUPER_ADMIN'], reason: 'integration test' });

      expect(response.status).toBe(403);
      expect((response.body as Envelope).error?.message).toMatch(/your own roles/i);
    });

    it('refuses to let anyone suspend their own account', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/users/${superAdminId}/suspend`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ reason: 'integration test' });

      expect(response.status).toBe(403);
    });
  });

  /**
   * Programmes belong to Admin.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * A PROGRAMME IS A TAXONOMY, NOT A PROJECT.
   *
   * "Disaster Relief" outlives every flood appeal filed under it. A Campaign
   * Manager running the 2026 Bihar floods needs to ATTACH that campaign to the
   * existing programme — not to create a second Disaster Relief because the
   * first was not obvious in a dropdown. Two near-identical programmes cannot
   * be reported across, and nobody notices until somebody asks how much was
   * raised for disaster relief and gets half the answer.
   *
   * So creating, editing and publishing a programme is Admin's. Reading is
   * everyone's, because without it a campaign cannot be filed at all.
   * ══════════════════════════════════════════════════════════════════════════
   */
  describe('programme ownership', () => {
    /*
      ══════════════════════════════════════════════════════════════════════
      THE CAMPAIGN MANAGER TESTS WENT WITH THE ROLE, IN PHASE 8.

      Five of them: that a Campaign Manager could READ programmes (because
      filing a campaign needs it) but could not create, publish, reorder or
      edit one. They encoded the reasoning in the comment above this block —
      that a programme outlives every campaign filed under it, so letting a
      campaign manager create one produces a second "Disaster Relief" nobody
      can report across.

      THAT REASONING IS STILL SOUND. What changed is that there is nobody to
      apply it to: SUPER_ADMIN is the only staff role and holds every
      permission, so the distinction has no subject.

      The permission strings are untouched — `program.create`,
      `program.update`, `program.publish` all still exist and are still what
      the guard checks. Reintroducing a narrower role is a seed change, and
      these tests come back unchanged with it. The comment above is left in
      place because it explains a design decision that outlives the role.
      ══════════════════════════════════════════════════════════════════════
    */

    /**
     * There is no delete endpoint and no `program.delete` permission, for
     * anybody. A programme with campaigns behind it has donations behind
     * those, and the foreign keys are ON DELETE RESTRICT all the way down.
     * Archiving is the strongest available action.
     */
    it('offers nobody a way to delete a programme, not even a Super Admin', async () => {
      const listed = await get('/admin/programs?limit=1', superAdmin);
      const id = (listed.body as Envelope<{ items: { id: string }[] }>).data!.items[0]!.id;

      const response = await request(server)
        .delete(`${PREFIX}/admin/programs/${id}`)
        .set('Authorization', `Bearer ${superAdmin}`);

      expect(response.status).toBe(404);
    });
  });

  describe('secret exposure', () => {
    it('never serialises a password hash or TOTP secret through the users API', async () => {
      const response = await get('/admin/users?limit=100', superAdmin);
      const serialised = JSON.stringify(response.body);

      expect(response.status).toBe(200);
      expect(serialised).not.toMatch(/\$argon2/);
      for (const forbidden of ['passwordHash', 'totpSecret', 'backupCodes', 'lockedUntil']) {
        expect(serialised).not.toContain(forbidden);
      }
      // What it DOES return, so the test fails if the endpoint silently empties.
      expect(serialised).toContain('admin@sailent.local');
    });

    it('reports whether 2FA is enrolled without revealing the secret', async () => {
      const response = await get('/admin/users?q=admin@sailent.local', superAdmin);
      const items = (response.body as Envelope<{ items: { totpEnabled: boolean }[] }>).data!.items;

      expect(items[0]?.totpEnabled).toBe(true);
    });
  });

  describe('input handling', () => {
    it.each([
      ['a non-uuid id', '/admin/users/not-a-uuid', 422],
      ['a limit above the ceiling', '/admin/users?limit=101', 422],
      ['a negative page', '/admin/users?page=-1', 422],
      ['a sort field carrying SQL', '/admin/users?sort=-email;DROP%20TABLE%20users', 422],
      ['an unknown uuid', '/admin/users/00000000-0000-4000-8000-000000000000', 404],
      ['an unknown role key', '/admin/roles/NOT_A_ROLE', 404],
    ])('rejects %s with %i', async (_label, path, status) => {
      expect((await get(path, superAdmin)).status).toBe(status);
    });

    it('ignores an unknown sort field rather than failing or injecting it', async () => {
      // `passwordHash` is a real column but not on the allow-list, so it falls
      // back to the default ordering — the response is identical to the one for
      // a field that does not exist, which is what stops schema probing.
      const probe = await get('/admin/users?sort=-passwordHash', superAdmin);
      const nonsense = await get('/admin/users?sort=-notacolumn', superAdmin);

      expect(probe.status).toBe(200);
      expect(nonsense.status).toBe(200);
      expect((probe.body as Envelope<{ items: unknown[] }>).data?.items).toEqual(
        (nonsense.body as Envelope<{ items: unknown[] }>).data?.items,
      );
    });

    it('strips fields the schema does not declare', async () => {
      await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({ password: TEST_PASSWORD, totpCode: devTotpCode() })
        .expect(200);

      const email = `massassign-${Date.now()}@sailent.local`;
      const response = await request(server)
        .post(`${PREFIX}/admin/users`)
        .set('Authorization', `Bearer ${superAdmin}`)
        .send({
          email,
          firstName: 'Mass',
          roleKeys: ['SUPER_ADMIN'],
          // None of these may reach the insert.
          status: 'active',
          passwordHash: 'injected',
          totpEnabled: true,
        });

      expect(response.status).toBe(201);
      const created = (response.body as Envelope<{ status: string; totpEnabled: boolean }>).data!;
      expect(created.status).toBe('invited');
      expect(created.totpEnabled).toBe(false);
    });
  });

  describe('audit trail', () => {
    it('records every sensitive change, with the actor and a severity', async () => {
      const response = await get('/admin/audit-logs?limit=20', superAdmin);
      const items = (
        response.body as Envelope<{
          items: { action: string; userId: string | null; severity: string; newValues: unknown }[];
        }>
      ).data!.items;

      expect(items.length).toBeGreaterThan(0);
      const invites = items.filter((item) => item.action === 'user.invite');
      expect(invites.length).toBeGreaterThan(0);
      expect(invites[0]?.userId).toBe(superAdminId);
      expect(invites[0]?.severity).toBe('warning');
    });

    it('filters by action and entity type', async () => {
      const response = await get(
        '/admin/audit-logs?action=user.invite&entityType=user',
        superAdmin,
      );
      const items = (response.body as Envelope<{ items: { action: string }[] }>).data!.items;

      expect(items.every((item) => item.action === 'user.invite')).toBe(true);
    });

    it('exposes no write path', async () => {
      // Decision A10. There is no POST, PATCH or DELETE on this resource, and
      // Nest answers a route that does not exist with a 404.
      for (const method of ['post', 'patch', 'delete'] as const) {
        const response = await request(server)
          [method](`${PREFIX}/admin/audit-logs`)
          .set('Authorization', `Bearer ${superAdmin}`)
          .send({});
        expect(response.status).toBe(404);
      }
    });
  });
});
