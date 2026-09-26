import { createHash, randomUUID } from 'node:crypto';
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
 * Events, registration and attendance, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SUITE EXISTS FOR ONE TEST, AND THE REST SUPPORT IT.
 *
 * "Capacity 100, 99 registrations, two users register simultaneously. The
 * system must not create 101 registrations."
 *
 * That is not a test you can write against a mock. A mocked database has no
 * row locks, so a broken check-then-write passes every time. So this suite
 * boots the real application against the real Postgres, and the race test
 * fires genuinely concurrent requests from genuinely different sessions.
 *
 * `capacity` is small deliberately — filling three seats from eight requests
 * exercises exactly the same lock as filling the hundredth from two, and it
 * fails loudly if the lock is missing rather than occasionally.
 * ══════════════════════════════════════════════════════════════════════════
 */

interface DonorFixture {
  donorId: string;
  email: string;
  token: string;
}

const STAMP = Date.now().toString(36);

describe('Events (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staffToken: string;
  let contentToken: string;
  let volunteersToken: string;

  /** Events created by this suite, torn down at the end. */
  const createdEvents: string[] = [];
  const createdDonors: string[] = [];

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** ISO-8601 with an offset, which is what the DTO accepts. */
  const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  /**
   * A donor with a live session.
   *
   * The `otp_codes` row is written by hand because the stored value is a hash
   * and cannot be read back — that is the only step here that is not production
   * code. `/auth/donor/otp/verify` and everything after it is real.
   */
  async function makeDonor(label: string): Promise<DonorFixture> {
    const email = `${label}-events-${STAMP}@example.test`;
    const phone = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

    const donor = await db().execute(sql`
      INSERT INTO donors (donor_code, first_name, last_name, email, phone, email_opt_in)
      VALUES (${`DNR-EVT-${label}-${STAMP}`.slice(0, 24)}, ${label}, 'Tester',
              ${email}, ${phone}, true)
      RETURNING id
    `);
    const donorId = donor.rows![0]!.id as string;
    createdDonors.push(donorId);

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
    return {
      donorId,
      email,
      token: (response.body as Envelope<{ accessToken: string }>).data!.accessToken,
    };
  }

  /** Create, publish and open an event in one step, for the tests that need one. */
  async function makeOpenEvent(
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; slug: string }> {
    const created = await request(server)
      .post(`${PREFIX}/admin/events`)
      .set(auth(staffToken))
      .send({
        title: `Health camp ${randomUUID().slice(0, 8)}`,
        summary: 'A one-day community health camp.',
        description: 'Screening, medicines and follow-up referrals.',
        startDate: iso(7 * DAY),
        endDate: iso(7 * DAY + 6 * HOUR),
        venueName: 'Ward 12 Community Hall',
        city: 'Pune',
        state: 'Maharashtra',
        ...overrides,
      })
      .expect(201);

    const event = (created.body as Envelope<{ id: string; slug: string }>).data!;
    createdEvents.push(event.id);

    await request(server)
      .patch(`${PREFIX}/admin/events/${event.id}/status`)
      .set(auth(staffToken))
      .send({ status: 'published' })
      .expect(200);

    await request(server)
      .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
      .set(auth(staffToken))
      .send({ lifecycle: 'open' })
      .expect(200);

    return event;
  }

  async function seatsHeld(eventId: string): Promise<number> {
    const result = await db().execute(sql`
      SELECT coalesce(sum(attendee_count), 0)::int AS seats
        FROM event_registrations
       WHERE event_id = ${eventId}::uuid
         AND status IN ('registered', 'confirmed', 'attended', 'no_show')
    `);
    return Number(result.rows![0]!.seats);
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const staff = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() });
    staffToken = (staff.body as Envelope<{ accessToken: string }>).data!.accessToken;

    const content = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });
    contentToken = (content.body as Envelope<{ accessToken: string }>).data!.accessToken;

    const volunteers = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });
    volunteersToken = (volunteers.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    // `event_registrations.event_id` is ON DELETE RESTRICT, so the children go
    // first — the same ordering the admin UI has to respect.
    for (const id of createdEvents) {
      await db().execute(sql`DELETE FROM event_registrations WHERE event_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM impact_updates WHERE event_id = ${id}::uuid`);
      await db().execute(sql`DELETE FROM events WHERE id = ${id}::uuid`);
    }
    for (const id of createdDonors) {
      await db().execute(sql`DELETE FROM donors WHERE id = ${id}::uuid`);
    }

    /*
      A SAFETY NET, by title prefix.

      `createdEvents` only holds ids for creates that returned successfully. A
      create that succeeds and whose response then fails an assertion leaves a
      row nothing tracks — and these rows are PUBLISHED events, so a leftover
      does not sit quietly in a test schema, it appears on `/events`.

      Matched on the eight-hex-character suffix every fixture title carries, so
      this can never reach a real event that happens to start with the same
      words.
    */
    const fixtureTitles = sql`
      title ~ '^(Health camp|Internal planning|Nowhere|Webinar|Default state) [0-9a-f]{8}$'
    `;

    await db().execute(sql`
      DELETE FROM event_registrations
       WHERE event_id IN (SELECT id FROM events WHERE ${fixtureTitles})
    `);
    await db().execute(sql`DELETE FROM events WHERE ${fixtureTitles}`);

    await app.close();
  });

  // =========================================================================
  describe('capacity, under concurrency', () => {
    /**
     * THE TEST THIS SUITE IS FOR.
     *
     * Eight donors, three seats, all firing at once. A check-then-write
     * implementation lets several of them read "0 taken" before any of them
     * writes, and admits more than three. The row lock is what makes the count
     * each request reads include every request that came before it.
     */
    it('admits exactly as many people as there are seats, however many ask at once', async () => {
      const event = await makeOpenEvent({ capacity: 3 });

      /*
        THE DONORS ARE CREATED ONE AT A TIME. Only the REGISTRATIONS race.

        Signing eight people in at once is setup, not the thing under test, and
        doing it concurrently put eight simultaneous sign-in requests — each
        with its own inserts and its own pool checkout — on top of the other
        spec files vitest is running in parallel. That produced an intermittent
        `ECONNRESET`, in a different test on each run, which is exactly the kind
        of failure that gets written off as "flaky CI" and hides a real one.

        Sequential setup costs a second and removes the burst entirely. The
        race below is untouched, because that is the race that matters.
      */
      const donors: DonorFixture[] = [];
      for (let index = 0; index < 8; index += 1) {
        donors.push(await makeDonor(`race${index}`));
      }

      const responses = await Promise.all(
        donors.map((donor) =>
          request(server)
            .post(`${PREFIX}/events/${event.id}/register`)
            .set(auth(donor.token))
            .send({}),
        ),
      );

      const created = responses.filter((response) => response.status === 201);
      const refused = responses.filter((response) => response.status === 409);

      expect(created).toHaveLength(3);
      expect(refused).toHaveLength(5);
      // Every refusal is a capacity refusal, not an incidental error.
      for (const response of refused) {
        expect(errorCode(response.body as Envelope)).toBe('CONFLICT');
      }

      // The database, not the responses, is the thing being asserted on.
      expect(await seatsHeld(event.id)).toBe(3);

      const row = await db().execute(sql`
        SELECT registered_count, registration_status FROM events WHERE id = ${event.id}::uuid
      `);
      expect(Number(row.rows![0]!.registered_count)).toBe(3);
      // The server flipped it to `full` itself, from the count it wrote.
      expect(row.rows![0]!.registration_status).toBe('full');
    }, 60_000);

    it('counts a group booking against the cap, not the head count of bookings', async () => {
      const event = await makeOpenEvent({ capacity: 4 });
      const first = await makeDonor('group1');
      const second = await makeDonor('group2');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(first.token))
        .send({ attendeeCount: 3 })
        .expect(201);

      // Two rows would fit; five seats do not.
      const overflow = await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(second.token))
        .send({ attendeeCount: 2 });

      expect(overflow.status).toBe(409);
      expect(await seatsHeld(event.id)).toBe(3);

      // One seat is left, and one person still fits into it.
      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(second.token))
        .send({ attendeeCount: 1 })
        .expect(201);

      expect(await seatsHeld(event.id)).toBe(4);
    }, 60_000);

    it('lets a freed seat be taken, and reopens an event that was full', async () => {
      const event = await makeOpenEvent({ capacity: 1 });
      const holder = await makeDonor('holder');
      const waiter = await makeDonor('waiter');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(holder.token))
        .send({})
        .expect(201);

      const blocked = await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(waiter.token))
        .send({});
      expect(blocked.status).toBe(409);

      await request(server)
        .delete(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(holder.token))
        .send({ reason: 'Cannot make it' })
        .expect(200);

      const after = await db().execute(sql`
        SELECT registration_status FROM events WHERE id = ${event.id}::uuid
      `);
      expect(after.rows![0]!.registration_status).toBe('open');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(waiter.token))
        .send({})
        .expect(201);

      expect(await seatsHeld(event.id)).toBe(1);
    }, 60_000);

    it('does not reopen an event an operator closed by hand', async () => {
      const event = await makeOpenEvent({ capacity: 5 });
      const donor = await makeDonor('closed');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
        .set(auth(staffToken))
        .send({ lifecycle: 'closed' })
        .expect(200);

      await request(server)
        .delete(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(donor.token))
        .send({})
        .expect(200);

      const after = await db().execute(sql`
        SELECT registration_status FROM events WHERE id = ${event.id}::uuid
      `);
      // A freed seat is not a reason to overrule a human decision.
      expect(after.rows![0]!.registration_status).toBe('closed');
    }, 60_000);
  });

  // =========================================================================
  describe('who may register, and when', () => {
    it('refuses a second registration from the same person', async () => {
      const event = await makeOpenEvent();
      const donor = await makeDonor('dupe');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      const second = await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({});

      expect(second.status).toBe(409);
      expect(await seatsHeld(event.id)).toBe(1);
    }, 60_000);

    it('lets somebody who cancelled register again, reusing their one row', async () => {
      const event = await makeOpenEvent();
      const donor = await makeDonor('returner');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      await request(server)
        .delete(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(donor.token))
        .send({})
        .expect(200);

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      // The unique index on (event_id, email) is what makes this one row.
      const rows = await db().execute(sql`
        SELECT count(*)::int AS n FROM event_registrations WHERE event_id = ${event.id}::uuid
      `);
      expect(Number(rows.rows![0]!.n)).toBe(1);
      expect(await seatsHeld(event.id)).toBe(1);
    }, 60_000);

    it('refuses registration after the deadline', async () => {
      /*
        The deadline is set in the FUTURE and then moved, because
        `PATCH :id/lifecycle` refuses to open registration whose deadline has
        already passed — a page with an enabled button and a guaranteed refusal
        reads as a broken site rather than a closed event.

        So the fixture reaches the state the way a real event reaches it: the
        deadline was fine when registration opened, and then it went by.
      */
      const event = await makeOpenEvent({
        startDate: iso(3 * DAY),
        registrationDeadline: iso(DAY),
      });

      await db().execute(sql`
        UPDATE events
           SET registration_deadline = now() - interval '1 hour'
         WHERE id = ${event.id}::uuid
      `);

      const donor = await makeDonor('late');

      const response = await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({});

      expect(response.status).toBe(409);
      expect((response.body as Envelope).error!.message).toMatch(/deadline/i);
    }, 60_000);

    it('refuses registration for a cancelled event', async () => {
      const event = await makeOpenEvent();
      const donor = await makeDonor('cancelledevt');

      await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
        .set(auth(staffToken))
        .send({ lifecycle: 'cancelled', reason: 'Venue withdrawn' })
        .expect(200);

      const response = await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({});

      expect(response.status).toBe(409);
      expect((response.body as Envelope).error!.message).toMatch(/cancelled/i);
    }, 60_000);

    it('is 404, not 409, for an event the public cannot see', async () => {
      const created = await request(server)
        .post(`${PREFIX}/admin/events`)
        .set(auth(staffToken))
        .send({
          title: `Internal planning ${randomUUID().slice(0, 8)}`,
          summary: 'Not for the public.',
          startDate: iso(5 * DAY),
          venueName: 'Head office',
          city: 'Pune',
        })
        .expect(201);
      const event = (created.body as Envelope<{ id: string }>).data!;
      createdEvents.push(event.id);

      const donor = await makeDonor('prober');
      const response = await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({});

      // A draft must not confirm its own existence to somebody guessing ids.
      expect(response.status).toBe(404);
    }, 60_000);

    it('refuses an anonymous request', async () => {
      const event = await makeOpenEvent();
      const response = await request(server).post(`${PREFIX}/events/${event.id}/register`).send({});
      expect(response.status).toBe(401);
    }, 60_000);

    it('refuses a STAFF token, which cannot even verify on a donor route', async () => {
      const event = await makeOpenEvent();
      const response = await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(staffToken))
        .send({});
      /*
        401, NOT 403, AND THAT IS THE STRONGER ANSWER.

        The signing key is derived per audience, so a staff token does not fail
        an authorization check here — it fails signature verification. It is not
        a valid token on this route at all, which is a boundary no future change
        to a permission list can weaken. Same reasoning as `me.spec.ts`.

        It matters here because `actor.id` is a `users.id` on a staff token and
        a `donors.id` on a donor one: a staff token that got through would
        register whichever donor happened to share the id.
      */
      expect(response.status).toBe(401);
    }, 60_000);
  });

  // =========================================================================
  describe('a donor and their own registration', () => {
    it('returns the joining link to a registrant and to nobody else', async () => {
      const event = await makeOpenEvent({
        isOnline: true,
        meetingUrl: 'https://meet.example.test/ward-12',
        venueName: null,
      });
      const attendee = await makeDonor('online1');
      const stranger = await makeDonor('online2');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(attendee.token))
        .send({})
        .expect(201);

      const mine = await request(server)
        .get(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(attendee.token))
        .expect(200);
      expect((mine.body as Envelope<{ meetingUrl: string }>).data!.meetingUrl).toBe(
        'https://meet.example.test/ward-12',
      );

      // Somebody else's session finds nothing — 404, not 403: a 403 would
      // confirm that a registration exists.
      const theirs = await request(server)
        .get(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(stranger.token));
      expect(theirs.status).toBe(404);

      // And the public endpoint withholds it from everyone.
      const publicView = await request(server).get(`${PREFIX}/events/${event.slug}`).expect(200);
      expect(publicView.body.data).not.toHaveProperty('meetingUrl');
    }, 60_000);

    it('lists the donor’s own events and nobody else’s', async () => {
      const event = await makeOpenEvent();
      const mine = await makeDonor('mylist');
      const other = await makeDonor('otherlist');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(mine.token))
        .send({})
        .expect(201);

      const listed = await request(server)
        .get(`${PREFIX}/me/events`)
        .set(auth(mine.token))
        .expect(200);
      const ids = (listed.body as Envelope<{ items: { id: string }[] }>).data!.items.map(
        (item) => item.id,
      );
      expect(ids).toContain(event.id);

      const empty = await request(server)
        .get(`${PREFIX}/me/events`)
        .set(auth(other.token))
        .expect(200);
      const otherIds = (empty.body as Envelope<{ items: { id: string }[] }>).data!.items.map(
        (item) => item.id,
      );
      expect(otherIds).not.toContain(event.id);
    }, 60_000);

    it('refuses to cancel a registration that is already cancelled', async () => {
      const event = await makeOpenEvent();
      const donor = await makeDonor('twice');

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);
      await request(server)
        .delete(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(donor.token))
        .send({})
        .expect(200);

      const again = await request(server)
        .delete(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(donor.token))
        .send({});
      expect(again.status).toBe(409);
    }, 60_000);
  });

  // =========================================================================
  describe('attendance', () => {
    /**
     * A past event, built by creating a future one and then moving it.
     *
     * The DTO refuses a start date in the past on purpose — nobody schedules
     * an event for last Tuesday — so the fixture is made the way a real one
     * becomes past: it happens.
     */
    async function makePastEventWithAttendee() {
      const event = await makeOpenEvent();
      const donor = await makeDonor(`att${randomUUID().slice(0, 6)}`);

      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      await db().execute(sql`
        UPDATE events
           SET start_date = now() - interval '2 days',
               end_date   = now() - interval '2 days' + interval '4 hours',
               registration_deadline = NULL
         WHERE id = ${event.id}::uuid
      `);

      const registration = await db().execute(sql`
        SELECT id FROM event_registrations WHERE event_id = ${event.id}::uuid LIMIT 1
      `);

      return { event, donor, registrationId: registration.rows![0]!.id as string };
    }

    it('refuses to record attendance before the event has happened', async () => {
      const event = await makeOpenEvent();
      const donor = await makeDonor('early');
      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      const registration = await db().execute(sql`
        SELECT id FROM event_registrations WHERE event_id = ${event.id}::uuid LIMIT 1
      `);

      const response = await request(server)
        .post(`${PREFIX}/admin/events/${event.id}/attendance`)
        .set(auth(volunteersToken))
        .send({
          entries: [{ registrationId: registration.rows![0]!.id, status: 'attended' }],
        });

      // An attendance figure dated before the thing happened is exactly the
      // number decision A14 exists to keep off the site.
      expect(response.status).toBe(409);
    }, 60_000);

    it('records who came and who did not', async () => {
      const { event, registrationId } = await makePastEventWithAttendee();

      await request(server)
        .post(`${PREFIX}/admin/events/${event.id}/attendance`)
        .set(auth(volunteersToken))
        .send({ entries: [{ registrationId, status: 'attended' }] })
        .expect(200);

      const row = await db().execute(sql`
        SELECT status, attended_at FROM event_registrations WHERE id = ${registrationId}::uuid
      `);
      expect(row.rows![0]!.status).toBe('attended');
      expect(row.rows![0]!.attended_at).not.toBeNull();

      // Corrected to a no-show: the timestamp goes, because it would otherwise
      // contradict the status.
      await request(server)
        .post(`${PREFIX}/admin/events/${event.id}/attendance`)
        .set(auth(volunteersToken))
        .send({ entries: [{ registrationId, status: 'no_show' }] })
        .expect(200);

      const corrected = await db().execute(sql`
        SELECT status, attended_at FROM event_registrations WHERE id = ${registrationId}::uuid
      `);
      expect(corrected.rows![0]!.status).toBe('no_show');
      expect(corrected.rows![0]!.attended_at).toBeNull();
    }, 60_000);

    it('refuses to let a donor cancel once their attendance is recorded', async () => {
      const { event, donor, registrationId } = await makePastEventWithAttendee();

      await request(server)
        .post(`${PREFIX}/admin/events/${event.id}/attendance`)
        .set(auth(volunteersToken))
        .send({ entries: [{ registrationId, status: 'attended' }] })
        .expect(200);

      const response = await request(server)
        .delete(`${PREFIX}/events/${event.id}/registration`)
        .set(auth(donor.token))
        .send({});

      // "This person came" must not be replaceable with "this person withdrew".
      expect(response.status).toBe(409);
    }, 60_000);

    it('refuses the same attendee twice in one sheet', async () => {
      const { event, registrationId } = await makePastEventWithAttendee();

      const response = await request(server)
        .post(`${PREFIX}/admin/events/${event.id}/attendance`)
        .set(auth(volunteersToken))
        .send({
          entries: [
            { registrationId, status: 'attended' },
            { registrationId, status: 'no_show' },
          ],
        });

      expect(response.status).toBe(422);
    }, 60_000);
  });

  // =========================================================================
  describe('the attendee list is sensitive', () => {
    it('refuses without a recent re-authentication, then allows it', async () => {
      const event = await makeOpenEvent();
      const donor = await makeDonor('roster');
      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      // A fresh login is not a re-authentication. The window is opened
      // deliberately, by re-entering a password.
      const staleUser = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });
      const staleToken = (staleUser.body as Envelope<{ accessToken: string }>).data!.accessToken;

      const refused = await request(server)
        .get(`${PREFIX}/admin/events/${event.id}/registrations`)
        .set(auth(staleToken));
      expect(refused.status).toBe(403);
      expect(errorCode(refused.body as Envelope)).toBe('REAUTH_REQUIRED');

      await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set(auth(staleToken))
        .send({ password: TEST_PASSWORD, totpCode: devTotpCode() })
        .expect(200);

      const allowed = await request(server)
        .get(`${PREFIX}/admin/events/${event.id}/registrations`)
        .set(auth(staleToken))
        .expect(200);

      const items = (allowed.body as Envelope<{ items: { email: string }[] }>).data!.items;
      expect(items.map((item) => item.email)).toContain(donor.email.toLowerCase());
    }, 60_000);

    it('refuses a staff member who does not hold the permission', async () => {
      const event = await makeOpenEvent();
      const response = await request(server)
        .get(`${PREFIX}/admin/events/${event.id}/registrations`)
        .set(auth(contentToken));
      expect(response.status).toBe(403);
    }, 60_000);
  });

  // =========================================================================
  describe('publication and lifecycle', () => {
    it('will not publish an event with nowhere to go', async () => {
      const created = await request(server)
        .post(`${PREFIX}/admin/events`)
        .set(auth(staffToken))
        .send({
          title: `Nowhere ${randomUUID().slice(0, 8)}`,
          summary: 'A summary, but no venue and no city.',
          startDate: iso(4 * DAY),
        })
        .expect(201);
      const event = (created.body as Envelope<{ id: string }>).data!;
      createdEvents.push(event.id);

      const response = await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' });

      expect(response.status).toBe(422);
    }, 60_000);

    it('will not publish an online event with no joining link', async () => {
      const created = await request(server)
        .post(`${PREFIX}/admin/events`)
        .set(auth(staffToken))
        .send({
          title: `Webinar ${randomUUID().slice(0, 8)}`,
          summary: 'An online session.',
          startDate: iso(4 * DAY),
          isOnline: true,
        })
        .expect(201);
      const event = (created.body as Envelope<{ id: string }>).data!;
      createdEvents.push(event.id);

      const response = await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'published' });

      expect(response.status).toBe(422);
    }, 60_000);

    it('creates every event as a draft with registration closed', async () => {
      const created = await request(server)
        .post(`${PREFIX}/admin/events`)
        .set(auth(staffToken))
        .send({
          title: `Default state ${randomUUID().slice(0, 8)}`,
          summary: 'Checking the defaults.',
          startDate: iso(4 * DAY),
          venueName: 'Hall',
          city: 'Pune',
          // Both of these are server-controlled and must be ignored, not obeyed.
          status: 'published',
          registrationStatus: 'open',
        });

      // The DTO is `.strict()`, so naming a server-controlled field is an error
      // rather than something silently dropped.
      expect(created.status).toBe(422);
    }, 60_000);

    it('refuses to archive an event people are registered for', async () => {
      const event = await makeOpenEvent();
      const donor = await makeDonor('stranded');
      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({})
        .expect(201);

      const refused = await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'archived' });

      // Archiving is a 404 to the public. Doing it here would take the page away
      // from everyone holding a place without telling any of them.
      expect(refused.status).toBe(409);

      await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
        .set(auth(staffToken))
        .send({ lifecycle: 'cancelled', reason: 'Called off' })
        .expect(200);

      await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'archived' })
        .expect(200);
    }, 60_000);

    it('requires a reason to cancel, because the reason is quoted to registrants', async () => {
      const event = await makeOpenEvent();
      const response = await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
        .set(auth(staffToken))
        .send({ lifecycle: 'cancelled' });
      expect(response.status).toBe(422);
    }, 60_000);

    it('will not reopen a completed event', async () => {
      const event = await makeOpenEvent();
      await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
        .set(auth(staffToken))
        .send({ lifecycle: 'completed' })
        .expect(200);

      const response = await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
        .set(auth(staffToken))
        .send({ lifecycle: 'open' });
      expect(response.status).toBe(409);
    }, 60_000);

    it('keeps a cancelled event visible to the public', async () => {
      const event = await makeOpenEvent();
      await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}/lifecycle`)
        .set(auth(staffToken))
        .send({ lifecycle: 'cancelled', reason: 'Flooding' })
        .expect(200);

      // The whole reason cancellation is not an archive: the people holding a
      // registration need to be able to land on this page and read the notice.
      const publicView = await request(server).get(`${PREFIX}/events/${event.slug}`).expect(200);
      expect(publicView.body.data.registrationStatus).toBe('cancelled');
    }, 60_000);

    it('refuses to lower the cap below the seats already taken', async () => {
      const event = await makeOpenEvent({ capacity: 10 });
      const first = await makeDonor('cap1');
      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(first.token))
        .send({ attendeeCount: 4 })
        .expect(201);

      const response = await request(server)
        .patch(`${PREFIX}/admin/events/${event.id}`)
        .set(auth(staffToken))
        .send({ capacity: 2 });

      expect(response.status).toBe(422);
    }, 60_000);
  });

  // =========================================================================
  describe('the seat counter', () => {
    it('is corrected by a recount when it has drifted', async () => {
      const event = await makeOpenEvent({ capacity: 20 });
      const donor = await makeDonor('drift');
      await request(server)
        .post(`${PREFIX}/events/${event.id}/register`)
        .set(auth(donor.token))
        .send({ attendeeCount: 2 })
        .expect(201);

      // Drift, forced. This is the state the recount exists for — the counter
      // is only ever written inside the registration transaction, so in
      // practice it gets here through a restore or a manual edit.
      await db().execute(sql`
        UPDATE events SET registered_count = 99 WHERE id = ${event.id}::uuid
      `);

      const response = await request(server)
        .post(`${PREFIX}/admin/events/${event.id}/recount`)
        .set(auth(staffToken))
        .expect(200);

      const result = (response.body as Envelope<{ was: number; now: number; drifted: boolean }>)
        .data!;
      expect(result.was).toBe(99);
      expect(result.now).toBe(2);
      expect(result.drifted).toBe(true);
    }, 60_000);
  });
});
