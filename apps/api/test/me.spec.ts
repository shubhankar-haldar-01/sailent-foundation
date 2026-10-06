import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import { AdminDonorsService } from '../src/modules/donors/admin-donors.service.js';
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
 * The donor account, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS SUITE IS MOSTLY ABOUT ONE QUESTION: CAN A DONOR REACH ANOTHER DONOR'S
 * MONEY?
 *
 * Two donors are created, each with their own donation, and then every
 * donor-facing route is pointed at the other one's data. There is no test here
 * that merely checks a donor can read their own history; each of those is
 * paired with the same request made by the wrong donor, because the pair is
 * what proves the filter is doing the work rather than the fixture.
 *
 * The session is obtained through the REAL sign-in endpoint. The one thing
 * these tests do by hand is write the `otp_codes` row — the code is stored as a
 * SHA-256 hash and there is no way to read one back, which is the point of
 * hashing it. Everything downstream of that row is production code.
 * ══════════════════════════════════════════════════════════════════════════
 */

interface Fixture {
  donorId: string;
  email: string;
  phone: string;
  donationId: string;
  reference: string;
  token: string;
}

/**
 * Donors sign in by EMAIL, so the fixtures are addressed by email. The phone
 * numbers remain because a donor record still carries one — it is contact
 * detail now rather than identity.
 */
const ALICE = { email: 'alice-me-spec@example.test', phone: '9811177001' };
const BOB = { email: 'bob-me-spec@example.test', phone: '9811177002' };

describe('Donor account (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let alice: Fixture;
  let bob: Fixture;
  let campaignId: string;
  let otherCampaignId: string;
  let staffToken: string;
  let financeToken: string;

  const db = () =>
    app.get<{ db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> } }>(
      DATABASE,
    ).db;

  /**
   * Create a donor with one successful donation, then sign in as them.
   *
   * The product line cites a REAL `campaign_products` row, because
   * `donation_items_type_consistent` requires a product line to name both the
   * junction row and the product. That constraint is doing its job here: a
   * fixture that could skip it would be testing a row shape the application can
   * never produce.
   */
  async function makeDonor(
    who: { email: string; phone: string },
    name: string,
    target: { campaignId: string; campaignProductId: string; productId: string },
  ): Promise<Fixture> {
    const suffix = who.phone.slice(-5);
    const donor = await db().execute(sql`
      INSERT INTO donors (donor_code, first_name, last_name, email, phone, email_opt_in)
      VALUES (${`DNR-TEST-${suffix}`}, ${name}, 'Tester', ${who.email}, ${who.phone}, true)
      RETURNING id
    `);
    const donorId = donor.rows![0]!.id as string;

    const reference = `DON-TEST-${suffix}`;
    const donation = await db().execute(sql`
      INSERT INTO donations (reference, donor_id, campaign_id, amount, status, donation_type, completed_at)
      VALUES (${reference}, ${donorId}::uuid, ${target.campaignId}::uuid, 250000, 'successful', 'hybrid', now())
      RETURNING id
    `);
    const donationId = donation.rows![0]!.id as string;

    await db().execute(sql`
      INSERT INTO donation_items
        (donation_id, campaign_product_id, product_id, item_type, item_name, quantity, unit_price, total_price)
      VALUES (${donationId}::uuid, ${target.campaignProductId}::uuid, ${target.productId}::uuid,
              'product', ${`${name} School Kit`}, 2, 100000, 200000)
    `);
    await db().execute(sql`
      INSERT INTO donation_items (donation_id, item_type, item_name, quantity, unit_price, total_price)
      VALUES (${donationId}::uuid, 'custom', 'Additional amount', 1, 50000, 50000)
    `);

    // A receipt, so the receipt route has something to be denied to the wrong donor.
    const receipt = await db().execute(sql`
      INSERT INTO receipts (receipt_number, financial_year, sequence, donation_id, donor_id,
                            donor_name, amount, line_items)
      VALUES (${`SFL-TEST-${suffix}`}, 2026, ${Number(suffix)}, ${donationId}::uuid, ${donorId}::uuid,
              ${name}, 250000, '[]'::jsonb)
      RETURNING id
    `);
    await db().execute(sql`
      UPDATE donations SET receipt_id = ${receipt.rows![0]!.id as string}::uuid WHERE id = ${donationId}::uuid
    `);

    return {
      donorId,
      email: who.email,
      phone: who.phone,
      donationId,
      reference,
      token: await signIn(who.email),
    };
  }

  /**
   * Sign in for real.
   *
   * The `otp_codes` row is written directly because the stored value is a hash
   * and cannot be read back — that is the only step that is not production
   * code. `/auth/donor/otp/verify` and everything after it is.
   */
  async function signIn(email: string): Promise<string> {
    const code = '424242';
    // The identifier is the NORMALISED address — lower-cased and trimmed, the
    // same way the service and `donors_email_lower_unique` normalise it.
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
    return (response.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const catalogue = await db().execute(sql`
      SELECT DISTINCT ON (cp.campaign_id)
             cp.campaign_id, cp.id AS campaign_product_id, cp.product_id
        FROM campaign_products cp
       ORDER BY cp.campaign_id, cp.sort_order
       LIMIT 2
    `);
    interface CatalogueRow {
      campaign_id: string;
      campaign_product_id: string;
      product_id: string;
    }
    const [first, second] = catalogue.rows as unknown as CatalogueRow[];

    const target = (row: CatalogueRow) => ({
      campaignId: row.campaign_id,
      campaignProductId: row.campaign_product_id,
      productId: row.product_id,
    });

    campaignId = first!.campaign_id;
    otherCampaignId = second!.campaign_id;

    alice = await makeDonor(ALICE, 'Alice', target(first!));
    bob = await makeDonor(BOB, 'Bob', target(second!));

    const staff = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.staff, password: TEST_PASSWORD, totpCode: devTotpCode() });
    staffToken = (staff.body as Envelope<{ accessToken: string }>).data!.accessToken;

    const finance = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD, totpCode: devTotpCode() });
    financeToken = (finance.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    const emails = sql`(${ALICE.email}, ${BOB.email})`;
    const ours = sql`(SELECT id FROM donors WHERE email IN ${emails})`;
    await db().execute(sql`DELETE FROM saved_campaigns WHERE donor_id IN ${ours}`);
    await db().execute(sql`UPDATE donations SET receipt_id = NULL WHERE donor_id IN ${ours}`);
    await db().execute(sql`DELETE FROM receipts WHERE donor_id IN ${ours}`);
    await db().execute(
      sql`DELETE FROM donation_items WHERE donation_id IN (SELECT id FROM donations WHERE donor_id IN ${ours})`,
    );
    await db().execute(sql`DELETE FROM donations WHERE donor_id IN ${ours}`);
    await db().execute(sql`DELETE FROM audit_logs WHERE user_id IN ${ours}`);
    await db().execute(sql`DELETE FROM sessions WHERE donor_id IN ${ours}`);
    await db().execute(sql`DELETE FROM donors WHERE email IN ${emails}`);
    await db().execute(sql`DELETE FROM otp_codes WHERE identifier IN ${emails}`);
    await app.close();
  });

  // =========================================================================
  describe('who may reach these routes at all', () => {
    it('refuses an unauthenticated request', async () => {
      const response = await request(server).get(`${PREFIX}/me`);
      expect(response.status).toBe(401);
    });

    /**
     * A staff token must not work here, and the reason is worth stating: on a
     * donor token `actor.id` is a `donors.id`, on a staff token it is a
     * `users.id`. If staff tokens were accepted, every query in this module
     * would be scoped to a user id sitting in a donor column, and the only
     * thing stopping it returning somebody's data is that the two id spaces do
     * not happen to collide. That is luck, not a boundary.
     *
     * 401 RATHER THAN 403, AND THAT IS THE STRONGER ANSWER. The signing key is
     * derived per audience (`sha256(base:audience)`), so a staff token does not
     * fail an authorization check here — it fails signature verification. It is
     * not a valid token on this route at all, which is a boundary no future
     * change to a permission list can weaken.
     */
    it('refuses a staff token, which cannot even verify on a donor route', async () => {
      const response = await request(server).get(`${PREFIX}/me`).set(auth(staffToken));
      expect(response.status).toBe(401);
    });

    it('accepts a donor token', async () => {
      const response = await request(server).get(`${PREFIX}/me`).set(auth(alice.token));
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ email: string }>).data!.email).toBe(ALICE.email);
    });
  });

  // =========================================================================
  describe('one donor cannot reach another donor', () => {
    it('lists only its own donations', async () => {
      const response = await request(server)
        .get(`${PREFIX}/me/donations`)
        .set(auth(alice.token))
        .expect(200);

      const items = (response.body as Envelope<{ items: { id: string }[] }>).data!.items;
      expect(items.map((item) => item.id)).toContain(alice.donationId);
      expect(items.map((item) => item.id)).not.toContain(bob.donationId);
    });

    it('returns 404 — not 403 — for another donor’s donation', async () => {
      // 403 would confirm the id exists, which is the thing an id-guessing
      // attacker is actually after.
      const response = await request(server)
        .get(`${PREFIX}/me/donations/${bob.donationId}`)
        .set(auth(alice.token));

      expect(response.status).toBe(404);
    });

    it('returns 404 for another donor’s receipt', async () => {
      const response = await request(server)
        .get(`${PREFIX}/me/donations/${bob.donationId}/receipt`)
        .set(auth(alice.token));

      expect(response.status).toBe(404);
    });

    it('gives each donor their own receipt', async () => {
      const response = await request(server)
        .get(`${PREFIX}/me/donations/${alice.donationId}/receipt`)
        .set(auth(alice.token))
        .expect(200);

      expect((response.body as Envelope<{ receiptNumber: string }>).data!.receiptNumber).toBe(
        `SFL-TEST-${ALICE.phone.slice(-5)}`,
      );
    });

    it('cannot be widened by passing a donor id in the query string', async () => {
      // There is no `donorId` parameter. Sending one must not silently become a
      // filter, and must not be accepted as an unknown key either.
      const response = await request(server)
        .get(`${PREFIX}/me/donations?donorId=${bob.donorId}`)
        .set(auth(alice.token))
        .expect(200);

      const items = (response.body as Envelope<{ items: { id: string }[] }>).data!.items;
      expect(items.map((item) => item.id)).not.toContain(bob.donationId);
      expect(items.map((item) => item.id)).toContain(alice.donationId);
    });
  });

  // =========================================================================
  describe('what a donor may change about themselves', () => {
    it('updates the fields that are theirs', async () => {
      const response = await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(alice.token))
        .send({ firstName: 'Alicia', city: 'Ranchi', taxIdType: 'pan', taxIdNumber: 'abcde1234f' })
        .expect(200);

      const body = (
        response.body as Envelope<{
          firstName: string;
          city: string;
          hasTaxId: boolean;
          taxIdNumberMasked: string;
        }>
      ).data!;
      expect(body.firstName).toBe('Alicia');
      expect(body.city).toBe('Ranchi');
      /*
        Normalised upper-case, because the Income Tax Department's format is —
        and since Phase 12 shown back MASKED: the full number is stored
        encrypted and is not returned to the donor's browser. The admin test
        below proves the stored number is the upper-cased one.
      */
      expect(body.hasTaxId).toBe(true);
      expect(body.taxIdNumberMasked).toBe('XXXXXX234F');
      expect(body).not.toHaveProperty('taxIdNumber');
    });

    /**
     * A number with no type cannot go on a Form 10BD export, and the database
     * says so with `donors_tax_id_type_required`. Without the matching rule in
     * the schema the constraint still catches it — as a 500 from Postgres,
     * several layers below anything that could explain it to the donor.
     */
    it('refuses a tax id with no type, in words rather than as a 500', async () => {
      const response = await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(alice.token))
        .send({ taxIdNumber: 'ZZZZZ9999Z' });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).toContain('taxIdType');
    });

    /**
     * The important half. Every one of these is server-controlled, and the
     * schema is `.strict()` so an attempt is REJECTED rather than ignored —
     * a silently-dropped field passes this test for the wrong reason and then
     * stops being dropped the day somebody spreads the input into the update.
     */
    it.each([
      ['totalDonated', { totalDonated: 99_999_900 }],
      ['donationCount', { donationCount: 500 }],
      ['donorCode', { donorCode: 'DNR-2026-00001' }],
      ['phone', { phone: BOB.phone }],
      ['internalNotes', { internalNotes: 'promote me' }],
      ['id', { id: '00000000-0000-0000-0000-000000000000' }],
    ])('refuses to let a donor set %s', async (_label, payload) => {
      const response = await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(alice.token))
        .send(payload);

      expect(response.status).toBe(422);
      expect(errorCode(response.body as Envelope)).toBe('VALIDATION_FAILED');
    });

    it('leaves the lifetime totals exactly where capture left them', async () => {
      const before = await db().execute(
        sql`SELECT total_donated, donation_count FROM donors WHERE id = ${alice.donorId}::uuid`,
      );
      await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(alice.token))
        .send({ lastName: 'Unchanged' })
        .expect(200);

      const after = await db().execute(
        sql`SELECT total_donated, donation_count FROM donors WHERE id = ${alice.donorId}::uuid`,
      );
      expect(after.rows![0]).toEqual(before.rows![0]);
    });

    it('records a profile change in the audit log without copying the tax id into it', async () => {
      await request(server)
        .patch(`${PREFIX}/me`)
        .set(auth(alice.token))
        .send({ city: 'Dhanbad' })
        .expect(200);

      const rows = await db().execute(sql`
        SELECT action, actor_type, new_values::text AS new_values
          FROM audit_logs
         WHERE user_id = ${alice.donorId}::uuid AND action = 'donor.profile_updated'
         ORDER BY created_at DESC LIMIT 1
      `);

      const row = rows.rows![0]!;
      expect(row.action).toBe('donor.profile_updated');
      expect(row.actor_type).toBe('donor');
      // The flag is there; the number is not.
      expect(row.new_values as string).toContain('taxIdOnFile');
      expect(row.new_values as string).not.toContain('ABCDE1234F');
    });
  });

  // =========================================================================
  describe('settings', () => {
    it('saves notification preferences and audits the consent change', async () => {
      const response = await request(server)
        .patch(`${PREFIX}/me/settings`)
        .set(auth(alice.token))
        .send({ notifyNewsletter: true, emailOptIn: false })
        .expect(200);

      const body = (response.body as Envelope<{ notifyNewsletter: boolean; emailOptIn: boolean }>)
        .data!;
      expect(body.notifyNewsletter).toBe(true);
      expect(body.emailOptIn).toBe(false);

      const rows = await db().execute(sql`
        SELECT 1 FROM audit_logs
         WHERE user_id = ${alice.donorId}::uuid AND action = 'donor.settings_updated'
      `);
      expect(rows.rows!.length).toBeGreaterThan(0);
    });

    it('refuses an unknown preference rather than ignoring it', async () => {
      const response = await request(server)
        .patch(`${PREFIX}/me/settings`)
        .set(auth(alice.token))
        .send({ notifyEverything: true });

      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  describe('saved campaigns', () => {
    it('saves, lists, and is idempotent about saving twice', async () => {
      await request(server)
        .post(`${PREFIX}/me/saved-campaigns`)
        .set(auth(alice.token))
        .send({ campaignId })
        .expect(201);

      // The donor asked for it to be saved and it is saved. Saying 409 to that
      // would be technically defensible and useless to the person tapping it.
      await request(server)
        .post(`${PREFIX}/me/saved-campaigns`)
        .set(auth(alice.token))
        .send({ campaignId })
        .expect(201);

      const listed = await request(server)
        .get(`${PREFIX}/me/saved-campaigns`)
        .set(auth(alice.token))
        .expect(200);

      const items = (listed.body as Envelope<{ items: { campaignId: string }[] }>).data!.items;
      expect(items.filter((item) => item.campaignId === campaignId)).toHaveLength(1);
    });

    it('keeps one donor’s saves out of another’s list', async () => {
      const listed = await request(server)
        .get(`${PREFIX}/me/saved-campaigns`)
        .set(auth(bob.token))
        .expect(200);

      const items = (listed.body as Envelope<{ items: { campaignId: string }[] }>).data!.items;
      expect(items).toHaveLength(0);
    });

    it('removes a save, and is idempotent about removing it twice', async () => {
      await request(server)
        .delete(`${PREFIX}/me/saved-campaigns/${campaignId}`)
        .set(auth(alice.token))
        .expect(200);
      await request(server)
        .delete(`${PREFIX}/me/saved-campaigns/${campaignId}`)
        .set(auth(alice.token))
        .expect(200);

      const listed = await request(server)
        .get(`${PREFIX}/me/saved-campaigns`)
        .set(auth(alice.token))
        .expect(200);
      expect((listed.body as Envelope<{ items: unknown[] }>).data!.items).toHaveLength(0);
    });

    it('refuses to save a campaign that does not exist', async () => {
      const response = await request(server)
        .post(`${PREFIX}/me/saved-campaigns`)
        .set(auth(alice.token))
        .send({ campaignId: '00000000-0000-0000-0000-000000000000' });

      expect(response.status).toBe(404);
    });

    it('cannot delete another donor’s save', async () => {
      await request(server)
        .post(`${PREFIX}/me/saved-campaigns`)
        .set(auth(bob.token))
        .send({ campaignId: otherCampaignId })
        .expect(201);

      // Alice asking for it to go is a no-op scoped to Alice, not a deletion.
      await request(server)
        .delete(`${PREFIX}/me/saved-campaigns/${otherCampaignId}`)
        .set(auth(alice.token))
        .expect(200);

      const listed = await request(server)
        .get(`${PREFIX}/me/saved-campaigns`)
        .set(auth(bob.token))
        .expect(200);
      expect((listed.body as Envelope<{ items: unknown[] }>).data!.items).toHaveLength(1);
    });
  });

  // =========================================================================
  describe('impact', () => {
    /**
     * Decision A14. The numbers are summed from this donor's own confirmed
     * lines: two kits bought is "2", not a share of the campaign's headline
     * figure and not a multiplier applied to the amount.
     */
    it('counts only what this donor actually funded', async () => {
      const response = await request(server)
        .get(`${PREFIX}/me/impact`)
        .set(auth(alice.token))
        .expect(200);

      const body = (
        response.body as Envelope<{
          totalGiven: number;
          donationCount: number;
          campaignsSupported: number;
          itemsProvided: { itemName: string; quantity: number }[];
        }>
      ).data!;

      expect(body.totalGiven).toBe(250000);
      expect(body.donationCount).toBe(1);
      expect(body.campaignsSupported).toBe(1);

      // The custom line is NOT counted as an item — a custom amount does not buy
      // a countable thing, and counting it would be inventing the number.
      expect(body.itemsProvided).toHaveLength(1);
      expect(body.itemsProvided[0]!.quantity).toBe(2);
    });

    it('lists campaigns this donor funded, with their own contribution', async () => {
      const response = await request(server)
        .get(`${PREFIX}/me/campaigns`)
        .set(auth(alice.token))
        .expect(200);

      const items = (
        response.body as Envelope<{ items: { campaignId: string; contributed: string }[] }>
      ).data!.items;

      expect(items).toHaveLength(1);
      expect(items[0]!.campaignId).toBe(campaignId);
      expect(Number(items[0]!.contributed)).toBe(250000);
    });
  });

  // =========================================================================
  describe('staff reading donors', () => {
    /** `donor.update` is `@Sensitive()`, so it needs a recent re-authentication. */
    async function reauth(token: string): Promise<void> {
      await request(server)
        .post(`${PREFIX}/auth/reauth`)
        .set(auth(token))
        .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
    }

    /*
      ══════════════════════════════════════════════════════════════════════
      "REFUSES A STAFF MEMBER WHO DOES NOT HOLD donor.read" WAS REMOVED IN PHASE 8.

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

    it('lets Finance find a donor by name', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/donors?q=Alicia`)
        .set(auth(financeToken))
        .expect(200);

      const items = (response.body as Envelope<{ items: { id: string }[] }>).data!.items;
      expect(items.map((item) => item.id)).toContain(alice.donorId);
    });

    /**
     * The list never selects a PAN at any permission level, so it reports only
     * WHETHER one is on file. A search that matched on the number would let
     * somebody confirm a value they already suspected by reading the result
     * count — a disclosure however the row is filtered afterwards.
     */
    it('reports only whether a tax id exists, never the number', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/donors?q=Alicia`)
        .set(auth(financeToken))
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('ABCDE1234F');
      const items = (response.body as Envelope<{ items: { hasTaxId: boolean }[] }>).data!.items;
      expect(items[0]!.hasTaxId).toBe(true);
    });

    /**
     * The sensitive split is enforced in the SELECT, not in a serialiser. Every
     * seeded role that holds `donor.read` also holds `donor.read_sensitive`, so
     * this exercises the service directly — which is the layer that decides,
     * and the only way to prove the column is never fetched rather than fetched
     * and dropped.
     */
    it('never fetches the PAN for a caller without donor.read_sensitive', async () => {
      const service = app.get(AdminDonorsService);

      const withhold = await service.getById(alice.donorId, { includeSensitive: false });
      expect(withhold).not.toHaveProperty('taxIdNumber');
      expect(withhold).not.toHaveProperty('addressLine1');
      expect(withhold).not.toHaveProperty('internalNotes');
      // Still answers the operational question.
      expect(withhold.hasTaxId).toBe(true);

      const allow = await service.getById(alice.donorId, { includeSensitive: true });
      expect(allow).toHaveProperty('taxIdNumber', 'ABCDE1234F');
    });

    it('re-derives the lifetime totals so a drift from the cache is visible', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/donors/${alice.donorId}`)
        .set(auth(financeToken))
        .expect(200);

      const body = (
        response.body as Envelope<{
          totalDonated: string;
          recomputed: { totalDonated: number; donationCount: number };
        }>
      ).data!;

      // The fixture wrote a donation but never ran capture, so the CACHED total
      // is zero while the recomputed one is real. That divergence is exactly
      // what this field exists to surface.
      expect(body.recomputed.totalDonated).toBe(250000);
      expect(body.recomputed.donationCount).toBe(1);
    });

    it('refuses a correction with no reason', async () => {
      await reauth(financeToken);
      const response = await request(server)
        .patch(`${PREFIX}/admin/donors/${alice.donorId}`)
        .set(auth(financeToken))
        .send({ city: 'Bokaro' });

      expect(response.status).toBe(422);
    });

    it.each([
      ['totalDonated', { totalDonated: 1_00_00_000 }],
      ['donationCount', { donationCount: 99 }],
      ['donorCode', { donorCode: 'DNR-FAKE' }],
      ['phone', { phone: '9800000000' }],
    ])('refuses to let staff rewrite %s', async (_label, payload) => {
      await reauth(financeToken);
      const response = await request(server)
        .patch(`${PREFIX}/admin/donors/${alice.donorId}`)
        .set(auth(financeToken))
        .send({ ...payload, reason: 'Trying to rewrite history' });

      expect(response.status).toBe(422);
      expect(errorCode(response.body as Envelope)).toBe('VALIDATION_FAILED');
    });

    it('records a correction with its reason, and without the tax id', async () => {
      await reauth(financeToken);
      await request(server)
        .patch(`${PREFIX}/admin/donors/${alice.donorId}`)
        .set(auth(financeToken))
        .send({ city: 'Bokaro', reason: 'Donor called to correct a typo in their city' })
        .expect(200);

      const rows = await db().execute(sql`
        SELECT reason, new_values::text AS new_values, severity
          FROM audit_logs
         WHERE entity_id = ${alice.donorId}::uuid AND action = 'donor.updated'
         ORDER BY created_at DESC LIMIT 1
      `);

      const row = rows.rows![0]!;
      expect(row.reason).toContain('typo');
      expect(row.severity).toBe('warning');
      expect(row.new_values as string).toContain('taxIdOnFile');
      expect(row.new_values as string).not.toContain('ABCDE1234F');
    });
  });

  // =========================================================================
  describe('signing in', () => {
    /**
     * OPENS an account for an address that has never given.
     *
     * ══════════════════════════════════════════════════════════════════════
     * THIS TEST ASSERTED THE OPPOSITE UNTIL PHASE 8, AND THE REVERSAL IS THE
     * POINT.
     *
     * It used to expect a 401: an account was created BY A DONATION, so a
     * correct code from an unknown address had nothing to sign in to, and the
     * error said "an account is created by your first donation".
     *
     * Phase 8 made that wrong. A volunteer applies without donating and then
     * needs to see their assignments, their hours and their certificate — and
     * telling somebody who has offered their time to go and make a donation
     * first is close to the worst thing this platform could say.
     *
     * So `donors` is now the general public account: one row per person,
     * whether they have donated, volunteered, both or neither.
     *
     * THE ANTI-ABUSE PROPERTY IS UNCHANGED, because it never came from this
     * branch. An account is created only after a code sent to that address has
     * been received and entered correctly — so the holder owns the mailbox,
     * and a row keyed to a mailbox somebody owns is the definition of an
     * account rather than an abuse of one.
     * ══════════════════════════════════════════════════════════════════════
     */
    it('opens an account for a correct code from an address that has never given', async () => {
      const email = `newcomer-${Date.now()}@example.test`;
      const code = '424242';
      await db().execute(sql`
        INSERT INTO otp_codes (identifier, purpose, code_hash, expires_at)
        VALUES (${email}, 'donor_login', ${createHash('sha256').update(code).digest('hex')},
                now() + interval '10 minutes')
      `);

      const response = await request(server)
        .post(`${PREFIX}/auth/donor/otp/verify`)
        .send({ email, code });

      expect(response.status).toBe(200);
      const body = response.body as Envelope<{ accessToken: string }>;
      expect(body.data?.accessToken).toBeTruthy();

      // The account exists and has NO donations — it was opened by signing in.
      const created = await db().execute(sql`
        SELECT d.id, count(dn.id)::int AS donations
          FROM donors d
          LEFT JOIN donations dn ON dn.donor_id = d.id
         WHERE lower(btrim(d.email)) = ${email}
         GROUP BY d.id
      `);
      expect(created.rows).toHaveLength(1);
      expect(Number(created.rows![0]!.donations)).toBe(0);

      await db().execute(sql`DELETE FROM donors WHERE lower(btrim(email)) = ${email}`);
      await db().execute(sql`DELETE FROM otp_codes WHERE identifier = ${email}`);
    });

    /**
     * People do not type their own address consistently — a capital from a
     * phone keyboard, a space pasted from a contact card. All of it is one
     * mailbox, and the service, the form and `donors_email_lower_unique` all
     * normalise the same way. If they ever stop agreeing, this fails.
     */
    it('accepts the address however it was capitalised or spaced', async () => {
      const code = '424242';
      await db().execute(sql`
        INSERT INTO otp_codes (identifier, purpose, code_hash, expires_at)
        VALUES (${ALICE.email}, 'donor_login',
                ${createHash('sha256').update(code).digest('hex')},
                now() + interval '10 minutes')
      `);

      const response = await request(server)
        .post(`${PREFIX}/auth/donor/otp/verify`)
        .send({ email: `  ${ALICE.email.toUpperCase()} `, code });

      expect(response.status).toBe(200);
    });

    /**
     * Requesting a code must answer identically for a known and an unknown
     * address. Anything else turns this endpoint into a way to ask "has this
     * person donated?" — which is exactly the fact a donor expects us to keep.
     */
    it('answers the same way whether or not the address is known', async () => {
      const known = await request(server)
        .post(`${PREFIX}/auth/donor/otp/request`)
        .send({ email: ALICE.email });
      const unknown = await request(server)
        .post(`${PREFIX}/auth/donor/otp/request`)
        .send({ email: 'unknown-me-spec@example.test' });

      expect(known.status).toBe(unknown.status);
      // `meta.requestId` is per-request by design, so the comparison is on the
      // payload — the part that could leak whether the address is known.
      expect((known.body as Envelope).data).toEqual((unknown.body as Envelope).data);
      expect((known.body as Envelope).success).toEqual((unknown.body as Envelope).success);

      await db().execute(
        sql`DELETE FROM otp_codes WHERE identifier = 'unknown-me-spec@example.test'`,
      );
    });
  });
});
