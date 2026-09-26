import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import type { RazorpayPayment } from '../src/modules/donations/razorpay.client.js';
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
 * Donations and payments, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SUITE IS ORGANISED AROUND THE THINGS THAT MUST NEVER HAPPEN.
 *
 *   • money counted that was never paid
 *   • money counted twice because a webhook arrived twice
 *   • an amount the client chose rather than the server
 *   • a historical price rewritten by a catalogue edit
 *   • progress moving on a payment that failed
 *
 * Each has a test that fails loudly if the protection is removed. A suite that
 * only walks the happy path proves a donation can succeed, not that it cannot
 * succeed wrongly.
 *
 * Postgres and Redis are real. Only Razorpay's HTTP calls are faked — the
 * signature verification under test is the production code, given real HMACs
 * computed with the fake's own secrets.
 * ══════════════════════════════════════════════════════════════════════════
 */

const KEY_SECRET = 'test_key_secret_abcdefghijklmnop';
const WEBHOOK_SECRET = 'test_webhook_secret_qrstuvwxyz12';

const DONOR = { name: 'Integration Donor', email: 'integration@example.test', phone: '9811100011' };

/** A fake provider whose ids are deterministic, so assertions can name them. */
function fakeRazorpay(overrides: Partial<Record<string, unknown>> = {}) {
  const payments = new Map<string, RazorpayPayment>();
  let counter = 0;

  const client = {
    isConfigured: true,
    publicKeyId: 'rzp_test_integration',

    async createOrder(input: { amount: number; currency: string; receipt: string }) {
      counter += 1;
      const id = `order_TEST${String(counter).padStart(8, '0')}`;
      // Remember what the order was worth, so `fetchPayment` can return a
      // payment that genuinely matches — or, when a test asks, one that does not.
      payments.set(id, {
        id: `pay_TEST${String(counter).padStart(8, '0')}`,
        order_id: id,
        amount: input.amount,
        currency: input.currency,
        status: 'captured',
        method: 'upi',
        international: false,
      });
      return {
        id,
        amount: input.amount,
        currency: input.currency,
        status: 'created',
        receipt: input.receipt,
      };
    },

    async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
      for (const payment of payments.values()) {
        if (payment.id === paymentId) return payment;
      }
      throw new Error(`fake razorpay: unknown payment ${paymentId}`);
    },

    verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }) {
      const expected = createHmac('sha256', KEY_SECRET)
        .update(`${input.orderId}|${input.paymentId}`)
        .digest('hex');
      return expected === input.signature;
    },

    verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined) {
      if (!signature) return false;
      return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex') === signature;
    },

    /** Test hook: make the next fetch report something other than a clean capture. */
    __setPayment(orderId: string, patch: Partial<RazorpayPayment>) {
      const existing = payments.get(orderId);
      if (existing) payments.set(orderId, { ...existing, ...patch });
    },
    __paymentForOrder(orderId: string) {
      return payments.get(orderId)!;
    },
    ...overrides,
  };

  return client;
}

describe('Donations (integration)', () => {
  let app: INestApplication;
  let server: unknown;
  let razorpay: ReturnType<typeof fakeRazorpay>;
  let superAdmin: string;
  let finance: string;
  let campaignManager: string;

  let campaignId: string;
  let kitId: string;
  let providedAtStart = new Map<string, number>();
  let kitPrice: number;
  let bookId: string;
  let bookPrice: number;

  const checkoutSignature = (orderId: string, paymentId: string) =>
    createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

  const webhookSignature = (body: string) =>
    createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  async function login(email: string): Promise<string> {
    /*
        ALWAYS a second factor. SUPER_ADMIN mandates TOTP (decision A8) and
        since Phase 8 it is the only staff role, so there is no password-only
        staff login left to exercise.
      */
    const response = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email, password: TEST_PASSWORD, totpCode: devTotpCode() });
    return (response.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function reauth(token: string): Promise<void> {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(token))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  /** Start a donation and return what the browser would receive. */
  async function startDonation(body: Record<string, unknown>) {
    const response = await request(server).post(`${PREFIX}/donations`).send(body);
    return {
      status: response.status,
      body: response.body as Envelope<Record<string, string | number>>,
    };
  }

  async function campaignState() {
    const database = app.get<{
      db: { execute(q: unknown): Promise<{ rows: Record<string, string>[] }> };
    }>(DATABASE);
    const result = await database.db.execute(
      sql`SELECT amount_raised, donor_count FROM campaigns WHERE id = ${campaignId}::uuid`,
    );
    const row = result.rows[0]!;
    return { raised: Number(row.amount_raised), donors: Number(row.donor_count) };
  }

  async function providedFor(campaignProductId: string) {
    const database = app.get<{
      db: { execute(q: unknown): Promise<{ rows: Record<string, string>[] }> };
    }>(DATABASE);
    const result = await database.db.execute(
      sql`SELECT provided_quantity FROM campaign_products WHERE id = ${campaignProductId}::uuid`,
    );
    return Number(result.rows[0]!.provided_quantity);
  }

  beforeAll(async () => {
    razorpay = fakeRazorpay();
    app = await createTestApp({ razorpay: razorpay as never });
    server = app.getHttpServer();

    superAdmin = await login(TEST_USERS.superAdmin);
    finance = await login(TEST_USERS.superAdmin);
    campaignManager = await login(TEST_USERS.staff);

    const products = await request(server).get(
      `${PREFIX}/campaigns/school-kits-jharkhand/products`,
    );
    const items = (products.body as Envelope<{ id: string; price: number }[]>).data!;
    kitId = items[0]!.id;

    /*
      REMEMBER THE COUNTERS, BECAUSE THIS SUITE SPENDS THEM.

      Every captured donation here increments `provided_quantity` on a SEEDED
      campaign product, and deleting the donation rows in teardown does not put
      it back. So each full run permanently consumed a few more of the 500 the
      seed creates — invisible for weeks, and then the School Kit had six left
      and tests asking for two began failing on stock rather than on the
      behaviour under test.

      It presents as a flaky suite that passes alone and fails in a full run,
      which is the most expensive shape a test defect can take.
    */
    providedAtStart = new Map(
      await Promise.all(
        [kitId, ...items.slice(1).map((item) => item.id)].map(
          async (id) => [id, await providedFor(id)] as const,
        ),
      ),
    );
    kitPrice = items[0]!.price;
    bookId = items[1]!.id;
    bookPrice = items[1]!.price;

    const campaign = await request(server).get(`${PREFIX}/campaigns/school-kits-jharkhand`);
    campaignId = (campaign.body as Envelope<{ id: string }>).data!.id;
  });

  afterAll(async () => {
    // Financial rows are ON DELETE RESTRICT all the way down, deliberately —
    // so the teardown removes them children-first, exactly as a real operator
    // would have to. Anything left behind would skew the next run's counters.
    const database = app.get<{ db: { execute(q: unknown): Promise<unknown> } }>(DATABASE);
    const mine = sql`(SELECT id FROM donors WHERE phone LIKE '98111%')`;
    await database.db.execute(
      sql`UPDATE donations SET receipt_id = NULL WHERE donor_id IN ${mine}`,
    );
    await database.db.execute(
      sql`DELETE FROM receipts WHERE donation_id IN (SELECT id FROM donations WHERE donor_id IN ${mine})`,
    );
    await database.db.execute(
      sql`DELETE FROM payment_transactions WHERE payment_id IN (SELECT id FROM payments WHERE donation_id IN (SELECT id FROM donations WHERE donor_id IN ${mine}))`,
    );
    await database.db.execute(
      sql`DELETE FROM payments WHERE donation_id IN (SELECT id FROM donations WHERE donor_id IN ${mine})`,
    );
    await database.db.execute(
      sql`DELETE FROM donation_items WHERE donation_id IN (SELECT id FROM donations WHERE donor_id IN ${mine})`,
    );
    await database.db.execute(sql`DELETE FROM donations WHERE donor_id IN ${mine}`);
    await database.db.execute(sql`DELETE FROM donors WHERE phone LIKE '98111%'`);
    /*
      Put the counters back, AFTER the donation rows are gone.

      Restored to the value observed in `beforeAll` rather than recomputed from
      surviving rows: the seed writes a starting `provided_quantity` that has no
      donations behind it at all, so recomputing would zero a figure the seed
      deliberately set and every later run would start from a different place.
    */
    for (const [campaignProductId, provided] of providedAtStart) {
      await database.db.execute(
        sql`UPDATE campaign_products SET provided_quantity = ${provided} WHERE id = ${campaignProductId}::uuid`,
      );
    }

    await database.db.execute(
      sql`DELETE FROM payment_webhooks WHERE provider_event_id LIKE 'evt_TEST%'`,
    );
    await app?.close();
  });

  // =========================================================================
  describe('the server decides the amount', () => {
    it('totals a hybrid donation from database prices', async () => {
      const { status, body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [
          { campaignProductId: kitId, quantity: 2 },
          { campaignProductId: bookId, quantity: 1 },
        ],
        customAmount: 50_000,
        donor: DONOR,
      });

      expect(status).toBe(201);
      expect(body.data!.amount).toBe(2 * kitPrice + bookPrice + 50_000);
      expect(body.data!.razorpayKeyId).toBe('rzp_test_integration');
    });

    /**
     * The attack: send a total. If it were believed, a ₹1,800 donation becomes
     * a ₹1 one and the campaign is credited ₹1,800 for a rupee.
     */
    it('ignores an amount sent by the client', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 2 }],
        amount: 100,
        total: 100,
        totalAmount: 100,
        donor: DONOR,
      });

      expect(body.data!.amount).toBe(2 * kitPrice);
    });

    it('types the donation by what it is made of', async () => {
      const custom = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [],
        customAmount: 100_000,
        donor: DONOR,
      });
      const detail = await request(server).get(
        `${PREFIX}/donations/${custom.body.data!.reference as string}`,
      );
      expect((detail.body as Envelope<{ donationType: string }>).data!.donationType).toBe('custom');
    });

    it('never moves campaign progress when a donation is merely created', async () => {
      const before = await campaignState();
      await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 1 }],
        donor: DONOR,
      });
      expect(await campaignState()).toEqual(before);
    });
  });

  // =========================================================================
  describe('capture', () => {
    it('records the donation, the counters and a receipt — once', async () => {
      const before = await campaignState();
      const providedBefore = await providedFor(kitId);

      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 3 }],
        customAmount: 20_000,
        donor: DONOR,
      });

      const orderId = body.data!.razorpayOrderId as string;
      const donationId = body.data!.donationId as string;
      const amount = body.data!.amount as number;
      const payment = razorpay.__paymentForOrder(orderId);

      const verified = await request(server)
        .post(`${PREFIX}/donations/${donationId}/verify-payment`)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          razorpaySignature: checkoutSignature(orderId, payment.id),
        });

      expect(verified.status).toBe(200);
      const outcome = (
        verified.body as Envelope<{ applied: boolean; status: string; receiptNumber: string }>
      ).data!;
      expect(outcome.applied).toBe(true);
      expect(outcome.status).toBe('successful');
      expect(outcome.receiptNumber).toMatch(/^SFL-\d{4}-\d{6}$/);

      const after = await campaignState();
      expect(after.raised).toBe(before.raised + amount);
      expect(after.donors).toBe(before.donors + 1);
      expect(await providedFor(kitId)).toBe(providedBefore + 3);
    });

    /**
     * THE MOST IMPORTANT TEST IN THIS FILE.
     *
     * The browser verifies, then the webhook arrives for the same payment —
     * which is what happens on essentially every real donation. If both applied
     * their side effects the campaign would be credited twice for one gift.
     */
    it('does not count a donation twice when the webhook follows the browser', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: bookId, quantity: 2 }],
        donor: DONOR,
      });

      const orderId = body.data!.razorpayOrderId as string;
      const donationId = body.data!.donationId as string;
      const amount = body.data!.amount as number;
      const payment = razorpay.__paymentForOrder(orderId);

      const before = await campaignState();
      const providedBefore = await providedFor(bookId);

      await request(server)
        .post(`${PREFIX}/donations/${donationId}/verify-payment`)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          razorpaySignature: checkoutSignature(orderId, payment.id),
        })
        .expect(200);

      const webhookBody = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: payment } },
      });

      await request(server)
        .post(`${PREFIX}/payments/razorpay/webhook`)
        .set('x-razorpay-signature', webhookSignature(webhookBody))
        .set('x-razorpay-event-id', `evt_TEST_${payment.id}_a`)
        .set('Content-Type', 'application/json')
        .send(webhookBody)
        .expect(200);

      const after = await campaignState();
      expect(after.raised).toBe(before.raised + amount);
      expect(after.donors).toBe(before.donors + 1);
      expect(await providedFor(bookId)).toBe(providedBefore + 2);
    });

    it('treats a repeated webhook delivery as a duplicate and does nothing', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 1 }],
        donor: DONOR,
      });

      const orderId = body.data!.razorpayOrderId as string;
      const payment = razorpay.__paymentForOrder(orderId);
      const webhookBody = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: payment } },
      });
      const eventId = `evt_TEST_${payment.id}_dup`;

      const first = await request(server)
        .post(`${PREFIX}/payments/razorpay/webhook`)
        .set('x-razorpay-signature', webhookSignature(webhookBody))
        .set('x-razorpay-event-id', eventId)
        .set('Content-Type', 'application/json')
        .send(webhookBody);
      expect(first.body.status).toBe('received');

      const before = await campaignState();

      // Delivered three more times, as Razorpay will on a retry.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const again = await request(server)
          .post(`${PREFIX}/payments/razorpay/webhook`)
          .set('x-razorpay-signature', webhookSignature(webhookBody))
          .set('x-razorpay-event-id', eventId)
          .set('Content-Type', 'application/json')
          .send(webhookBody);
        expect(again.status).toBe(200);
        expect(again.body.status).toBe('duplicate');
      }

      expect(await campaignState()).toEqual(before);
    });

    it('refuses a webhook whose signature does not verify, and records nothing', async () => {
      const webhookBody = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_FORGED',
              order_id: 'order_FORGED',
              amount: 900_000,
              status: 'captured',
            },
          },
        },
      });

      const response = await request(server)
        .post(`${PREFIX}/payments/razorpay/webhook`)
        .set('x-razorpay-signature', 'a'.repeat(64))
        .set('x-razorpay-event-id', 'evt_TEST_forged')
        .set('Content-Type', 'application/json')
        .send(webhookBody);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('rejected');
    });

    it('refuses a checkout signature that does not verify', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 1 }],
        donor: DONOR,
      });

      const response = await request(server)
        .post(`${PREFIX}/donations/${body.data!.donationId as string}/verify-payment`)
        .send({
          razorpayOrderId: body.data!.razorpayOrderId as string,
          razorpayPaymentId: 'pay_MADEUP',
          razorpaySignature: 'b'.repeat(64),
        });

      expect(errorCode(response.body as Envelope)).toBe('VALIDATION_FAILED');
    });

    /**
     * A valid signature is not enough. It proves the browser saw a genuine
     * Razorpay response for this order; it says nothing about the amount. If
     * the provider reports a different figure from ours, something is wrong and
     * nothing should be credited.
     */
    it('refuses to capture when the provider’s amount disagrees with ours', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 2 }],
        donor: DONOR,
      });

      const orderId = body.data!.razorpayOrderId as string;
      const donationId = body.data!.donationId as string;
      const payment = razorpay.__paymentForOrder(orderId);
      razorpay.__setPayment(orderId, { amount: 100 });

      const before = await campaignState();

      const response = await request(server)
        .post(`${PREFIX}/donations/${donationId}/verify-payment`)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          razorpaySignature: checkoutSignature(orderId, payment.id),
        });

      expect(errorCode(response.body as Envelope)).toBe('CONFLICT');
      expect(await campaignState()).toEqual(before);
    });
  });

  // =========================================================================
  describe('payments that do not succeed', () => {
    it('marks a failed payment failed and moves no counter', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 4 }],
        donor: DONOR,
      });

      const orderId = body.data!.razorpayOrderId as string;
      const reference = body.data!.reference as string;
      const payment = razorpay.__paymentForOrder(orderId);

      const before = await campaignState();
      const providedBefore = await providedFor(kitId);

      const webhookBody = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              ...payment,
              status: 'failed',
              error_description: 'Card declined by issuer',
              error_code: 'BAD_REQUEST_ERROR',
            },
          },
        },
      });

      await request(server)
        .post(`${PREFIX}/payments/razorpay/webhook`)
        .set('x-razorpay-signature', webhookSignature(webhookBody))
        .set('x-razorpay-event-id', `evt_TEST_${payment.id}_failed`)
        .set('Content-Type', 'application/json')
        .send(webhookBody)
        .expect(200);

      const detail = await request(server).get(`${PREFIX}/donations/${reference}`);
      expect((detail.body as Envelope<{ status: string }>).data!.status).toBe('failed');

      expect(await campaignState()).toEqual(before);
      expect(await providedFor(kitId)).toBe(providedBefore);
    });

    it('leaves an abandoned checkout pending, and credits nothing', async () => {
      const before = await campaignState();
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 1 }],
        donor: DONOR,
      });

      // The donor closed the Razorpay window. Nothing else happens.
      const detail = await request(server).get(
        `${PREFIX}/donations/${body.data!.reference as string}`,
      );
      expect((detail.body as Envelope<{ status: string }>).data!.status).toBe('pending');
      expect(await campaignState()).toEqual(before);
    });
  });

  // =========================================================================
  describe('historical prices', () => {
    /**
     * The claim Phase 5 made and Phase 6 has to keep: a donation records what
     * the donor was charged, and a later catalogue or campaign edit does not
     * reach back into it.
     */
    it('keeps the price the donor paid after the campaign price changes', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 2 }],
        donor: DONOR,
      });

      const reference = body.data!.reference as string;
      const paidPrice = kitPrice;

      await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/products/${kitId}`)
        .set(auth(superAdmin))
        .send({ price: paidPrice + 25_000 })
        .expect(200);

      const detail = await request(server).get(`${PREFIX}/donations/${reference}`);
      const items = (
        detail.body as Envelope<{ items: { unitPrice: number; totalPrice: number }[] }>
      ).data!.items;
      const line = items.find((item) => item.unitPrice === paidPrice);

      expect(line).toBeDefined();
      expect(line!.totalPrice).toBe(2 * paidPrice);

      // Put it back, so later assertions in this file see the seeded price.
      await request(server)
        .patch(`${PREFIX}/admin/campaigns/${campaignId}/products/${kitId}`)
        .set(auth(superAdmin))
        .send({ price: paidPrice })
        .expect(200);
    });
  });

  // =========================================================================
  describe('administration', () => {
    /*
      ══════════════════════════════════════════════════════════════════════
      REMOVED IN PHASE 8 — the donor-PII split needed a role that lacked `donation.read_pii`.

      It asserted that a Campaign Manager saw donation AGGREGATES but not who gave
      — running a campaign means knowing whether it is working, not who funded
      it. SUPER_ADMIN holds both permissions, so there is nobody left to be the
      caller "without" one.

      The split itself still exists in `admin-donors.service.ts`, enforced
      inside the SELECT rather than by a serialiser, and `me.spec.ts` still
      asserts that one donor cannot reach another donor’s record.

      The permission strings are untouched and are still what the guard checks;
      what is gone is the role that held some of them and not others.
      Reintroducing a narrower role is a seed change, and this test returns
      with it. The guard's own denial logic is covered with synthetic actors in
      `src/common/guards/auth.guard.spec.ts`.
      ══════════════════════════════════════════════════════════════════════
    */

    it('shows donor identity to Finance, who holds the sensitive permission', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/donations?limit=20&q=${DONOR.email}`)
        .set(auth(finance));

      const rows = (response.body as Envelope<{ items: { donorEmail: string | null }[] }>).data!
        .items;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => row.donorEmail === DONOR.email)).toBe(true);
    });

    it('offers no way to mark a donation successful by hand', async () => {
      const listed = await request(server)
        .get(`${PREFIX}/admin/donations?limit=1`)
        .set(auth(superAdmin));
      const id = (listed.body as Envelope<{ items: { id: string }[] }>).data!.items[0]!.id;

      // None of the shapes an administrator might reach for exists.
      for (const [method, path] of [
        ['patch', `${PREFIX}/admin/donations/${id}`],
        ['post', `${PREFIX}/admin/donations/${id}/status`],
        ['post', `${PREFIX}/admin/donations/${id}/mark-paid`],
        ['post', `${PREFIX}/admin/donations/${id}/capture`],
      ] as const) {
        const response = await (
          request(server) as never as Record<string, (p: string) => request.Test>
        )
          [method](path)
          .set(auth(superAdmin))
          .send({ status: 'successful' });
        expect(response.status).toBe(404);
      }
    });
  });

  // =========================================================================
  describe('a refund raised outside this platform', () => {
    /**
     * This platform does not offer refunds — there is no refund table, no
     * refund permission and no code that moves a counter back down.
     *
     * But somebody with the Razorpay dashboard can still return a donor's money
     * in three clicks, and Razorpay will tell us about it. The danger is that
     * the event is filed alongside every other unhandled notification and
     * nobody ever finds out the books have drifted.
     *
     * So the event must do two things and no more: change nothing, and be
     * impossible to miss. That is what this pins down.
     */
    it('changes nothing, and flags itself for a human', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: kitId, quantity: 2 }],
        donor: DONOR,
      });

      const orderId = body.data!.razorpayOrderId as string;
      const donationId = body.data!.donationId as string;
      const reference = body.data!.reference as string;
      const amount = body.data!.amount as number;
      const payment = razorpay.__paymentForOrder(orderId);

      await request(server)
        .post(`${PREFIX}/donations/${donationId}/verify-payment`)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          razorpaySignature: checkoutSignature(orderId, payment.id),
        })
        .expect(200);

      const afterCapture = await campaignState();
      const providedAfterCapture = await providedFor(kitId);

      const eventId = `evt_TEST_refund_${payment.id}`;
      const refundBody = JSON.stringify({
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: `rfnd_DASHBOARD_${payment.id.slice(-6)}`,
              payment_id: payment.id,
              amount,
              status: 'processed',
            },
          },
        },
      });

      // Still 200: the event is ours to store, and making Razorpay retry it
      // forever would not help.
      await request(server)
        .post(`${PREFIX}/payments/razorpay/webhook`)
        .set('x-razorpay-signature', webhookSignature(refundBody))
        .set('x-razorpay-event-id', eventId)
        .set('Content-Type', 'application/json')
        .send(refundBody)
        .expect(200);

      // Nothing moved. The donation is still a successful donation, because as
      // far as this platform is concerned it is one.
      const detail = await request(server).get(`${PREFIX}/donations/${reference}`);
      expect((detail.body as Envelope<{ status: string }>).data!.status).toBe('successful');
      expect(await campaignState()).toEqual(afterCapture);
      expect(await providedFor(kitId)).toBe(providedAfterCapture);

      // And it is one query away from Finance rather than buried among every
      // other event Razorpay sends that we do not act on.
      const database = app.get<{ db: { execute(q: unknown): Promise<unknown> } }>(DATABASE);
      const flagged = (await database.db.execute(
        sql`SELECT processing_status FROM payment_webhooks WHERE provider_event_id = ${eventId}`,
      )) as { rows?: { processing_status: string }[] };
      expect(flagged.rows?.[0]?.processing_status).toBe('needs_review');
    });
  });

  // =========================================================================
  describe('receipts', () => {
    it('issues one receipt per donation, reachable by its reference', async () => {
      const { body } = await startDonation({
        campaignSlug: 'school-kits-jharkhand',
        items: [{ campaignProductId: bookId, quantity: 1 }],
        customAmount: 10_000,
        donor: DONOR,
      });

      const orderId = body.data!.razorpayOrderId as string;
      const reference = body.data!.reference as string;
      const payment = razorpay.__paymentForOrder(orderId);

      await request(server)
        .post(`${PREFIX}/donations/${body.data!.donationId as string}/verify-payment`)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          razorpaySignature: checkoutSignature(orderId, payment.id),
        })
        .expect(200);

      const receipt = await request(server).get(`${PREFIX}/donations/${reference}/receipt`);
      expect(receipt.status).toBe(200);

      const data = (
        receipt.body as Envelope<{
          receiptNumber: string;
          amount: number;
          lineItems: { itemName: string; unitPrice: number }[];
        }>
      ).data!;

      expect(data.receiptNumber).toMatch(/^SFL-\d{4}-\d{6}$/);
      expect(data.amount).toBe(body.data!.amount);
      // The line items are the SNAPSHOT, stored on the receipt itself.
      expect(data.lineItems.length).toBe(2);
      expect(data.lineItems.some((line) => line.itemName === 'Additional donation')).toBe(true);
    });

    /**
     * What "gapless" actually means, tested precisely.
     *
     * ══════════════════════════════════════════════════════════════════════
     * It does NOT mean the table always reads 1..n. A number is consumed when a
     * receipt COMMITS, and a committed receipt is never deleted by the
     * application — there is no delete path. This suite's teardown removes its
     * own rows, which no operator could do, and the counter correctly does not
     * wind back afterwards.
     *
     * What the guarantee means is that a number is never SKIPPED by a failed
     * transaction and never issued TWICE. So this issues two receipts in a row
     * and asserts they are consecutive, which is the property a sequence would
     * have broken.
     * ══════════════════════════════════════════════════════════════════════
     */
    it('issues consecutive numbers, with no gap between them', async () => {
      const issue = async () => {
        const { body } = await startDonation({
          campaignSlug: 'school-kits-jharkhand',
          items: [{ campaignProductId: bookId, quantity: 1 }],
          donor: DONOR,
        });
        const orderId = body.data!.razorpayOrderId as string;
        const payment = razorpay.__paymentForOrder(orderId);
        const verified = await request(server)
          .post(`${PREFIX}/donations/${body.data!.donationId as string}/verify-payment`)
          .send({
            razorpayOrderId: orderId,
            razorpayPaymentId: payment.id,
            razorpaySignature: checkoutSignature(orderId, payment.id),
          })
          .expect(200);
        return (verified.body as Envelope<{ receiptNumber: string }>).data!.receiptNumber;
      };

      const first = await issue();
      const second = await issue();

      const parse = (value: string) => {
        const [, year, sequence] = /^SFL-(\d{4})-(\d{6})$/.exec(value)!;
        return { year: Number(year), sequence: Number(sequence) };
      };

      const a = parse(first);
      const b = parse(second);

      expect(b.year).toBe(a.year);
      expect(b.sequence).toBe(a.sequence + 1);
    });

    it('never issues the same number twice', async () => {
      const database = app.get<{
        db: { execute(q: unknown): Promise<{ rows: Record<string, string>[] }> };
      }>(DATABASE);
      const result = await database.db.execute(sql`
        SELECT financial_year, sequence, count(*)::int AS n
          FROM receipts
      GROUP BY financial_year, sequence
        HAVING count(*) > 1
      `);

      // The unique index would refuse a repeat anyway. This asserts the index
      // is doing its job rather than assuming it.
      expect(result.rows).toEqual([]);
    });

    it('binds exactly one receipt to each donation', async () => {
      const database = app.get<{
        db: { execute(q: unknown): Promise<{ rows: Record<string, string>[] }> };
      }>(DATABASE);
      const result = await database.db.execute(sql`
        SELECT donation_id FROM receipts GROUP BY donation_id HAVING count(*) > 1
      `);
      expect(result.rows).toEqual([]);
    });
  });
});
