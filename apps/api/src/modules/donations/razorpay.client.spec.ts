import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { RazorpayClient } from './razorpay.client.js';

/**
 * Signature verification.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * These are the tests that stand between this platform and a forged donation.
 *
 * Everything else in the payment path can be re-run, reconciled or corrected.
 * A signature check that accepts a payload it should not is the one failure
 * that records money nobody paid, and it fails silently — a wrongly-accepted
 * webhook looks exactly like a correct one.
 * ══════════════════════════════════════════════════════════════════════════
 */

const KEY_SECRET = 'test_key_secret_abcdefghijklmnop';
const WEBHOOK_SECRET = 'test_webhook_secret_qrstuvwxyz12';

function client(overrides: Record<string, string | undefined> = {}) {
  const env = {
    RAZORPAY_KEY_ID: 'rzp_test_abcdefghij',
    RAZORPAY_KEY_SECRET: KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ...overrides,
  };
  return new RazorpayClient({ env } as never);
}

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('RazorpayClient.verifyCheckoutSignature', () => {
  const orderId = 'order_NabcDEF123456';
  const paymentId = 'pay_NxyzGHI789012';

  it('accepts the signature Razorpay would produce', () => {
    // HMAC of `order_id|payment_id`, keyed with the API secret — the exact
    // construction Razorpay documents for the Checkout handshake.
    const signature = sign(`${orderId}|${paymentId}`, KEY_SECRET);
    expect(client().verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it('rejects a signature made with the wrong secret', () => {
    const signature = sign(`${orderId}|${paymentId}`, 'someone-elses-secret-0123456789ab');
    expect(client().verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(false);
  });

  /**
   * The attack this stops: a donor completes a real ₹10 payment on their own
   * order, then replays that signature against a ₹9,000 donation. The payment
   * id is in the signed material, so the substitution invalidates it.
   */
  it('rejects a genuine signature replayed against a different payment', () => {
    const signature = sign(`${orderId}|pay_SOMEOTHERPAYMENT`, KEY_SECRET);
    expect(client().verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(false);
  });

  it('rejects a genuine signature replayed against a different order', () => {
    const signature = sign(`order_SOMEOTHERORDER|${paymentId}`, KEY_SECRET);
    expect(client().verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['truncated', sign('order_x|pay_y', KEY_SECRET).slice(0, 40)],
    ['not hex', 'z'.repeat(64)],
    ['padded with whitespace', ` ${sign(`order_NabcDEF123456|pay_NxyzGHI789012`, KEY_SECRET)} `],
  ])('rejects a %s signature', (_label, signature) => {
    expect(client().verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(false);
  });

  /**
   * Fails CLOSED with no secret configured.
   *
   * A development machine without credentials must refuse to verify, not
   * default to accepting. The opposite mistake would make every local build a
   * service that records unpaid donations.
   */
  it('refuses everything when no key secret is configured', () => {
    const signature = sign(`${orderId}|${paymentId}`, KEY_SECRET);
    const bare = client({ RAZORPAY_KEY_SECRET: undefined });
    expect(bare.verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(false);
  });
});

describe('RazorpayClient.verifyWebhookSignature', () => {
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_N123', amount: 180000, status: 'captured' } } },
  });

  it('accepts a signature over the exact bytes received', () => {
    expect(client().verifyWebhookSignature(body, sign(body, WEBHOOK_SECRET))).toBe(true);
  });

  it('accepts a Buffer body, which is what the controller passes', () => {
    const raw = Buffer.from(body, 'utf8');
    expect(client().verifyWebhookSignature(raw, sign(body, WEBHOOK_SECRET))).toBe(true);
  });

  /**
   * THE MISTAKE THIS EXISTS TO CATCH.
   *
   * Verifying a re-serialised body instead of the raw bytes. `JSON.parse` then
   * `JSON.stringify` is not a round trip — key order and spacing can change —
   * and the HMAC then differs over a document that is logically identical. The
   * body below carries the same data with different whitespace, and it must
   * NOT verify against the original's signature.
   */
  it('rejects a re-serialised body carrying identical data', () => {
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(reserialised).not.toBe(body);
    expect(client().verifyWebhookSignature(reserialised, sign(body, WEBHOOK_SECRET))).toBe(false);
  });

  it('rejects a tampered amount', () => {
    const signature = sign(body, WEBHOOK_SECRET);
    const tampered = body.replace('180000', '1');
    expect(client().verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  /**
   * The webhook secret is a DIFFERENT secret from the API key.
   *
   * Reusing the key secret here is the most common Razorpay misconfiguration,
   * and it fails silently in production: every delivery is rejected, which is
   * indistinguishable from none arriving.
   */
  it('rejects a signature made with the API key secret', () => {
    expect(client().verifyWebhookSignature(body, sign(body, KEY_SECRET))).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(client().verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('refuses everything when no webhook secret is configured', () => {
    const bare = client({ RAZORPAY_WEBHOOK_SECRET: undefined });
    expect(bare.verifyWebhookSignature(body, sign(body, WEBHOOK_SECRET))).toBe(false);
  });
});

describe('RazorpayClient configuration', () => {
  it('reports itself unconfigured without credentials, so the endpoints can refuse clearly', () => {
    expect(client({ RAZORPAY_KEY_ID: undefined }).isConfigured).toBe(false);
    expect(client({ RAZORPAY_KEY_SECRET: undefined }).isConfigured).toBe(false);
    expect(client().isConfigured).toBe(true);
  });

  it('exposes only the publishable key id', () => {
    const it_ = client();
    expect(it_.publicKeyId).toBe('rzp_test_abcdefghij');
    // The secrets are not reachable through any public member. This is a
    // structural check: a getter added for convenience would break it.
    expect(Object.values(it_)).not.toContain(KEY_SECRET);
    expect(JSON.stringify(it_)).not.toContain(KEY_SECRET);
    expect(JSON.stringify(it_)).not.toContain(WEBHOOK_SECRET);
  });
});
