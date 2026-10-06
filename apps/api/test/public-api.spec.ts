import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sql } from 'drizzle-orm';

import { DATABASE } from '../src/modules/database/database.module.js';
import { PREFIX, createTestApp, errorCode, type Envelope } from './harness.js';

/**
 * The public read API.
 *
 * Two things are being tested: the shape every client depends on, and the
 * boundary between what is published and what is not. The second matters more
 * — an unpublished campaign or an internal note reaching this API is a
 * disclosure, and no amount of frontend care can put it back.
 */
describe('Public API (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const get = (path: string) => request(server).get(`${PREFIX}${path}`);

  describe('the response envelope', () => {
    it('wraps every success identically, with a correlatable request id', async () => {
      const response = await get('/programs');

      expect(response.status).toBe(200);
      const body = response.body as Envelope;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.meta?.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers['x-request-id']).toBeTruthy();
    });

    it('wraps every failure identically, with a stable machine code', async () => {
      const response = await get('/programs/no-such-programme');

      expect(response.status).toBe(404);
      const body = response.body as Envelope;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('NOT_FOUND');
      expect(body.error?.requestId).toBeTruthy();
      // The message is for a person; the code is for the client. Both are here.
      expect(body.error?.message).toBeTruthy();
    });

    it('echoes an inbound request id so a trace spans both services', async () => {
      const supplied = '11111111-2222-4333-8444-555555555555';
      const response = await get('/programs').set('x-request-id', supplied);

      expect(response.headers['x-request-id']).toBe(supplied);
    });
  });

  describe('pagination', () => {
    it('returns the documented pagination block', async () => {
      const response = await get('/campaigns?page=1&limit=2');
      const body = response.body as Envelope<{
        items: unknown[];
        pagination: Record<string, unknown>;
      }>;

      expect(body.data?.items.length).toBeLessThanOrEqual(2);
      expect(body.data?.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrevious: expect.any(Boolean),
      });
    });

    it('refuses a limit above the ceiling instead of silently clamping', async () => {
      // An endpoint that accepts an unbounded limit is a denial-of-service
      // primitive anyone can fire with a URL.
      const response = await get('/campaigns?limit=101');

      expect(response.status).toBe(422);
      expect(errorCode(response.body as Envelope)).toBe('VALIDATION_FAILED');
    });

    it('returns an empty page rather than an error when a page is past the end', async () => {
      const response = await get('/campaigns?page=999');

      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ items: unknown[] }>).data?.items).toEqual([]);
    });
  });

  describe('publication boundary', () => {
    it('serves only published campaigns', async () => {
      const response = await get('/campaigns?status=all&limit=100');
      const items = (response.body as Envelope<{ items: { status: string }[] }>).data!.items;

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.status !== 'draft')).toBe(true);
    });

    it('404s an unpublished campaign rather than serving it', async () => {
      // There is no query parameter that changes this, and no "preview" mode on
      // the public API.
      const response = await get('/campaigns/draft-campaign-not-published');
      expect(response.status).toBe(404);
    });

    it('never leaks internal fields', async () => {
      const list = await get('/campaigns?limit=100');
      const programs = await get('/programs?limit=100');
      const events = await get('/events?when=upcoming&limit=100');

      const serialised = JSON.stringify([list.body, programs.body, events.body]);

      // `internalNotes` is operational commentary; `meetingUrl` is a joinable
      // link that must reach registered attendees only.
      for (const field of ['internalNotes', 'meetingUrl']) {
        expect(serialised).not.toContain(field);
      }
    });
  });

  describe('endpoints', () => {
    it.each(['/programs', '/campaigns', '/stories', '/events', '/team', '/impact'])(
      'serves %s',
      async (path) => {
        const response = await get(path);
        expect(response.status).toBe(200);
        expect((response.body as Envelope).success).toBe(true);
      },
    );

    it('serves a campaign detail with its products', async () => {
      const list = await get('/campaigns?limit=1');
      const slug = (list.body as Envelope<{ items: { slug: string }[] }>).data!.items[0]!.slug;

      const response = await get(`/campaigns/${slug}`);
      expect(response.status).toBe(200);

      const campaign = (response.body as Envelope<Record<string, unknown>>).data!;
      expect(campaign.slug).toBe(slug);
      expect(Array.isArray(campaign.products)).toBe(true);
    });

    it('returns money as integer paise, never a float', async () => {
      // Decision A2. A float here is a rounding error waiting to become a
      // reconciliation dispute.
      const response = await get('/campaigns?limit=100');
      const items = (
        response.body as Envelope<{
          items: { goalAmount: number | null; amountRaised: number | null }[];
        }>
      ).data!.items;

      for (const item of items) {
        for (const value of [item.goalAmount, item.amountRaised]) {
          if (value === null || value === undefined) continue;
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    });

    it.each([
      ['a slug with a path traversal', '/campaigns/..%2F..%2Fetc%2Fpasswd'],
      ['a slug with SQL', "/campaigns/x'%20OR%201=1--"],
      ['an over-long slug', `/campaigns/${'a'.repeat(300)}`],
    ])('rejects %s without a 500', async (_label, path) => {
      const response = await get(path);
      expect([400, 404, 422]).toContain(response.status);
      expect(JSON.stringify(response.body)).not.toMatch(/stack|at Object\.|node_modules/i);
    });
  });

  // =========================================================================
  /**
   * `sort=featured` — what leads the homepage's Featured Campaigns band.
   *
   * Two campaigns of its own, so the suite never flips a seeded campaign's
   * flag under another spec file running against the same database. Their
   * featured orders, 0 and 1, sort ahead of every seeded featured campaign,
   * which has none.
   */
  describe('featured order', () => {
    const FIRST = 'featured-order-test-first';
    const SECOND = 'featured-order-test-second';

    const db = () =>
      app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
        DATABASE,
      ).db;

    beforeAll(async () => {
      // Inserted second-first, so creation order cannot be what puts them right.
      await db().execute(sql`
        INSERT INTO campaigns (title, slug, fundraising_goal, status, is_featured, featured_order,
                               published_at)
        VALUES ('Featured order test (second)', ${SECOND}, 100000, 'active', true, 1, now()),
               ('Featured order test (first)', ${FIRST}, 100000, 'active', true, 0, now())
        ON CONFLICT (slug) DO NOTHING
      `);
    }, 60_000);

    afterAll(async () => {
      await db().execute(sql`DELETE FROM campaigns WHERE slug IN (${FIRST}, ${SECOND})`);
    });

    type Row = { slug: string; isFeatured: boolean; endDate: string | null };
    const list = async () =>
      (
        (await get('/campaigns?sort=featured&limit=100').expect(200)).body as Envelope<{
          items: Row[];
        }>
      ).data!.items;

    it('puts the featured campaigns first, in their featured order', async () => {
      const items = await list();
      expect(items.slice(0, 2).map((item) => item.slug)).toEqual([FIRST, SECOND]);

      // Every featured campaign before every other one.
      const firstOrdinary = items.findIndex((item) => !item.isFeatured);
      if (firstOrdinary !== -1) {
        expect(items.slice(firstOrdinary).every((item) => !item.isFeatured)).toBe(true);
      }
    });

    it('orders the rest by deadline, soonest first, with no deadline last', async () => {
      const rest = (await list()).filter((item) => !item.isFeatured);
      const deadlines = rest.map((item) =>
        item.endDate ? new Date(item.endDate).getTime() : Number.POSITIVE_INFINITY,
      );
      expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));
    });

    it('still serves only what the public may see', async () => {
      const items = (await list()) as (Row & { status: string })[];
      expect(items.every((item) => ['active', 'paused'].includes(item.status))).toBe(true);
    });
  });

  /**
   * An end date is an optional DEADLINE. Once it has passed, an active
   * campaign reports itself closed, so the page never offers a donation the
   * checkout would refuse. Its own rows, for the same reason as above.
   */
  describe('the end date', () => {
    const ENDED = 'end-date-test-ended';
    const ONGOING = 'end-date-test-ongoing';
    const LATER = 'end-date-test-later';
    const PAUSED = 'end-date-test-paused';

    const db = () =>
      app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
        DATABASE,
      ).db;

    beforeAll(async () => {
      await db().execute(sql`
        INSERT INTO campaigns (title, slug, fundraising_goal, status, published_at, end_date)
        VALUES ('End date test (ended)', ${ENDED}, 100000, 'active', now(),
                now() - interval '3 days'),
               ('End date test (ongoing)', ${ONGOING}, 100000, 'active', now(), NULL),
               ('End date test (later)', ${LATER}, 100000, 'active', now(),
                now() + interval '10 days'),
               ('End date test (paused)', ${PAUSED}, 100000, 'paused', now(), NULL)
        ON CONFLICT (slug) DO NOTHING
      `);
    }, 60_000);

    afterAll(async () => {
      await db().execute(
        sql`DELETE FROM campaigns WHERE slug IN (${ENDED}, ${ONGOING}, ${LATER}, ${PAUSED})`,
      );
    });

    const slugsFor = async (status: string) =>
      (
        (await get(`/campaigns?status=${status}&limit=100`).expect(200)).body as Envelope<{
          items: { slug: string; status: string }[];
        }>
      ).data!.items;

    const donationOf = async (slug: string) =>
      (
        (await get(`/campaigns/${slug}`).expect(200)).body as Envelope<{
          donation: { state: string; reason?: string };
        }>
      ).data!.donation;

    it('closes an active campaign once its end date has passed', async () => {
      const donation = await donationOf(ENDED);
      expect(donation.state).toBe('ended');
      expect(donation.reason).toBeTruthy();
    });

    it('keeps a campaign with no end date open — ongoing is the default', async () => {
      expect((await donationOf(ONGOING)).state).toBe('open');
    });

    /*
      `open` is what the homepage grid and the listing's "Active" ask for, so
      nothing in it may be unable to take a donation; `closed` is the rest of
      the default listing, short of finished. Together they are the default.
    */
    it('lists only campaigns taking donations under status=open', async () => {
      const open = await slugsFor('open');
      const slugs = open.map((item) => item.slug);
      expect(slugs).toEqual(expect.arrayContaining([ONGOING, LATER]));
      expect(slugs).not.toContain(ENDED);
      expect(slugs).not.toContain(PAUSED);
      expect(open.every((item) => item.status === 'active')).toBe(true);
    });

    it('lists paused and past-deadline campaigns under status=closed', async () => {
      const closed = await slugsFor('closed');
      const slugs = closed.map((item) => item.slug);
      expect(slugs).toEqual(expect.arrayContaining([ENDED, PAUSED]));
      expect(slugs).not.toContain(ONGOING);
      expect(slugs).not.toContain(LATER);
      expect(closed.every((item) => ['active', 'paused'].includes(item.status))).toBe(true);
    });

    it('splits the default listing between open and closed, with no overlap', async () => {
      const open = (await slugsFor('open')).map((item) => item.slug);
      const closed = (await slugsFor('closed')).map((item) => item.slug);
      const all = (await slugsFor('active')).map((item) => item.slug);
      expect(open.filter((slug) => closed.includes(slug))).toEqual([]);
      expect([...open, ...closed].sort()).toEqual([...all].sort());
    });

    it('rejects a status it does not know', async () => {
      // Validation failures are 422 across this API.
      await get('/campaigns?status=draft').expect(422);
    });
  });

  /**
   * The donor list is the ONLY public endpoint that returns a person's name, so
   * it gets its own block. Every test here is about what must NOT come back.
   */
  describe('campaign donors', () => {
    const SLUG = 'school-kits-jharkhand';
    const NAMED = { email: 'public-named@example.test', phone: '9822200001' };
    const HIDDEN = { email: 'public-hidden@example.test', phone: '9822200002' };
    const STANDING = { email: 'public-standing@example.test', phone: '9822200003' };

    const db = () =>
      app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
        DATABASE,
      ).db;

    /** One confirmed donation, with the two anonymity flags set as asked. */
    async function give(
      who: { email: string; phone: string },
      name: [string, string],
      amount: number,
      flags: { donationAnonymous?: boolean; donorAnonymous?: boolean } = {},
    ) {
      const donor = await db().execute(sql`
        INSERT INTO donors (donor_code, first_name, last_name, email, phone, is_anonymous)
        VALUES (${`DNR-PUB-${who.phone.slice(-4)}`}, ${name[0]}, ${name[1]}, ${who.email},
                ${who.phone}, ${flags.donorAnonymous ?? false})
        ON CONFLICT (lower(btrim(email))) DO UPDATE
          SET is_anonymous = EXCLUDED.is_anonymous, first_name = EXCLUDED.first_name
        RETURNING id
      `);
      const donorId = donor.rows![0]!.id as string;

      const campaign = await db().execute(
        sql`SELECT id FROM campaigns WHERE slug = ${SLUG} LIMIT 1`,
      );
      const campaignId = campaign.rows![0]!.id as string;

      await db().execute(sql`
        INSERT INTO donations (reference, donor_id, campaign_id, amount, status, donation_type,
                               anonymous, completed_at)
        VALUES (${`DON-PUB-${who.phone.slice(-4)}`}, ${donorId}::uuid, ${campaignId}::uuid,
                ${amount}, 'successful', 'custom', ${flags.donationAnonymous ?? false}, now())
        ON CONFLICT (reference) DO UPDATE
          SET amount = EXCLUDED.amount, anonymous = EXCLUDED.anonymous
      `);
    }

    beforeAll(async () => {
      await give(NAMED, ['Meera', 'Nair'], 250000);
      await give(HIDDEN, ['Ravi', 'Kulkarni'], 990000, { donationAnonymous: true });
      await give(STANDING, ['Priya', 'Deshpande'], 120000, { donorAnonymous: true });
    }, 60_000);

    afterAll(async () => {
      const emails = sql`(${NAMED.email}, ${HIDDEN.email}, ${STANDING.email})`;
      const ours = sql`(SELECT id FROM donors WHERE email IN ${emails})`;
      await db().execute(sql`DELETE FROM donations WHERE donor_id IN ${ours}`);
      await db().execute(sql`DELETE FROM donors WHERE email IN ${emails}`);
    });

    it('names a donor who did not ask to be hidden', async () => {
      const response = await get(`/campaigns/${SLUG}/donors?limit=25`).expect(200);
      const items = (response.body as Envelope<{ items: { name: string }[] }>).data!.items;
      expect(items.map((item) => item.name)).toContain('Meera Nair');
    });

    /**
     * The flag set at the till. The name must not appear ANYWHERE in the
     * response — asserting on the parsed field would pass even if the name were
     * also sitting in some other property nobody thought to check.
     */
    it('never returns the name behind an anonymous donation', async () => {
      const response = await get(`/campaigns/${SLUG}/donors?limit=25`).expect(200);

      expect(JSON.stringify(response.body)).not.toContain('Kulkarni');
      const items = (response.body as Envelope<{ items: { name: string; anonymous: boolean }[] }>)
        .data!.items;
      const hidden = items.find((item) => item.anonymous);
      expect(hidden?.name).toBe('Anonymous Donor');
    });

    /**
     * The donor's STANDING preference, set in their dashboard. A donor who asked
     * to be anonymous everywhere should not have to remember to tick the box on
     * every future donation.
     */
    it('honours a donor’s standing anonymity even when the donation is not flagged', async () => {
      const response = await get(`/campaigns/${SLUG}/donors?limit=25`).expect(200);
      expect(JSON.stringify(response.body)).not.toContain('Deshpande');
    });

    it('returns nothing that could identify anyone beyond a display name', async () => {
      const response = await get(`/campaigns/${SLUG}/donors?limit=25`).expect(200);
      const body = JSON.stringify(response.body);

      for (const leak of ['@example.test', '98222000', 'DNR-PUB', 'DON-PUB']) {
        expect(body, `${leak} must never reach the public donor list`).not.toContain(leak);
      }

      const items = (response.body as Envelope<{ items: Record<string, unknown>[] }>).data!.items;
      expect(Object.keys(items[0] ?? {}).sort()).toEqual([
        'amount',
        'anonymous',
        'donatedAt',
        'name',
      ]);
    });

    it('orders by amount when asked, and by recency otherwise', async () => {
      const generous = await get(`/campaigns/${SLUG}/donors?sort=generous&limit=25`).expect(200);
      const amounts = (generous.body as Envelope<{ items: { amount: number }[] }>).data!.items.map(
        (item) => item.amount,
      );

      expect([...amounts]).toEqual([...amounts].sort((a, b) => b - a));
    });

    it('refuses a sort it does not recognise, rather than interpolating it', async () => {
      const response = await get(`/campaigns/${SLUG}/donors?sort=amount;DROP`);
      expect(response.status).toBe(422);
    });

    it('caps the page size however large a limit is asked for', async () => {
      const response = await get(`/campaigns/${SLUG}/donors?limit=500`);
      expect(response.status).toBe(422);
    });
  });

  describe('health probes', () => {
    it('answers liveness without touching a dependency', async () => {
      const response = await get('/health');
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ status: string }>).data?.status).toBe('ok');
    });

    it('reports every dependency on readiness', async () => {
      const response = await get('/health/ready');
      const checks = (response.body as Envelope<{ checks: Record<string, { status: string }> }>)
        .data!.checks;

      expect(Object.keys(checks).sort()).toEqual(['database', 'queue', 'redis']);
      expect(checks.database?.status).toBe('up');
      expect(checks.redis?.status).toBe('up');
    });

    it('exposes no infrastructure detail on an unauthenticated probe', async () => {
      const response = await get('/health/ready');
      expect(JSON.stringify(response.body)).not.toMatch(
        /postgresql:\/\/|redis:\/\/|password|@localhost:5432/i,
      );
    });
  });
});
