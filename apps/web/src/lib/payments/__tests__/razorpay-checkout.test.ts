import { afterEach, describe, expect, it } from 'vitest';

import { openRazorpayCheckout, type CheckoutHandoff } from '../razorpay-checkout';

/**
 * A stand-in for Razorpay Checkout's browser object: it records the options it
 * was opened with and the event handlers registered on it, so a test can play
 * the donor's part — fail, retry, pay, close.
 */
function installFakeRazorpay() {
  const state: {
    options?: Record<string, unknown>;
    handlers: Record<string, (payload: unknown) => void>;
  } = { handlers: {} };

  window.Razorpay = class {
    constructor(options: Record<string, unknown>) {
      state.options = options;
    }
    on(event: string, handler: (payload: unknown) => void) {
      state.handlers[event] = handler;
    }
    open() {}
  } as unknown as typeof window.Razorpay;

  return {
    fail: (description: string) => state.handlers['payment.failed']?.({ error: { description } }),
    pay: (paymentId: string) =>
      (state.options!.handler as (response: Record<string, string>) => void)({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: paymentId,
        razorpay_signature: 'signature',
      }),
    close: () => (state.options!.modal as { ondismiss: () => void }).ondismiss(),
  };
}

const handoff: CheckoutHandoff = {
  razorpayKeyId: 'rzp_test_key',
  razorpayOrderId: 'order_1',
  amount: 50_000,
  currency: 'INR',
  donationId: 'donation-1',
  reference: 'DON-ABCDEFGH',
  donor: { name: 'A Donor', email: 'a@example.test', phone: '9811100000' },
  campaign: { slug: 'school-kits', title: 'School kits' },
};

afterEach(() => {
  delete window.Razorpay;
});

/**
 * Phase 11: a failed attempt is NOT the end of the checkout. Razorpay keeps its
 * window open for another try on the same order, and a success after a failure
 * must reach verification — it used to be dropped, and the donor paid twice.
 */
describe('openRazorpayCheckout', () => {
  it('reports a payment made after a failed attempt as paid', async () => {
    const razorpay = installFakeRazorpay();
    const outcome = openRazorpayCheckout(handoff);

    razorpay.fail('Card declined');
    razorpay.pay('pay_retry');

    await expect(outcome).resolves.toEqual({
      kind: 'paid',
      result: {
        razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_retry',
        razorpaySignature: 'signature',
      },
    });
  });

  it('reports the failure when the donor closes the window after it', async () => {
    const razorpay = installFakeRazorpay();
    const outcome = openRazorpayCheckout(handoff);

    razorpay.fail('Card declined');
    razorpay.close();

    await expect(outcome).resolves.toEqual({ kind: 'failed', reason: 'Card declined' });
  });

  it('treats closing the window without a failure as a dismissal', async () => {
    const razorpay = installFakeRazorpay();
    const outcome = openRazorpayCheckout(handoff);

    razorpay.close();

    await expect(outcome).resolves.toEqual({ kind: 'dismissed' });
  });

  it('settles once: a close after paying does not undo the payment', async () => {
    const razorpay = installFakeRazorpay();
    const outcome = openRazorpayCheckout(handoff);

    razorpay.pay('pay_ok');
    razorpay.close();

    await expect(outcome).resolves.toMatchObject({ kind: 'paid' });
  });

  it('opens the order it was given — a retry reopens the same one', () => {
    let opened: Record<string, unknown> | undefined;
    window.Razorpay = class {
      constructor(options: Record<string, unknown>) {
        opened = options;
      }
      on() {}
      open() {}
    } as unknown as typeof window.Razorpay;

    void openRazorpayCheckout(handoff);
    expect(opened?.order_id).toBe('order_1');
  });
});
