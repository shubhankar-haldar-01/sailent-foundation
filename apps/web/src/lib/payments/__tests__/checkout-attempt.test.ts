import { describe, expect, it } from 'vitest';

import { attemptFor, basketKey, newIdempotencyKey } from '../checkout-attempt';
import type { CheckoutHandoff } from '../razorpay-checkout';

const request = {
  campaignSlug: 'school-kits',
  items: [{ campaignProductId: 'p1', quantity: 2 }],
  customAmount: 50_000,
  donor: { name: 'A Donor', email: 'a@example.test', phone: '9811100000', anonymous: false },
};

/**
 * Phase 11: pressing Donate again for the same basket reuses the donation and
 * order already made, instead of creating another.
 */
describe('attemptFor', () => {
  it('reuses the previous attempt — and its order — for the same request', () => {
    const first = attemptFor(null, basketKey(request), () => 'key-1');
    first.handoff = { donationId: 'd1', razorpayOrderId: 'order_1' } as CheckoutHandoff;

    const retry = attemptFor(first, basketKey({ ...request }), () => 'key-2');
    expect(retry).toBe(first);
    expect(retry.idempotencyKey).toBe('key-1');
    expect(retry.handoff?.razorpayOrderId).toBe('order_1');
  });

  it('starts a new attempt, with a new key, when anything in the request changes', () => {
    const first = attemptFor(null, basketKey(request), () => 'key-1');
    first.handoff = { donationId: 'd1' } as CheckoutHandoff;

    for (const changed of [
      { ...request, customAmount: 60_000 },
      { ...request, items: [{ campaignProductId: 'p1', quantity: 3 }] },
      { ...request, donor: { ...request.donor, email: 'b@example.test' } },
    ]) {
      const next = attemptFor(first, basketKey(changed), () => 'key-new');
      expect(next).not.toBe(first);
      expect(next.idempotencyKey).toBe('key-new');
      expect(next.handoff).toBeNull();
    }
  });

  it('makes keys the API accepts', () => {
    expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
