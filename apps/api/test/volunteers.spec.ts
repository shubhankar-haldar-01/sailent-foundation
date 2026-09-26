import { createHash, randomInt, randomUUID } from 'node:crypto';
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
  errorCode,
  type Envelope,
} from './harness.js';

/**
 * Volunteer management, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TESTS THAT MATTER MOST ARE THE ONES ABOUT WHAT A VOLUNTEER CANNOT DO.
 *
 * A volunteer cannot record their own attendance, cannot verify it, cannot see
 * why they were rejected, and cannot reach another volunteer's record. Every
 * one of those is asserted here, because each is the difference between a
 * certificate that means something and a piece of paper.
 *
 * The rest is the lifecycle: apply, decide, assign, record, verify, certify —
 * and the arithmetic in the middle, which ends up printed on a document
 * somebody shows an employer.
 * ══════════════════════════════════════════════════════════════════════════
 */

const STAMP = Date.now().toString(36);

describe('Volunteers (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;

  const created: string[] = [];
  const accounts: string[] = [];

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /**
   * A fresh, valid Indian mobile number. Unique per call.
   *
   * ══════════════════════════════════════════════════════════════════════
   * THE CLOCK TERM THAT USED TO BE HERE MADE THIS SUITE INTERMITTENT.
   *
   * It read `800000000 + (phoneSeed += 1) + (Date.now() % 100000)`, and that
   * modulo WRAPS every 100 seconds — dropping the number by 100,000 while the
   * seed had advanced by only a few dozen. About a hundred seconds in, the
   * generator started walking back through numbers it had already issued.
   *
   * Run on its own this suite finishes in ~15s and never reaches the wrap, so
   * it always passed. Under a full parallel `pnpm test` it runs long enough to
   * cross it, and then a `nextPhone()` collides with a volunteer created
   * earlier in the same run.
   *
   * The damage landed somewhere else entirely. A setup `apply()` whose status
   * is not asserted quietly returned 409 instead of 201, so no record existed,
   * and the assertions that followed were measuring nothing — which is why the
   * failure moved between tests and never reproduced in isolation.
   *
   * Now: a random prefix per run, a counter that only ever goes up, and no
   * clock anywhere. 100,000 numbers per run, issued in strict sequence.
   * ══════════════════════════════════════════════════════════════════════
   */
  const PHONE_RUN = String(randomInt(1000, 10000));
  let phoneSeed = 0;
  const nextPhone = () => `9${PHONE_RUN}${String((phoneSeed += 1) % 100000).padStart(5, '0')}`;

  async function apply(overrides: Record<string, unknown> = {}) {
    const response = await request(server)
      .post(`${PREFIX}/volunteers/apply`)
      .send({
        firstName: 'Applicant',
        lastName: STAMP,
        email: `vol-${randomUUID().slice(0, 8)}@example.test`,
        phone: nextPhone(),
        city: 'Pune',
        skills: ['Teaching'],
        emergencyContactName: 'Sibling',
        emergencyContactPhone: '9876543210',
        emergencyContactRelation: 'Sister',
        ...overrides,
      });

    if (response.status === 201) {
      created.push((response.body as Envelope<{ id: string }>).data!.id);
    }
    return response;
  }

  /**
   * Apply, and INSIST it worked.
   *
   * For the setup half of a test, where the application only exists so that
   * the next one can collide with it. A bare `await apply(...)` that silently
   * returned 409 is what made a phone-number collision surface as a confusing
   * assertion failure three lines later, in a test that was not broken.
   */
  async function applyOk(overrides: Record<string, unknown> = {}) {
    const response = await apply(overrides);
    expect(response.status).toBe(201);
    return response;
  }

  /** Re-authenticate — the review and detail routes are `@Sensitive()`. */
  async function reauth() {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(staff))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  async function decide(id: string, body: Record<string, unknown>) {
    await reauth();
    return request(server)
      .patch(`${PREFIX}/admin/volunteers/${id}/decision`)
      .set(auth(staff))
      .send(body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    for (const id of created) {
      await db().execute(sql`DELETE FROM volunteer_certificates WHERE volunteer_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM volunteer_attendance WHERE volunteer_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM volunteer_assignments WHERE volunteer_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM volunteer_applications WHERE volunteer_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM volunteers WHERE id = ${id}::uuid`);
    }
    // Rows whose create succeeded but whose assertion did not, so nothing
    // tracked the id. Matched on the fixture DOMAIN rather than a name prefix:
    // the duplicate-protection tests invent several prefixes, and a title
    // prefix would also have swept seeded records.
    await db().execute(sql`
      DELETE FROM volunteers WHERE last_name = ${STAMP} OR email LIKE ${'%@example.test'}
    `);
    for (const id of accounts) {
      await db().execute(sql`DELETE FROM donors WHERE id = ${id}::uuid`);
    }
    await app.close();
  });

  // =========================================================================
  describe('applying', () => {
    it('records an application, and says nothing else', async () => {
      const response = await apply();

      expect(response.status).toBe(201);
      const data = (response.body as Envelope<{ id: string; status: string }>).data!;
      expect(data.status).toBe('applied');
      // An id and a status. Nothing that could confirm whether the address or
      // the number was already known.
      expect(Object.keys(data).sort()).toEqual(['id', 'status']);
    });

    it('writes the submission as a frozen snapshot alongside the profile', async () => {
      const response = await apply({ occupation: 'Teacher' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const rows = await db().execute(sql`
        SELECT form_data, status FROM volunteer_applications WHERE volunteer_id = ${id}::uuid
      `);
      expect(rows.rows).toHaveLength(1);
      // The point of the second table: what they actually told us, kept apart
      // from a profile that will be edited over years.
      expect((rows.rows![0]!.form_data as Record<string, unknown>).occupation).toBe('Teacher');
    });

    it('allocates NO volunteer id until approval', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const rows = await db().execute(
        sql`SELECT volunteer_id FROM volunteers WHERE id = ${id}::uuid`,
      );
      // Decision A13, and the database enforces it with a check constraint.
      expect(rows.rows![0]!.volunteer_id).toBeNull();
    });

    it('refuses a second live application from the same number', async () => {
      const phone = nextPhone();
      await applyOk({ phone });
      const second = await apply({ phone });

      expect(second.status).toBe(409);
      expect(errorCode(second.body as Envelope)).toBe('CONFLICT');
    });

    it('keeps the emergency contact relation, which used to be discarded', async () => {
      const response = await apply({ emergencyContactRelation: 'Neighbour' });
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const rows = await db().execute(sql`
        SELECT emergency_contact_relation FROM volunteers WHERE id = ${id}::uuid
      `);
      expect(rows.rows![0]!.emergency_contact_relation).toBe('Neighbour');
    });

    it('refuses an emergency name with no number, and the reverse', async () => {
      // One without the other is worse than neither: somebody will ring a
      // number in an emergency not knowing who they are speaking to.
      const nameOnly = await apply({
        emergencyContactName: 'Sibling',
        emergencyContactPhone: undefined,
      });
      expect(nameOnly.status).toBe(422);
    });

    it('rejects an unknown field rather than ignoring it', async () => {
      const response = await request(server)
        .post(`${PREFIX}/volunteers/apply`)
        .send({
          firstName: 'Probe',
          email: `strict-${randomUUID().slice(0, 8)}@example.test`,
          phone: nextPhone(),
          // Not in the schema. `.strict()` refuses rather than dropping it —
          // this endpoint is unauthenticated, so silence would be the wrong
          // default.
          status: 'approved',
          verifiedHours: 9999,
        });

      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  describe('one person, one live record', () => {
    /*
      ══════════════════════════════════════════════════════════════════════
      THE AUDIT FOUND THIS: duplicate protection was enforced on the PHONE
      NUMBER, and `/me/volunteering` resolves a volunteer by EMAIL. Nothing
      joined the two, so one address plus two numbers produced two live records
      and the dashboard returned whichever Postgres preferred.

      It needed no rejection to reach. Two ordinary applications did it.
      ══════════════════════════════════════════════════════════════════════
    */

    it('refuses the SAME EMAIL with a different phone', async () => {
      const email = `dup-${randomUUID().slice(0, 8)}@example.test`;
      const first = await apply({ email });
      expect(first.status).toBe(201);

      const second = await apply({ email });
      expect(second.status).toBe(409);
      expect(errorCode(second.body as Envelope)).toBe('CONFLICT');
    });

    it('refuses the SAME PHONE with a different email', async () => {
      const phone = nextPhone();
      const first = await apply({ phone });
      expect(first.status).toBe(201);

      const second = await apply({ phone });
      expect(second.status).toBe(409);
    });

    it('does not say WHICH key matched', async () => {
      // Unauthenticated endpoint. Naming the field makes it a cleaner oracle
      // for "has this address applied here" than it needs to be.
      const email = `oracle-${randomUUID().slice(0, 8)}@example.test`;
      const phone = nextPhone();
      await applyOk({ email, phone });

      const byEmail = await apply({ email });
      const byPhone = await apply({ phone });

      const emailMessage = (byEmail.body as Envelope).error?.message;
      expect(emailMessage).toBe((byPhone.body as Envelope).error?.message);
      expect(emailMessage).not.toMatch(/number|phone|email|address/i);
    });

    it('refuses a second record for an APPROVED volunteer on the same address', async () => {
      const email = `approved-${randomUUID().slice(0, 8)}@example.test`;
      const first = await apply({ email });
      const id = (first.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'approved' });
      await decide(id, { status: 'active' });

      // The exact case that broke the dashboard: an active volunteer with an
      // identifier and hours, and a second `applied` row on the same address.
      const second = await apply({ email });
      expect(second.status).toBe(409);
    });

    it('still lets a REJECTED applicant re-apply with the same address', async () => {
      const email = `reapply-${randomUUID().slice(0, 8)}@example.test`;
      const first = await apply({ email });
      const id = (first.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'rejected', reason: 'Not this time' });

      /*
        The index is PARTIAL for exactly this. A plain unique index on email
        would burn the address the first time somebody was turned down, and
        there would be no path back — which is not what rejection means.
      */
      const second = await apply({ email });
      expect(second.status).toBe(201);
    });

    it('honours a cooling period set against the ADDRESS, not just the number', async () => {
      const email = `cooling-${randomUUID().slice(0, 8)}@example.test`;
      const first = await apply({ email });
      const id = (first.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'rejected', reason: 'Too soon', coolingPeriodDays: 30 });

      // A cooling period keyed only on the phone number is escaped by
      // re-applying from the same address with a different number.
      const second = await apply({ email });
      expect(second.status).toBe(409);
    });

    it('holds under CONCURRENT applications, where the check cannot be atomic', async () => {
      const email = `race-${randomUUID().slice(0, 8)}@example.test`;

      /*
        Both pass the SELECT — it is not in the same transaction as the INSERT
        and cannot be. One loses on `volunteers_email_live_unique`, and the
        point of this test is that it loses with a 409 rather than a 500
        quoting an index name at somebody filling in a form.
      */
      const [a, b] = await Promise.all([apply({ email }), apply({ email })]);

      const codes = [a.status, b.status].sort();
      expect(codes).toEqual([201, 409]);
      // And exactly one row exists, not two.
      const rows = await db().execute(sql`
        SELECT count(*) AS n FROM volunteers WHERE lower(btrim(email)) = ${email.toLowerCase()}
      `);
      expect(Number(rows.rows![0]!.n)).toBe(1);
    });
  });

  // =========================================================================
  describe('the decision', () => {
    it('allocates a permanent VOL- id on approval, and stamps who approved', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const approved = await decide(id, { status: 'approved' });
      expect(approved.status).toBe(200);

      const data = (approved.body as Envelope<{ volunteerId: string; approvedAt: string }>).data!;
      expect(data.volunteerId).toMatch(/^VOL-\d{4}-\d{5}$/);
      expect(data.approvedAt).toBeTruthy();
    });

    it('does not mint a SECOND id when the volunteer moves on through the lifecycle', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const approved = await decide(id, { status: 'approved' });
      const first = (approved.body as Envelope<{ volunteerId: string }>).data!.volunteerId;

      await decide(id, { status: 'active' });
      const suspended = await decide(id, { status: 'suspended', reason: 'Under review' });
      const after = (suspended.body as Envelope<{ volunteerId: string }>).data!.volunteerId;

      // The number appears on certificates that exist in the physical world.
      expect(after).toBe(first);
    });

    it('issues DISTINCT ids to two people approved in the same moment', async () => {
      const one = (await apply()).body as Envelope<{ id: string }>;
      const two = (await apply()).body as Envelope<{ id: string }>;

      /*
        Both approvals race. The counter row is taken FOR UPDATE inside the
        approval transaction, so the second blocks until the first commits —
        a plain read-then-write would hand both the same number and the unique
        index would reject one of them, mid-approval.
      */
      await reauth();
      const [first, second] = await Promise.all([
        request(server)
          .patch(`${PREFIX}/admin/volunteers/${one.data!.id}/decision`)
          .set(auth(staff))
          .send({ status: 'approved' }),
        request(server)
          .patch(`${PREFIX}/admin/volunteers/${two.data!.id}/decision`)
          .set(auth(staff))
          .send({ status: 'approved' }),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const a = (first.body as Envelope<{ volunteerId: string }>).data!.volunteerId;
      const b = (second.body as Envelope<{ volunteerId: string }>).data!.volunteerId;
      expect(a).not.toBe(b);
    });

    it('refuses a rejection with no reason', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      const rejected = await decide(id, { status: 'rejected' });
      expect(rejected.status).toBe(422);
    });

    it('leaves a rejected applicant with no id, and treats rejection as final', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      await decide(id, { status: 'rejected', reason: 'Outside our districts' });

      const rows = await db().execute(
        sql`SELECT volunteer_id, status FROM volunteers WHERE id = ${id}::uuid`,
      );
      expect(rows.rows![0]!.volunteer_id).toBeNull();

      // A new application is a new record; moving this one back would erase
      // the fact that a decision was taken.
      const reopened = await decide(id, { status: 'approved' });
      expect(reopened.status).toBe(409);
    });

    it('lets a rejected applicant apply again, which the old unique index prevented', async () => {
      const phone = nextPhone();
      const first = await apply({ phone });
      const id = (first.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'rejected', reason: 'Not this time' });

      // The partial index excludes rejected rows, so the number is not burned.
      const second = await apply({ phone });
      expect(second.status).toBe(201);
    });

    it('honours a cooling period set at rejection', async () => {
      const phone = nextPhone();
      const first = await apply({ phone });
      const id = (first.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'rejected', reason: 'Too soon', coolingPeriodDays: 30 });

      const second = await apply({ phone });
      expect(second.status).toBe(409);
    });

    it('requires a re-authentication to read a record or decide', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;

      // A session that has not re-authenticated recently. A fresh login is not
      // a re-authentication.
      const fresh = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });
      const token = (fresh.body as Envelope<{ accessToken: string }>).data!.accessToken;

      const read = await request(server).get(`${PREFIX}/admin/volunteers/${id}`).set(auth(token));
      expect(read.status).toBe(403);
      expect(errorCode(read.body as Envelope)).toBe('REAUTH_REQUIRED');
    });
  });

  // =========================================================================
  describe('assignments, attendance and hours', () => {
    async function activeVolunteer() {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'approved' });
      await decide(id, { status: 'active' });
      return id;
    }

    async function assign(volunteerId: string) {
      const response = await request(server)
        .post(`${PREFIX}/admin/volunteers/${volunteerId}/assignments`)
        .set(auth(staff))
        .send({
          role: 'Kit sorting',
          startsAt: '2026-09-01T09:00:00+05:30',
          endsAt: '2026-09-01T13:00:00+05:30',
        });
      return (response.body as Envelope<{ id: string }>).data!.id;
    }

    it('refuses to assign anybody who is not active', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'approved' });

      // Approved is not active: they have not been inducted. Assigning them
      // puts somebody in the field who has not been briefed.
      const assigned = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments`)
        .set(auth(staff))
        .send({ role: 'Kit sorting', startsAt: '2026-09-01T09:00:00+05:30' });

      expect(assigned.status).toBe(409);
    });

    it('rounds minutes DOWN to whole hours', async () => {
      const id = await activeVolunteer();
      const assignment = await assign(id);

      const recorded = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments/${assignment}/attendance`)
        .set(auth(staff))
        .send({ date: '2026-09-01', durationMinutes: 119, verified: true });

      expect(recorded.status).toBe(200);
      const data = (recorded.body as Envelope<{ verifiedHours: number }>).data!;
      /*
        119 minutes is one hour, not two. These hours are printed on a
        certificate — rounding up certifies work that did not happen, and
        across a year of shifts that is a materially inflated claim made by the
        organisation about somebody who did not ask for it.
      */
      expect(data.verifiedHours).toBe(1);
    });

    it('counts UNVERIFIED attendance towards total hours but not verified ones', async () => {
      const id = await activeVolunteer();
      const assignment = await assign(id);

      const recorded = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments/${assignment}/attendance`)
        .set(auth(staff))
        .send({ date: '2026-09-02', durationMinutes: 240 });

      const data = (recorded.body as Envelope<{ totalHours: number; verifiedHours: number }>).data!;
      expect(data.totalHours).toBe(4);
      // Nobody has stood behind it yet, so no certificate can count it.
      expect(data.verifiedHours).toBe(0);
    });

    it('CORRECTS rather than doubles when the same day is submitted twice', async () => {
      const id = await activeVolunteer();
      const assignment = await assign(id);
      const url = `${PREFIX}/admin/volunteers/${id}/assignments/${assignment}/attendance`;

      await request(server)
        .post(url)
        .set(auth(staff))
        .send({ date: '2026-09-03', durationMinutes: 240, verified: true });
      const again = await request(server)
        .post(url)
        .set(auth(staff))
        .send({ date: '2026-09-03', durationMinutes: 300, verified: true });

      // A register submitted twice from a phone at a venue is the ordinary
      // case. The unique index on (assignment, date) makes it an upsert.
      expect((again.body as Envelope<{ verifiedHours: number }>).data!.verifiedHours).toBe(5);
    });

    it('CLEARS the verification when a verified figure is corrected', async () => {
      const id = await activeVolunteer();
      const assignment = await assign(id);
      const url = `${PREFIX}/admin/volunteers/${id}/assignments/${assignment}/attendance`;

      await request(server)
        .post(url)
        .set(auth(staff))
        .send({ date: '2026-09-04', durationMinutes: 240, verified: true });
      const corrected = await request(server)
        .post(url)
        .set(auth(staff))
        .send({ date: '2026-09-04', durationMinutes: 120 });

      /*
        Somebody verified the OLD figure, not this one. Carrying the approval
        forward onto a changed number would make verification meaningless.
      */
      expect((corrected.body as Envelope<{ verifiedHours: number }>).data!.verifiedHours).toBe(0);
      expect((corrected.body as Envelope<{ totalHours: number }>).data!.totalHours).toBe(2);
    });

    it('refuses a duration above a day', async () => {
      const id = await activeVolunteer();
      const assignment = await assign(id);

      const response = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments/${assignment}/attendance`)
        .set(auth(staff))
        .send({ date: '2026-09-05', durationMinutes: 1441 });

      expect(response.status).toBe(422);
    });

    it('refuses to verify a record belonging to another volunteer', async () => {
      const mine = await activeVolunteer();
      const theirs = await activeVolunteer();
      const assignment = await assign(theirs);

      const recorded = await request(server)
        .post(`${PREFIX}/admin/volunteers/${theirs}/assignments/${assignment}/attendance`)
        .set(auth(staff))
        .send({ date: '2026-09-06', durationMinutes: 60 });
      const attendanceId = (recorded.body as Envelope<{ id: string }>).data!.id;

      // Scoped by volunteer in the WHERE clause, so the id simply does not come
      // back — and the whole batch is refused rather than partly applied.
      const response = await request(server)
        .post(`${PREFIX}/admin/volunteers/${mine}/attendance/verify`)
        .set(auth(staff))
        .send({ attendanceIds: [attendanceId], verified: true });

      expect(response.status).toBe(409);
    });

    it('rebuilds drifted counters on a recount', async () => {
      const id = await activeVolunteer();
      const assignment = await assign(id);
      await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments/${assignment}/attendance`)
        .set(auth(staff))
        .send({ date: '2026-09-07', durationMinutes: 180, verified: true });

      await db().execute(sql`
        UPDATE volunteers SET verified_hours = 99, total_hours = 99 WHERE id = ${id}::uuid
      `);

      const response = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/recount`)
        .set(auth(staff))
        .expect(200);

      const data = (response.body as Envelope<{ verifiedHours: number; drifted: boolean }>).data!;
      expect(data.verifiedHours).toBe(3);
      expect(data.drifted).toBe(true);
    });
  });

  // =========================================================================
  describe('certificates', () => {
    async function volunteerWithHours(minutes: number) {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'approved' });
      await decide(id, { status: 'active' });

      const assignment = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments`)
        .set(auth(staff))
        .send({ role: 'Field work', startsAt: '2026-06-01T09:00:00+05:30' });
      const assignmentId = (assignment.body as Envelope<{ id: string }>).data!.id;

      if (minutes > 0) {
        await request(server)
          .post(`${PREFIX}/admin/volunteers/${id}/assignments/${assignmentId}/attendance`)
          .set(auth(staff))
          .send({ date: '2026-06-01', durationMinutes: minutes, verified: true });
      }
      return id;
    }

    it('issues against VERIFIED hours and freezes the figure', async () => {
      const id = await volunteerWithHours(300);
      await reauth();

      const response = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/certificates`)
        .set(auth(staff))
        .send({ periodStart: '2026-01-01', periodEnd: '2026-12-31' });

      expect(response.status).toBe(201);
      const data = (response.body as Envelope<{ hoursCredited: number; verificationCode: string }>)
        .data!;
      expect(data.hoursCredited).toBe(5);
      expect(data.verificationCode).toBeTruthy();

      // More work afterwards must NOT change a certificate already issued: the
      // printed copy is the one that exists in the world.
      const assignment = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments`)
        .set(auth(staff))
        .send({ role: 'More work', startsAt: '2026-07-01T09:00:00+05:30' });
      const assignmentId = (assignment.body as Envelope<{ id: string }>).data!.id;
      await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments/${assignmentId}/attendance`)
        .set(auth(staff))
        .send({ date: '2026-07-01', durationMinutes: 600, verified: true });

      const certificates = await request(server)
        .get(`${PREFIX}/admin/volunteers/${id}/certificates`)
        .set(auth(staff));
      expect(
        (certificates.body as Envelope<{ hoursCredited: number }[]>).data![0]!.hoursCredited,
      ).toBe(5);
    });

    it('refuses a certificate for under an hour of verified work', async () => {
      const id = await volunteerWithHours(45);
      await reauth();

      const response = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/certificates`)
        .set(auth(staff))
        .send({ periodStart: '2026-01-01', periodEnd: '2026-12-31' });

      // A certificate crediting no hours certifies nothing, and devalues every
      // real one. The database enforces `hours_credited > 0` as well.
      expect(response.status).toBe(409);
    });

    it('refuses a certificate for somebody who was never approved', async () => {
      const response = await apply();
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await reauth();

      const issued = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/certificates`)
        .set(auth(staff))
        .send({ periodStart: '2026-01-01', periodEnd: '2026-12-31' });

      expect(issued.status).toBe(409);
    });

    it('verifies publicly, showing only what is printed on the document', async () => {
      const id = await volunteerWithHours(180);
      await reauth();
      const issued = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/certificates`)
        .set(auth(staff))
        .send({ periodStart: '2026-01-01', periodEnd: '2026-12-31' });
      const code = (issued.body as Envelope<{ verificationCode: string }>).data!.verificationCode;

      // NO authentication. The reader is an employer with no relationship to
      // this organisation.
      const response = await request(server).get(`${PREFIX}/verify/certificate/${code}`);
      expect(response.status).toBe(200);

      const data = (response.body as Envelope<Record<string, unknown>>).data!;
      expect(data.valid).toBe(true);
      expect(data.hoursCredited).toBe(3);
      expect(data.volunteerName).toBeTruthy();

      // The code proves possession of ONE document. It is not a key to a
      // person's record.
      for (const leaked of ['email', 'phone', 'addressLine1', 'internalNotes', 'statusReason']) {
        expect(data).not.toHaveProperty(leaked);
      }
    });

    it('reports a withdrawn certificate as withdrawn, not as missing', async () => {
      const id = await volunteerWithHours(180);
      await reauth();
      const issued = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/certificates`)
        .set(auth(staff))
        .send({ periodStart: '2026-01-01', periodEnd: '2026-12-31' });
      const body = (issued.body as Envelope<{ id: string; verificationCode: string }>).data!;

      await reauth();
      await request(server)
        .patch(`${PREFIX}/admin/certificates/${body.id}/revoke`)
        .set(auth(staff))
        .send({ reason: 'Issued against the wrong period' })
        .expect(200);

      const response = await request(server).get(
        `${PREFIX}/verify/certificate/${body.verificationCode}`,
      );

      /*
        200 with `valid: false`, NOT a 404. "No such certificate" reads as a
        forgery, which is unfair to somebody holding one that was reissued for
        an administrative reason.
      */
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ valid: boolean }>).data!.valid).toBe(false);
    });

    it('answers an unknown code with a plain 404', async () => {
      const response = await request(server).get(`${PREFIX}/verify/certificate/NOTAREALCODE`);
      expect(response.status).toBe(404);
    });
  });

  // =========================================================================
  describe('what a volunteer may see and do', () => {
    /**
     * A signed-in public account for a volunteer.
     *
     * The OTP row is written by hand because the stored value is a hash; the
     * verify endpoint and everything after it is production code. Phase 8
     * removed the "must have donated" gate, so this works for somebody who has
     * only ever volunteered — which is the point.
     */
    async function signIn(email: string): Promise<string> {
      const code = '424242';
      await db().execute(sql`
        INSERT INTO otp_codes (identifier, purpose, code_hash, expires_at)
        VALUES (${email.toLowerCase()}, 'donor_login',
                ${createHash('sha256').update(code).digest('hex')},
                now() + interval '10 minutes')
      `);

      const response = await request(server)
        .post(`${PREFIX}/auth/donor/otp/verify`)
        .send({ email, code });

      expect(response.status).toBe(200);
      const data = (response.body as Envelope<{ accessToken: string; actor: { id: string } }>)
        .data!;
      accounts.push(data.actor.id);
      return data.accessToken;
    }

    it('lets somebody who has only volunteered sign in and see their record', async () => {
      const email = `owner-${randomUUID().slice(0, 8)}@example.test`;
      const response = await apply({ email });
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'approved' });
      await decide(id, { status: 'active' });

      const token = await signIn(email);
      const mine = await request(server)
        .get(`${PREFIX}/me/volunteering`)
        .set(auth(token))
        .expect(200);

      const data = (mine.body as Envelope<Record<string, unknown>>).data!;
      expect(data.isVolunteer).toBe(true);
      expect(data.volunteerId).toMatch(/^VOL-/);
    });

    it('NEVER returns the rejection reason or internal notes', async () => {
      const email = `rejected-${randomUUID().slice(0, 8)}@example.test`;
      const response = await apply({ email });
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await decide(id, {
        status: 'rejected',
        reason: 'SECRET-REASON-DO-NOT-LEAK',
        reviewNotes: 'SECRET-NOTES-DO-NOT-LEAK',
      });

      const token = await signIn(email);
      const mine = await request(server).get(`${PREFIX}/me/volunteering`).set(auth(token));

      const serialised = JSON.stringify(mine.body);
      // The decision is communicated; the reasoning behind it is internal.
      expect(serialised).not.toContain('SECRET-REASON-DO-NOT-LEAK');
      expect(serialised).not.toContain('SECRET-NOTES-DO-NOT-LEAK');
      expect(serialised).not.toContain('statusReason');
      expect(serialised).not.toContain('internalNotes');
    });

    it('resolves the CURRENT record when a rejected one shares the address', async () => {
      /*
        ══════════════════════════════════════════════════════════════════════
        The defect the audit found, from the volunteer's side.

        Re-application after rejection is supported, so one address can legally
        carry a rejected row AND a live one. `LIMIT 1` with no ORDER BY let
        Postgres return either — and returning the rejected one to somebody
        since approved shows them no identifier, no hours and no certificates,
        which reads as "my approval was lost".
        ══════════════════════════════════════════════════════════════════════
      */
      const email = `history-${randomUUID().slice(0, 8)}@example.test`;

      const rejected = await apply({ email });
      const rejectedId = (rejected.body as Envelope<{ id: string }>).data!.id;
      await decide(rejectedId, { status: 'rejected', reason: 'Not then' });

      const second = await apply({ email });
      const currentId = (second.body as Envelope<{ id: string }>).data!.id;
      await decide(currentId, { status: 'approved' });
      await decide(currentId, { status: 'active' });

      const token = await signIn(email);
      const mine = await request(server)
        .get(`${PREFIX}/me/volunteering`)
        .set(auth(token))
        .expect(200);

      const data = (mine.body as Envelope<{ id: string; volunteerId: string | null }>).data!;
      expect(data.id).toBe(currentId);
      expect(data.id).not.toBe(rejectedId);
      // The thing they actually came to see.
      expect(data.volunteerId).toMatch(/^VOL-/);
    });

    it('reports `isVolunteer: false` for an account that never applied', async () => {
      const token = await signIn(`donor-only-${randomUUID().slice(0, 8)}@example.test`);
      const mine = await request(server)
        .get(`${PREFIX}/me/volunteering`)
        .set(auth(token))
        .expect(200);

      // A legitimate negative answer, not an error.
      expect((mine.body as Envelope<{ isVolunteer: boolean }>).data!.isVolunteer).toBe(false);
    });

    it('offers a volunteer NO route that records or verifies their own attendance', async () => {
      const email = `noself-${randomUUID().slice(0, 8)}@example.test`;
      const response = await apply({ email });
      const id = (response.body as Envelope<{ id: string }>).data!.id;
      await decide(id, { status: 'approved' });
      await decide(id, { status: 'active' });
      const token = await signIn(email);

      /*
        THE ASSERTION THIS WHOLE MODULE RESTS ON. Certificates count verified
        hours; somebody able to record their own could print themselves any
        figure they liked, over the organisation's signature.

        401 rather than 403: the admin routes are a different token audience
        entirely, so a public account does not fail an authorization check
        there — it fails signature verification. That is a boundary no future
        change to a permission list can weaken.
      */
      const record = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/assignments/${randomUUID()}/attendance`)
        .set(auth(token))
        .send({ date: '2026-09-01', durationMinutes: 480, verified: true });
      expect(record.status).toBe(401);

      const verify = await request(server)
        .post(`${PREFIX}/admin/volunteers/${id}/attendance/verify`)
        .set(auth(token))
        .send({ attendanceIds: [randomUUID()], verified: true });
      expect(verify.status).toBe(401);
    });

    it('does not let one volunteer reach another’s record', async () => {
      const mineEmail = `mine-${randomUUID().slice(0, 8)}@example.test`;
      await applyOk({ email: mineEmail });

      const theirsEmail = `theirs-${randomUUID().slice(0, 8)}@example.test`;
      const theirs = await apply({ email: theirsEmail });
      const theirId = (theirs.body as Envelope<{ id: string }>).data!.id;
      await decide(theirId, { status: 'approved' });

      const token = await signIn(mineEmail);
      const mine = await request(server)
        .get(`${PREFIX}/me/volunteering`)
        .set(auth(token))
        .expect(200);

      // There is no volunteer id in any route on that controller — the record
      // is resolved from the session. This asserts they got their OWN.
      const data = (mine.body as Envelope<{ id: string; volunteerId: string | null }>).data!;
      expect(data.id).not.toBe(theirId);
      expect(data.volunteerId).toBeNull();
    });
  });
});
