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
 * Programme and campaign management, end to end.
 *
 * The suite is organised around REFUSALS as much as successes: an invalid
 * transition, a draft reached publicly, a system-controlled field written from
 * a payload. Those are the cases that matter, and a suite that only walks the
 * happy path proves that the happy path exists, not that the rules hold.
 */
describe('Catalog (integration)', () => {
  let app: INestApplication;
  let server: unknown;
  let superAdmin: string;
  let contentManager: string;
  let campaignManager: string;
  let educationCategoryId: string;

  const created = { programs: [] as string[], campaigns: [] as string[] };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function reauth(token: string) {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = async (email: string) => {
      /*
        ALWAYS a second factor. SUPER_ADMIN mandates TOTP (decision A8) and
        since Phase 8 it is the only staff role, so there is no password-only
        staff login left to exercise.
      */
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email, password: TEST_PASSWORD, totpCode: devTotpCode() });
      return (response.body as Envelope<{ accessToken: string }>).data!.accessToken;
    };

    superAdmin = await login(TEST_USERS.superAdmin);
    contentManager = await login(TEST_USERS.staff);
    campaignManager = await login(TEST_USERS.staff);

    const categories = await request(server)
      .get(`${PREFIX}/admin/categories`)
      .set(auth(superAdmin));
    educationCategoryId = (
      categories.body as Envelope<{ items: { id: string; key: string }[] }>
    ).data!.items.find((item) => item.key === 'EDUCATION')!.id;
  }, 60_000);

  afterAll(async () => {
    // Remove what the suite created, so a second run starts from the same
    // state as the first. Slug history goes too, or the next run's slugs
    // collide with retired ones from this one.
    const database = app.get<{ db: { execute(q: unknown): Promise<unknown> } }>(DATABASE);

    /**
     * Children first, then parents — `campaign_products` references campaigns
     * with ON DELETE RESTRICT, deliberately, so that financial history cannot
     * be removed by deleting the campaign above it. That protection applies to
     * test data too.
     *
     * Both slug prefixes: the rename test leaves a `renamed-spec-…` record, and
     * missing it means the NEXT run collides with a slug this one retired.
     */
    const like = sql`(slug LIKE 'spec-%' OR slug LIKE 'renamed-spec-%')`;

    await database.db.execute(
      sql`DELETE FROM campaign_products WHERE campaign_id IN (SELECT id FROM campaigns WHERE ${like})`,
    );
    await database.db.execute(
      sql`DELETE FROM impact_updates WHERE campaign_id IN (SELECT id FROM campaigns WHERE ${like})`,
    );
    /*
      AND by slug, because the update tests run against a SEEDED campaign.

      The clause above only catches updates hanging off campaigns this suite
      created; "Spec update" is written to a seeded one and survived every run,
      accumulating. Phase 9 gave impact updates a public page, so those
      leftovers stopped being invisible and started appearing on `/impact`.
    */
    await database.db.execute(sql`DELETE FROM impact_updates WHERE slug LIKE 'spec-update%'`);
    await database.db.execute(
      sql`DELETE FROM faqs WHERE context_id IN (SELECT id FROM campaigns WHERE ${like})`,
    );
    await database.db.execute(sql`DELETE FROM campaigns WHERE ${like}`);
    // The catalogue outlives campaigns, so its rows are not swept by the
    // campaign delete above and need naming separately.
    await database.db.execute(sql`DELETE FROM products WHERE slug LIKE 'spec-%'`);
    await database.db.execute(
      sql`DELETE FROM campaigns WHERE program_id IN (SELECT id FROM programs WHERE ${like})`,
    );
    await database.db.execute(sql`DELETE FROM programs WHERE ${like}`);
    await database.db.execute(
      sql`DELETE FROM slug_history WHERE slug LIKE 'spec-%' OR slug LIKE 'renamed-spec-%'`,
    );
    await app?.close();
  });

  // =========================================================================

  describe('categories', () => {
    it('serves the seeded catalogue', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/categories`)
        .set(auth(superAdmin));

      const items = (response.body as Envelope<{ items: { key: string }[] }>).data!.items;
      expect(items.length).toBeGreaterThanOrEqual(12);
      expect(items.map((item) => item.key)).toContain('DISASTER_RELIEF');
    });

    it('counts only PUBLIC records, and omits empty categories publicly', async () => {
      // A filter chip that leads to an empty page is worse than no chip.
      const response = await request(server).get(`${PREFIX}/categories?kind=campaign`);
      const items = (response.body as Envelope<{ items: { campaignCount: number }[] }>).data!.items;

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.campaignCount > 0)).toBe(true);
    });
  });

  describe('programme lifecycle', () => {
    let programId: string;

    it('creates as a DRAFT, whatever the payload says', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/programs`)
        .set(auth(superAdmin))
        .send({
          title: 'Spec Programme',
          slug: 'spec-programme',
          shortDescription: 'Created by the integration suite.',
          categoryId: educationCategoryId,
          // Neither may be set from a request body.
          status: 'published',
          publishedAt: '2020-01-01T00:00:00Z',
        });

      expect(response.status).toBe(201);
      const body = (response.body as Envelope<{ id: string; status: string; category: string }>)
        .data!;
      expect(body.status).toBe('draft');
      // The denormalised name is written from the category, not the payload.
      expect(body.category).toBe('Education');

      programId = body.id;
      created.programs.push(programId);
    });

    it('hides the draft from the public API', async () => {
      const response = await request(server).get(`${PREFIX}/programs/spec-programme`);
      expect(response.status).toBe(404);
    });

    it('omits the draft from the public listing', async () => {
      const response = await request(server).get(`${PREFIX}/programs?limit=100`);
      const slugs = (response.body as Envelope<{ items: { slug: string }[] }>).data!.items.map(
        (item) => item.slug,
      );
      expect(slugs).not.toContain('spec-programme');
    });

    it('publishes, and the public API serves it', async () => {
      await request(server)
        .post(`${PREFIX}/admin/programs/${programId}/publish`)
        .set(auth(superAdmin))
        .send({})
        .expect(200);

      const response = await request(server).get(`${PREFIX}/programs/spec-programme`);
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ title: string }>).data?.title).toBe('Spec Programme');
    });

    it('refuses to publish without a short description', async () => {
      const draft = await request(server)
        .post(`${PREFIX}/admin/programs`)
        .set(auth(superAdmin))
        .send({ title: 'Spec Incomplete', slug: 'spec-incomplete' });

      const id = (draft.body as Envelope<{ id: string }>).data!.id;
      created.programs.push(id);

      const response = await request(server)
        .post(`${PREFIX}/admin/programs/${id}/publish`)
        .set(auth(superAdmin))
        .send({});

      expect(response.status).toBe(422);
      const details = (response.body as Envelope).error?.details as { field: string }[];
      expect(details.map((detail) => detail.field)).toContain('shortDescription');
    });

    it('keeps the old URL working after a rename', async () => {
      await request(server)
        .patch(`${PREFIX}/admin/programs/${programId}`)
        .set(auth(superAdmin))
        .send({ slug: 'renamed-spec-programme' })
        .expect(200);

      // The old slug is gone…
      await request(server).get(`${PREFIX}/programs/spec-programme`).expect(404);
      // …but resolves to the new one, so the web app can issue a 301 rather
      // than letting every existing link die.
      const redirect = await request(server).get(`${PREFIX}/redirects/program/spec-programme`);
      expect((redirect.body as Envelope<{ slug: string }>).data?.slug).toBe(
        'renamed-spec-programme',
      );
      await request(server).get(`${PREFIX}/programs/renamed-spec-programme`).expect(200);
    });

    it('refuses to reuse a retired slug on a different record', async () => {
      // Reusing it would make the redirect point at the wrong programme —
      // worse than a 404, because it is confidently wrong.
      const response = await request(server)
        .post(`${PREFIX}/admin/programs`)
        .set(auth(superAdmin))
        .send({ title: 'Slug Thief', slug: 'spec-programme' });

      expect(response.status).toBe(409);
    });
  });

  describe('campaign lifecycle', () => {
    let campaignId: string;
    let programId: string;

    beforeAll(async () => {
      const program = await request(server)
        .post(`${PREFIX}/admin/programs`)
        .set(auth(superAdmin))
        .send({
          title: 'Spec Campaign Programme',
          slug: 'spec-campaign-programme',
          shortDescription: 'Host programme for the campaign spec.',
        });
      programId = (program.body as Envelope<{ id: string }>).data!.id;
      created.programs.push(programId);

      await request(server)
        .post(`${PREFIX}/admin/programs/${programId}/publish`)
        .set(auth(superAdmin))
        .send({});
    });

    it('creates a draft with a computed progress of zero', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns`)
        .set(auth(superAdmin))
        .send({
          title: 'Spec Campaign',
          slug: 'spec-campaign',
          shortDescription: 'Created by the integration suite.',
          programId,
          categoryId: educationCategoryId,
          fundraisingGoal: 10_000_000,
        });

      expect(response.status).toBe(201);
      const body = (
        response.body as Envelope<{
          id: string;
          status: string;
          progress: { percent: number; remaining: number };
          amountRaised: number;
        }>
      ).data!;

      expect(body.status).toBe('draft');
      expect(body.amountRaised).toBe(0);
      expect(body.progress.percent).toBe(0);
      expect(body.progress.remaining).toBe(10_000_000);

      campaignId = body.id;
      created.campaigns.push(campaignId);
    });

    it('allows a draft with no goal — a draft is allowed to be incomplete', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns`)
        .set(auth(superAdmin))
        .send({ title: 'Spec Goalless', slug: 'spec-goalless' });

      expect(response.status).toBe(201);
      created.campaigns.push((response.body as Envelope<{ id: string }>).data!.id);
    });

    it('hides the draft from the public API', async () => {
      await request(server).get(`${PREFIX}/campaigns/spec-campaign`).expect(404);
    });

    it.each([
      ['activate', 'draft → active skips published'],
      ['complete', 'draft → completed skips everything'],
      ['pause', 'a draft has nothing to pause'],
    ])('refuses %s from draft — %s', async (endpoint) => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/${endpoint}`)
        .set(auth(superAdmin))
        .send({ reason: 'Integration suite' });

      expect(response.status).toBe(409);
      expect(errorCode(response.body as Envelope)).toBe('CONFLICT');
    });

    it('walks draft → published → active, and the public sees it', async () => {
      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/publish`)
        .set(auth(superAdmin))
        .send({})
        .expect(200);

      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/activate`)
        .set(auth(superAdmin))
        .send({})
        .expect(200);

      const response = await request(server).get(`${PREFIX}/campaigns/spec-campaign`);
      expect(response.status).toBe(200);

      const body = (
        response.body as Envelope<{
          status: string;
          donation: { state: string };
          progress: { percent: number };
        }>
      ).data!;

      expect(body.status).toBe('active');
      // The API tells the client what the donate control should do, so the
      // page never has to work the lifecycle out for itself.
      expect(body.donation.state).toBe('open');
      expect(body.progress.percent).toBe(0);
    });

    it('requires a reason to pause, and records it', async () => {
      const withoutReason = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/pause`)
        .set(auth(superAdmin))
        .send({});
      expect(withoutReason.status).toBe(422);

      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/pause`)
        .set(auth(superAdmin))
        .send({ reason: 'Operations temporarily paused.' })
        .expect(200);

      const audit = await request(server)
        .get(`${PREFIX}/admin/audit-logs?entityId=${campaignId}&action=campaign.paused`)
        .set(auth(superAdmin));

      const entry = (
        audit.body as Envelope<{
          items: {
            oldValues: { status: string };
            newValues: { status: string };
            reason: string;
            userId: string;
          }[];
        }>
      ).data!.items[0]!;

      expect(entry.oldValues.status).toBe('active');
      expect(entry.newValues.status).toBe('paused');
      expect(entry.reason).toBe('Operations temporarily paused.');
      expect(entry.userId).toBeTruthy();
    });

    it('keeps a paused campaign readable but closed to donations', async () => {
      // It was public a moment ago; pulling the page from under everyone
      // holding the link is worse than showing it with giving stopped.
      const response = await request(server).get(`${PREFIX}/campaigns/spec-campaign`);
      expect(response.status).toBe(200);

      const body = (response.body as Envelope<{ donation: { state: string; reason: string } }>)
        .data!;
      expect(body.donation.state).toBe('paused');
      expect(body.donation.reason).toMatch(/paused/i);
    });

    it('completes, stays readable as history, and refuses to reopen', async () => {
      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/complete`)
        .set(auth(superAdmin))
        .send({ reason: 'Target met and funds disbursed.' })
        .expect(200);

      const response = await request(server).get(`${PREFIX}/campaigns/spec-campaign`);
      expect(response.status).toBe(200);
      expect(
        (response.body as Envelope<{ donation: { state: string } }>).data!.donation.state,
      ).toBe('completed');

      // Reopening would mean taking money for work already reported as done.
      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/activate`)
        .set(auth(superAdmin))
        .send({})
        .expect(409);
    });

    it('archives, and the campaign leaves the public API entirely', async () => {
      await reauth(superAdmin);

      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/archive`)
        .set(auth(superAdmin))
        .send({ reason: 'Integration suite cleanup' })
        .expect(200);

      await request(server).get(`${PREFIX}/campaigns/spec-campaign`).expect(404);

      const listing = await request(server).get(`${PREFIX}/campaigns?status=all&limit=100`);
      const slugs = (listing.body as Envelope<{ items: { slug: string }[] }>).data!.items.map(
        (item) => item.slug,
      );
      expect(slugs).not.toContain('spec-campaign');
    });
  });

  describe('system-controlled fields', () => {
    let campaignId: string;

    beforeAll(async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns`)
        .set(auth(superAdmin))
        .send({ title: 'Spec Money', slug: 'spec-money', fundraisingGoal: 5_000_000 });
      campaignId = (response.body as Envelope<{ id: string }>).data!.id;
      created.campaigns.push(campaignId);
    });

    it('ignores amountRaised, donorCount and beneficiariesReached in a payload', async () => {
      // Decision A6: these are derived counters, moved only inside the
      // transaction that records a captured payment. There is no code path
      // from a request body to them — not one that is checked, one that does
      // not exist.
      await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}`)
        .set(auth(superAdmin))
        .send({
          title: 'Spec Money',
          amountRaised: 99_999_999,
          donorCount: 5_000,
          beneficiariesReached: 1_234,
        })
        .expect(200);

      const after = await request(server)
        .get(`${PREFIX}/admin/campaigns/${campaignId}`)
        .set(auth(superAdmin));

      const body = (
        after.body as Envelope<{
          amountRaised: number;
          donorCount: number;
          beneficiariesReached: number;
        }>
      ).data!;

      expect(body.amountRaised).toBe(0);
      expect(body.donorCount).toBe(0);
      expect(body.beneficiariesReached).toBe(0);
    });

    it('refuses a goal below the amount already raised', async () => {
      // Uses the seeded campaign, which has a real raised figure.
      const seeded = await request(server)
        .get(`${PREFIX}/admin/campaigns?q=school-kits&limit=1`)
        .set(auth(superAdmin));
      const target = (seeded.body as Envelope<{ items: { id: string; amountRaised: number }[] }>)
        .data!.items[0]!;

      const response = await request(server)
        .patch(`${PREFIX}/admin/campaigns/${target.id}`)
        .set(auth(superAdmin))
        .send({ fundraisingGoal: Math.max(1, target.amountRaised - 100) });

      expect(response.status).toBe(422);
    });

    it.each([
      ['a fractional goal', { fundraisingGoal: 1000.5 }],
      ['a negative goal', { fundraisingGoal: -1000 }],
      ['a zero goal', { fundraisingGoal: 0 }],
    ])('rejects %s', async (_label, body) => {
      const response = await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}`)
        .set(auth(superAdmin))
        .send(body);

      expect(response.status).toBe(422);
    });
  });

  describe('the product catalogue', () => {
    let campaignId: string;
    let otherCampaignId: string;
    let productId: string;
    let campaignProductId: string;

    beforeAll(async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns`)
        .set(auth(superAdmin))
        .send({ title: 'Spec Products', slug: 'spec-products', fundraisingGoal: 5_000_000 });
      campaignId = (response.body as Envelope<{ id: string }>).data!.id;
      created.campaigns.push(campaignId);

      const other = await request(server)
        .post(`${PREFIX}/admin/campaigns`)
        .set(auth(superAdmin))
        .send({ title: 'Spec Other', slug: 'spec-other', fundraisingGoal: 1_000_000 });
      otherCampaignId = (other.body as Envelope<{ id: string }>).data!.id;
      created.campaigns.push(otherCampaignId);
    });

    it('creates a catalogue product, unattached to any campaign', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/products`)
        .set(auth(superAdmin))
        .send({
          name: 'Spec Blanket',
          slug: 'spec-blanket',
          description: 'A warm blanket for one family.',
          defaultPrice: 120_000,
          unit: 'blanket',
          // Must not be settable from a payload.
          status: 'archived',
          campaignCount: 99,
        });

      expect(response.status).toBe(201);
      const body = (
        response.body as Envelope<{ id: string; status: string; campaignCount: number }>
      ).data!;

      // Created active whatever the payload said, and offered by nobody —
      // which is the ordinary state for a product added before its campaign.
      expect(body.status).toBe('active');
      expect(body.campaignCount).toBe(0);

      productId = body.id;
    });

    it.each([
      ['a negative price', { name: 'X', description: 'x', defaultPrice: -1 }],
      ['a zero price', { name: 'X', description: 'x', defaultPrice: 0 }],
      ['a fractional price', { name: 'X', description: 'x', defaultPrice: 99.5 }],
      ['a missing description', { name: 'X', defaultPrice: 1000 }],
      ['a blank name', { name: '   ', description: 'x', defaultPrice: 1000 }],
    ])('rejects %s', async (_label, body) => {
      const response = await request(server)
        .post(`${PREFIX}/admin/products`)
        .set(auth(superAdmin))
        .send(body);

      expect(response.status).toBe(422);
    });

    /**
     * Slugs are unique ACROSS THE CATALOGUE now, not per campaign — which is
     * the whole change. Before Phase 5 three campaigns each held their own
     * "school-kit" row with three descriptions of it, drifting apart. One
     * product, one description, offered by many.
     */
    it('refuses a second product at the same URL', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/products`)
        .set(auth(superAdmin))
        .send({ name: 'Spec Blanket', description: 'Duplicate.', defaultPrice: 1000 });

      expect(response.status).toBe(409);
    });

    it('offers the product on a campaign, copying the catalogue price', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/products`)
        .set(auth(superAdmin))
        .send({
          productId,
          targetQuantity: 200,
          // Must not be settable here.
          providedQuantity: 150,
        });

      expect(response.status).toBe(201);
      const body = (
        response.body as Envelope<{
          id: string;
          price: number;
          defaultPrice: number;
          providedQuantity: number;
          progress: { percent: number; target: number };
        }>
      ).data!;

      expect(body.price).toBe(120_000);
      expect(body.providedQuantity).toBe(0);
      expect(body.progress.percent).toBe(0);
      expect(body.progress.target).toBe(200);

      campaignProductId = body.id;
    });

    it('refuses the same product twice on one campaign', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/products`)
        .set(auth(superAdmin))
        .send({ productId });

      expect(response.status).toBe(409);
    });

    it('hides products the campaign already offers from the picker', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/products?notInCampaignId=${campaignId}&limit=100`)
        .set(auth(superAdmin));

      const ids = (response.body as Envelope<{ items: { id: string }[] }>).data!.items.map(
        (item) => item.id,
      );

      // Not merely refused on submit — absent from what can be chosen.
      expect(ids).not.toContain(productId);
    });

    /**
     * THE CENTRAL INVARIANT OF PHASE 5.
     *
     * One product, two campaigns, two prices — and a change to the catalogue
     * default moves neither of them. A "keep prices in sync" refactor would
     * break this, silently and in production, which is why it is asserted end
     * to end rather than only in a unit test.
     */
    it('keeps each campaign’s price independent of the catalogue and of each other', async () => {
      await request(server)
        .post(`${PREFIX}/admin/campaigns/${otherCampaignId}/products`)
        .set(auth(superAdmin))
        .send({ productId, price: 150_000 })
        .expect(201);

      await request(server)
        .patch(`${PREFIX}/admin/products/${productId}`)
        .set(auth(superAdmin))
        .send({ defaultPrice: 999_00 })
        .expect(200);

      const detail = await request(server)
        .get(`${PREFIX}/admin/products/${productId}`)
        .set(auth(superAdmin));

      const body = (
        detail.body as Envelope<{ defaultPrice: number; campaigns: { price: number }[] }>
      ).data!;

      expect(body.defaultPrice).toBe(999_00);
      expect(body.campaigns.map((entry) => entry.price).sort((a, b) => a - b)).toEqual([
        120_000, 150_000,
      ]);
    });

    it('records that a default-price change touches neither campaigns nor history', async () => {
      const audit = await request(server)
        .get(`${PREFIX}/admin/audit-logs?action=product.default_price_changed&limit=1`)
        .set(auth(superAdmin));

      const row = (
        audit.body as Envelope<{
          items: { severity: string; newValues: Record<string, unknown> }[];
        }>
      ).data!.items[0]!;

      expect(row.severity).toBe('warning');
      expect(row.newValues).toMatchObject({
        affectsExistingCampaignPrices: false,
        affectsHistoricalDonations: false,
      });
    });

    it('ignores providedQuantity on an ordinary edit', async () => {
      await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}`)
        .set(auth(superAdmin))
        .send({ price: 130_000, providedQuantity: 9999 })
        .expect(200);

      const products = await request(server)
        .get(`${PREFIX}/admin/campaigns/${campaignId}/products`)
        .set(auth(superAdmin));

      const product = (
        products.body as Envelope<{
          items: { id: string; price: number; providedQuantity: number }[];
        }>
      ).data!.items.find((item) => item.id === campaignProductId)!;

      expect(product.price).toBe(130_000);
      expect(product.providedQuantity).toBe(0);
    });

    it('refuses a product that is not in the catalogue', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/products`)
        .set(auth(superAdmin))
        .send({ productId: '00000000-0000-4000-8000-000000000000' });

      expect(response.status).toBe(422);
    });

    it('requires re-authentication to correct a provided quantity by hand', async () => {
      const denied = await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}/provided`)
        .set(auth(campaignManager))
        .send({ providedQuantity: 12, reason: 'Offline distribution reconciled' });

      // The campaign manager does not hold the sensitive permission at all.
      expect(denied.status).toBe(403);

      /**
       * A FRESH session, deliberately.
       *
       * Re-authentication opens a five-minute window on the session that did
       * it, and earlier tests in this file have already opened one on
       * `superAdmin`. Asserting against that session would be asserting that
       * the window works, not that it is required — so this signs in again to
       * get a session that has never re-authenticated.
       */
      const freshLogin = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() });
      const freshToken = (freshLogin.body as Envelope<{ accessToken: string }>).data!.accessToken;

      const beforeReauth = await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}/provided`)
        .set(auth(freshToken))
        .send({ providedQuantity: 12, reason: 'Offline distribution reconciled' });
      expect(errorCode(beforeReauth.body as Envelope)).toBe('REAUTH_REQUIRED');

      await reauth(superAdmin);

      const response = await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}/provided`)
        .set(auth(superAdmin))
        .send({ providedQuantity: 12, reason: 'Offline distribution reconciled' });

      expect(response.status).toBe(200);

      // Recorded as critical — it is a hand edit to a number meant to follow
      // from money received.
      const audit = await request(server)
        .get(`${PREFIX}/admin/audit-logs?action=campaign_product.adjust_provided&limit=1`)
        .set(auth(superAdmin));
      expect(
        (audit.body as Envelope<{ items: { severity: string }[] }>).data!.items[0]?.severity,
      ).toBe('critical');
    });

    it('requires a reason for a provided-quantity correction', async () => {
      await reauth(superAdmin);
      const response = await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}/provided`)
        .set(auth(superAdmin))
        .send({ providedQuantity: 5 });

      expect(response.status).toBe(422);
    });

    it('refuses to remove an offering people have already funded', async () => {
      // 12 were provided by the correction above.
      const response = await request(server)
        .delete(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}`)
        .set(auth(superAdmin))
        .send({ reason: 'Changed our minds' });

      expect(response.status).toBe(409);
    });

    it('shows and hides a product on a campaign, refusing a no-op', async () => {
      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}/active`)
        .set(auth(superAdmin))
        .send({ isActive: false, reason: 'Out of stock' })
        .expect(200);

      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}/active`)
        .set(auth(superAdmin))
        .send({ isActive: false })
        .expect(409);

      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/products/${campaignProductId}/active`)
        .set(auth(superAdmin))
        .send({ isActive: true })
        .expect(200);
    });

    it('refuses to archive a product live campaigns still offer', async () => {
      await reauth(superAdmin);
      const response = await request(server)
        .post(`${PREFIX}/admin/products/${productId}/archive`)
        .set(auth(superAdmin))
        .send({ reason: 'Spec cleanup' });

      expect(response.status).toBe(409);
      expect((response.body as Envelope).error?.message).toMatch(/Spec Products|Spec Other/);
    });

    /**
     * There is no delete, at any reference count. A product cited by a
     * donation must still resolve, or that donation's receipt has a hole in
     * it — so the route exists and always refuses, naming the alternative.
     */
    it('never deletes a product', async () => {
      await reauth(superAdmin);
      const response = await request(server)
        .delete(`${PREFIX}/admin/products/${productId}`)
        .set(auth(superAdmin));

      expect(response.status).toBe(409);
      expect((response.body as Envelope).error?.message).toMatch(/Archive it instead/);
    });

    it('archives once no live campaign offers it, and then refuses to offer it', async () => {
      // Hide it on both campaigns rather than removing — one of them is funded.
      for (const campaign of [campaignId, otherCampaignId]) {
        const list = await request(server)
          .get(`${PREFIX}/admin/campaigns/${campaign}/products`)
          .set(auth(superAdmin));
        const row = (
          list.body as Envelope<{ items: { id: string; productId: string }[] }>
        ).data!.items.find((item) => item.productId === productId);
        if (!row) continue;

        await request(server)
          .post(`${PREFIX}/admin/campaigns/${campaign}/products/${row.id}/active`)
          .set(auth(superAdmin))
          .send({ isActive: false, reason: 'Spec cleanup' });
      }

      await reauth(superAdmin);
      const archived = await request(server)
        .post(`${PREFIX}/admin/products/${productId}/archive`)
        .set(auth(superAdmin))
        .send({ reason: 'Spec cleanup' });

      expect(archived.status).toBe(200);
      expect((archived.body as Envelope<{ status: string }>).data!.status).toBe('archived');

      const readded = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/products`)
        .set(auth(superAdmin))
        .send({ productId });
      expect(readded.status).toBe(422);
    });

    it('excludes archived products from the default listing', async () => {
      const listed = await request(server)
        .get(`${PREFIX}/admin/products?limit=100`)
        .set(auth(superAdmin));
      expect(
        (listed.body as Envelope<{ items: { id: string }[] }>).data!.items.map((i) => i.id),
      ).not.toContain(productId);

      const explicit = await request(server)
        .get(`${PREFIX}/admin/products?status=archived&limit=100`)
        .set(auth(superAdmin));
      expect(
        (explicit.body as Envelope<{ items: { id: string }[] }>).data!.items.map((i) => i.id),
      ).toContain(productId);
    });

    it('hides a campaign’s product from the public page once the catalogue withdraws it', async () => {
      // The catalogue answers "do we do this at all". Withdrawing centrally
      // must take it off every campaign without anyone visiting each one.
      const publicView = await request(server).get(`${PREFIX}/campaigns/spec-products/products`);
      const ids = (publicView.body as Envelope<{ productId: string }[]>).data ?? [];
      expect(ids.map((item) => item.productId)).not.toContain(productId);
    });
  });

  describe('FAQs, gallery and updates', () => {
    let campaignId: string;
    let slug: string;

    beforeAll(async () => {
      const seeded = await request(server)
        .get(`${PREFIX}/admin/campaigns?q=school-kits&limit=1`)
        .set(auth(superAdmin));
      const target = (seeded.body as Envelope<{ items: { id: string; slug: string }[] }>).data!
        .items[0]!;
      campaignId = target.id;
      slug = target.slug;
    });

    it('withholds unpublished FAQs from the public endpoint', async () => {
      const adminList = await request(server)
        .get(`${PREFIX}/admin/campaigns/${campaignId}/faqs`)
        .set(auth(superAdmin));
      const publicList = await request(server).get(`${PREFIX}/campaigns/${slug}/faqs`);

      const all = (adminList.body as Envelope<{ items: { isPublished: boolean }[] }>).data!.items;
      const published = (publicList.body as Envelope<{ items: unknown[] }>).data!.items;

      expect(all.some((faq) => !faq.isPublished)).toBe(true);
      expect(published.length).toBe(all.filter((faq) => faq.isPublished).length);
      expect(published.length).toBeLessThan(all.length);
    });

    it('withholds private gallery images from the public endpoint', async () => {
      const adminList = await request(server)
        .get(`${PREFIX}/admin/campaigns/${campaignId}/gallery`)
        .set(auth(superAdmin));
      const publicList = await request(server).get(`${PREFIX}/campaigns/${slug}/gallery`);

      const all = (adminList.body as Envelope<{ items: { visibility: string }[] }>).data!.items;
      const visible = (publicList.body as Envelope<{ items: unknown[] }>).data!.items;

      expect(all.some((item) => item.visibility === 'private')).toBe(true);
      expect(visible.length).toBe(all.filter((item) => item.visibility === 'public').length);
    });

    it('refuses to publish an update reporting a figure with no stated basis', async () => {
      // Decision A14 at its narrowest: a number on a public page needs to say
      // where it came from.
      const draft = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/updates`)
        .set(auth(superAdmin))
        .send({
          title: 'Spec update',
          description: 'Created by the integration suite.',
          impactDate: '2026-09-01',
          metricValue: 500,
          metricUnit: 'kits',
        });

      const updateId = (draft.body as Envelope<{ id: string }>).data!.id;

      const refused = await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/updates/${updateId}/publish`)
        .set(auth(superAdmin))
        .send({ published: true });
      expect(refused.status).toBe(422);

      await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/updates/${updateId}`)
        .set(auth(superAdmin))
        .send({ verificationMethod: 'Counted from signed distribution registers.' })
        .expect(200);

      await request(server)
        .post(`${PREFIX}/admin/campaigns/${campaignId}/updates/${updateId}/publish`)
        .set(auth(superAdmin))
        .send({ published: true })
        .expect(200);
    });
  });

  describe('authorization', () => {
    it.each([
      ['GET', '/admin/programs'],
      ['GET', '/admin/campaigns'],
      ['GET', '/admin/categories'],
    ])('refuses %s %s without a token', async (method, path) => {
      const response = await request(server)[method.toLowerCase() as 'get'](`${PREFIX}${path}`);
      expect(response.status).toBe(401);
    });

    /*
      ══════════════════════════════════════════════════════════════════════
      REMOVED IN PHASE 8 — there is no Content Manager.

      It walked every programme and campaign write endpoint and asserted a 403
      from a content role. With one staff role, every one of those writes now
      succeeds for every staff member.

      The permission strings are untouched and are still what the guard checks;
      what is gone is the role that held some of them and not others.
      Reintroducing a narrower role is a seed change, and this test returns
      with it. The guard's own denial logic is covered with synthetic actors in
      `src/common/guards/auth.guard.spec.ts`.
      ══════════════════════════════════════════════════════════════════════
    */

    it('lets a Campaign Manager create but not archive', async () => {
      const created2 = await request(server)
        .post(`${PREFIX}/admin/campaigns`)
        .set(auth(campaignManager))
        .send({ title: 'Spec By Manager', slug: 'spec-by-manager', fundraisingGoal: 100_000 });
      expect(created2.status).toBe(201);
      created.campaigns.push((created2.body as Envelope<{ id: string }>).data!.id);

      // Archiving removes something from public view, and is reserved.
      const archive = await request(server)
        .post(
          `${PREFIX}/admin/campaigns/${(created2.body as Envelope<{ id: string }>).data!.id}/archive`,
        )
        .set(auth(campaignManager))
        .send({ reason: 'Trying' });
      expect(archive.status).toBe(403);
    });

    it('refuses to act on another campaign’s child by passing a different id', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/campaigns/00000000-0000-4000-8000-000000000000/products`)
        .set(auth(superAdmin));
      expect(response.status).toBe(404);
    });
  });
});
