import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import {
  TEST_PASSWORD,
  TEST_USERS,
  PREFIX,
  createTestApp,
  devTotpCode,
  type Envelope,
} from './harness.js';

/**
 * The team directory and impact records.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO QUESTIONS RUN THROUGH THIS SUITE.
 *
 *   Can a draft reach the public? Every publication test is paired with a
 *   request to the public endpoint, because "the flag was set" and "the page
 *   is reachable" are different claims and only the second one matters.
 *
 *   Can a number be published without its evidence? Decision A14 says no, and
 *   the impact tests are mostly about the exact boundary — a narrative update
 *   with no figure publishes freely; the moment a figure appears, a stated
 *   method is required.
 * ══════════════════════════════════════════════════════════════════════════
 */

const STAMP = Date.now().toString(36);

describe('Team and impact (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staffToken: string;
  let campaignsToken: string;
  let campaignId: string;
  let eventId: string;

  const createdTeam: string[] = [];
  const createdImpact: string[] = [];
  const createdEvents: string[] = [];

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function makeTeamMember(overrides: Record<string, unknown> = {}) {
    const response = await request(server)
      .post(`${PREFIX}/admin/team`)
      .set(auth(staffToken))
      .send({
        name: `Anjali ${randomUUID().slice(0, 8)}`,
        designation: 'Director of Programmes',
        bio: 'Twelve years in community health, previously with the district health mission.',
        memberType: 'staff',
        ...overrides,
      })
      .expect(201);

    const member = (response.body as Envelope<{ id: string; slug: string }>).data!;
    createdTeam.push(member.id);
    return member;
  }

  async function makeImpact(overrides: Record<string, unknown> = {}) {
    const response = await request(server)
      .post(`${PREFIX}/admin/impact`)
      .set(auth(staffToken))
      .send({
        title: `Reading corners ${randomUUID().slice(0, 8)}`,
        description: 'Fourteen classrooms received a reading corner and a starter library.',
        impactDate: '2026-08-31',
        campaignId,
        ...overrides,
      })
      .expect(201);

    const record = (response.body as Envelope<{ id: string; slug: string }>).data!;
    createdImpact.push(record.id);
    return record;
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const staff = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() });
    staffToken = (staff.body as Envelope<{ accessToken: string }>).data!.accessToken;

    const campaigns = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });
    campaignsToken = (campaigns.body as Envelope<{ accessToken: string }>).data!.accessToken;

    const campaign = await db().execute(sql`
      SELECT id FROM campaigns WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1
    `);
    campaignId = campaign.rows![0]!.id as string;

    // An event of this suite's own, so the event-parented impact test does not
    // depend on the seed's events surviving unchanged.
    const created = await request(server)
      .post(`${PREFIX}/admin/events`)
      .set(auth(staffToken))
      .send({
        title: `Medical camp ${STAMP}`,
        summary: 'A one-day camp.',
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        venueName: 'Ward 12 Hall',
        city: 'Pune',
      })
      .expect(201);
    eventId = (created.body as Envelope<{ id: string }>).data!.id;
    createdEvents.push(eventId);
  }, 60_000);

  afterAll(async () => {
    for (const id of createdImpact) {
      await db().execute(sql`DELETE FROM impact_updates WHERE id = ${id}::uuid`);
    }
    for (const id of createdTeam) {
      await db().execute(sql`DELETE FROM slug_history WHERE entity_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM team_members WHERE id = ${id}::uuid`);
    }
    for (const id of createdEvents) {
      await db().execute(sql`DELETE FROM impact_updates WHERE event_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM event_registrations WHERE event_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM events WHERE id = ${id}::uuid`);
    }
    /*
      A safety net for rows whose create succeeded but whose assertion did not,
      so nothing tracked their id. These are published pages when the tests get
      that far, so a leftover is visible on the public site rather than hidden.

      MATCHED ON THE RANDOM SUFFIX, not on the prefix. Every fixture title here
      ends in eight hex characters from `randomUUID().slice(0, 8)`, and a plain
      `LIKE 'Reading corners %'` would also match the SEEDED record "Reading
      corners installed across fourteen schools" — a teardown that deletes real
      content is worse than one that leaves a stray row behind.
    */
    await db().execute(sql`
      DELETE FROM impact_updates
       WHERE title ~ '^(Reading corners|Camp figures|Same title) [0-9a-f]{8}$'
          OR title = 'Unattributed'
    `);
    await db().execute(sql`
      DELETE FROM team_members
       WHERE name ~ '^Anjali [0-9a-f]{8}$'
          OR name IN ('Someone Else', 'Link Tester', 'Unauthorised')
    `);

    await app.close();
  });

  // =========================================================================
  describe('the team directory', () => {
    it('creates a member as a draft that is not public', async () => {
      const member = await makeTeamMember();

      const row = await db().execute(sql`
        SELECT status, is_public FROM team_members WHERE id = ${member.id}::uuid
      `);
      expect(row.rows![0]!.status).toBe('draft');
      expect(row.rows![0]!.is_public).toBe(false);

      // A real person's name and photograph must not go live on a save.
      const publicView = await request(server).get(`${PREFIX}/team/${member.slug}`);
      expect(publicView.status).toBe(404);
    }, 60_000);

    it('refuses to publish somebody with no biography', async () => {
      const member = await makeTeamMember({ bio: null });

      const response = await request(server)
        .patch(`${PREFIX}/admin/team/${member.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' });

      expect(response.status).toBe(422);
    }, 60_000);

    it('moves status and isPublic together, in both directions', async () => {
      const member = await makeTeamMember();

      await request(server)
        .patch(`${PREFIX}/admin/team/${member.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' })
        .expect(200);

      const published = await db().execute(sql`
        SELECT status, is_public FROM team_members WHERE id = ${member.id}::uuid
      `);
      expect(published.rows![0]!.is_public).toBe(true);

      const visible = await request(server).get(`${PREFIX}/team/${member.slug}`).expect(200);
      expect((visible.body as Envelope<{ name: string }>).data!.name).toBe(
        (await request(server).get(`${PREFIX}/team/${member.slug}`)).body.data.name,
      );

      // And back down. Two flags that both have to be true is two chances to
      // leave somebody visible after taking them down.
      await request(server)
        .patch(`${PREFIX}/admin/team/${member.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'draft' })
        .expect(200);

      const unpublished = await db().execute(sql`
        SELECT is_public FROM team_members WHERE id = ${member.id}::uuid
      `);
      expect(unpublished.rows![0]!.is_public).toBe(false);
      expect((await request(server).get(`${PREFIX}/team/${member.slug}`)).status).toBe(404);
    }, 60_000);

    it('redirects a renamed member’s old URL instead of breaking it', async () => {
      const member = await makeTeamMember();
      const oldSlug = member.slug;
      const newSlug = `renamed-${randomUUID().slice(0, 8)}`;

      await request(server)
        .patch(`${PREFIX}/admin/team/${member.id}`)
        .set(auth(staffToken))
        .send({ slug: newSlug })
        .expect(200);

      // A team member's URL ends up in an annual report and in press coverage.
      const redirect = await request(server).get(`${PREFIX}/redirects/team/${oldSlug}`).expect(200);
      expect((redirect.body as Envelope<{ slug: string }>).data!.slug).toBe(newSlug);
    }, 60_000);

    it('refuses to reuse a retired slug for somebody else', async () => {
      const first = await makeTeamMember();
      const retired = first.slug;

      await request(server)
        .patch(`${PREFIX}/admin/team/${first.id}`)
        .set(auth(staffToken))
        .send({ slug: `moved-${randomUUID().slice(0, 8)}` })
        .expect(200);

      // Reusing it would point the redirect at the wrong person — worse than a
      // 404, because it is confidently wrong.
      const response = await request(server)
        .post(`${PREFIX}/admin/team`)
        .set(auth(staffToken))
        .send({
          name: 'Someone Else',
          designation: 'Trustee',
          slug: retired,
        });

      expect(response.status).toBe(409);
    }, 60_000);

    it('rejects a social link that is not https', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/team`)
        .set(auth(staffToken))
        .send({
          name: 'Link Tester',
          designation: 'Advisor',
          socialLinks: [{ label: 'Profile', url: 'javascript:alert(1)' }],
        });

      expect(response.status).toBe(422);
    }, 60_000);

    /*
      ══════════════════════════════════════════════════════════════════════
      "REFUSES A STAFF MEMBER WHO DOES NOT HOLD team.manage" WAS REMOVED IN PHASE 8.

      It used a staff account holding a narrower role. SUPER_ADMIN is now the
      only staff role and holds every permission, so no real account lacks
      one — the assertion has no subject.

      The guard's denial path is covered directly, with synthetic actors
      carrying explicit permission lists, in
      `src/common/guards/auth.guard.spec.ts`. The permission string itself is
      untouched and is still what the route checks, so reintroducing a narrower
      role is a seed change and this test comes back with it.
      ══════════════════════════════════════════════════════════════════════
    */
  });

  // =========================================================================
  describe('impact records', () => {
    it('refuses a record with no parent', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/impact`)
        .set(auth(staffToken))
        .send({
          title: 'Unattributed',
          description: 'A figure belonging to nothing.',
          impactDate: '2026-08-31',
        });

      expect(response.status).toBe(422);
    }, 60_000);

    it('accepts a record parented only to an EVENT', async () => {
      /*
        This is what migration `0013` is for. The Phase 3 constraint required a
        campaign or a programme, so a medical camp's own figures had to be filed
        against whichever campaign funded it — misattributing them.
      */
      const record = await makeImpact({
        campaignId: null,
        eventId,
        title: `Camp figures ${randomUUID().slice(0, 8)}`,
      });

      const row = await db().execute(sql`
        SELECT campaign_id, program_id, event_id FROM impact_updates WHERE id = ${record.id}::uuid
      `);
      expect(row.rows![0]!.campaign_id).toBeNull();
      expect(row.rows![0]!.program_id).toBeNull();
      expect(row.rows![0]!.event_id).toBe(eventId);
    }, 60_000);

    it('inherits the campaign’s programme so the update rolls up', async () => {
      const record = await makeImpact();

      const row = await db().execute(sql`
        SELECT i.program_id, c.program_id AS campaign_program
          FROM impact_updates i JOIN campaigns c ON c.id = i.campaign_id
         WHERE i.id = ${record.id}::uuid
      `);
      expect(row.rows![0]!.program_id).toBe(row.rows![0]!.campaign_program);
    }, 60_000);

    it('will not publish a figure with no stated method', async () => {
      const record = await makeImpact({
        metricType: 'children_reached',
        metricValue: 1240,
        metricUnit: 'children',
      });

      const response = await request(server)
        .patch(`${PREFIX}/admin/impact/${record.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' });

      // Decision A14, at its exact boundary.
      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toMatch(/verificationMethod/);
    }, 60_000);

    it('publishes a narrative update that claims no figure', async () => {
      const record = await makeImpact();

      await request(server)
        .patch(`${PREFIX}/admin/impact/${record.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' })
        .expect(200);
    }, 60_000);

    it('publishes a figure once the method is given, and stamps the verifier', async () => {
      const record = await makeImpact({
        metricType: 'children_reached',
        metricValue: 1240,
        verificationMethod:
          'Headcount from school attendance registers, countersigned by each head teacher.',
      });

      const response = await request(server)
        .patch(`${PREFIX}/admin/impact/${record.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' })
        .expect(200);

      const published = (response.body as Envelope<{ verifiedBy: string; isPublic: boolean }>)
        .data!;
      // Stamped from the session, never from the payload — a self-declared
      // verifier verifies nothing.
      expect(published.verifiedBy).toBeTruthy();
      expect(published.isPublic).toBe(true);
    }, 60_000);

    it('serves the verification method on the PUBLIC page, not just in the admin', async () => {
      const method = 'Counted against the distribution register at each of the fourteen schools.';
      const record = await makeImpact({
        metricType: 'children_reached',
        metricValue: 1240,
        verificationMethod: method,
      });

      await request(server)
        .patch(`${PREFIX}/admin/impact/${record.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' })
        .expect(200);

      const publicView = await request(server).get(`${PREFIX}/impact/${record.slug}`).expect(200);
      // Publishing the claim and withholding the evidence is the arrangement
      // A14 exists to prevent.
      expect(
        (publicView.body as Envelope<{ verificationMethod: string }>).data!.verificationMethod,
      ).toBe(method);
    }, 60_000);

    it('keeps a draft record off the public page', async () => {
      const record = await makeImpact();
      const response = await request(server).get(`${PREFIX}/impact/${record.slug}`);
      expect(response.status).toBe(404);
    }, 60_000);

    it('does not name an unpublished event on a public impact page', async () => {
      const record = await makeImpact({ campaignId: null, eventId });
      await request(server)
        .patch(`${PREFIX}/admin/impact/${record.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' })
        .expect(200);

      const publicView = await request(server).get(`${PREFIX}/impact/${record.slug}`).expect(200);
      const data = (publicView.body as Envelope<{ eventTitle: string | null }>).data!;
      // The event is still a draft. Naming it would leak the existence of
      // something nobody chose to put on the site.
      expect(data.eventTitle).toBeNull();
    }, 60_000);

    it('refuses to strip the last parent off an existing record', async () => {
      const record = await makeImpact();

      const response = await request(server)
        .patch(`${PREFIX}/admin/impact/${record.id}`)
        .set(auth(staffToken))
        .send({ campaignId: null, programId: null, eventId: null });

      expect(response.status).toBe(422);
    }, 60_000);

    it('gives every record its own address, even when two share a title', async () => {
      const title = `Same title ${randomUUID().slice(0, 8)}`;
      const first = await makeImpact({ title });
      const second = await makeImpact({ title });

      expect(first.slug).not.toBe(second.slug);
    }, 60_000);
  });
});
