import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  forgetAttempt,
  saveAttempt,
  saveDonor,
  selectionKey,
  storedAttempt,
  storedDonor,
  verdictFor,
} from '../checkout-session';

const attempt = { key: 'k', idempotencyKey: 'i', handoff: null };

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('checkout session', () => {
  it('decides what an earlier attempt means from its status on the server', () => {
    expect(verdictFor('successful')).toBe('show-result');
    expect(verdictFor('processing')).toBe('show-result');
    expect(verdictFor('pending')).toBe('reopen');
    for (const status of ['failed', 'cancelled', null, 'something-new']) {
      expect(verdictFor(status)).toBe('start-afresh');
    }
  });

  it('matches a basket regardless of the order its items were added in', () => {
    const a = selectionKey({
      campaignSlug: 'c',
      items: [
        { campaignProductId: 'p2', quantity: 1 },
        { campaignProductId: 'p1', quantity: 2 },
      ],
      customAmount: 500,
    });
    const b = selectionKey({
      campaignSlug: 'c',
      items: [
        { campaignProductId: 'p1', quantity: 2 },
        { campaignProductId: 'p2', quantity: 1 },
      ],
      customAmount: 500,
    });
    expect(a).toBe(b);
  });

  it('keeps the attempt for its own basket only, and the donor after the attempt is forgotten', () => {
    saveAttempt('basket-1', attempt);
    saveDonor({ name: 'Asha', email: 'a@example.org', phone: '9876543210', anonymous: false });

    expect(storedAttempt('basket-1')).toEqual(attempt);
    expect(storedAttempt('basket-2')).toBeNull();

    forgetAttempt();
    expect(storedAttempt('basket-1')).toBeNull();
    expect(storedDonor()?.name).toBe('Asha');
  });

  it('carries on without storage (private mode, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveAttempt('basket-1', attempt)).not.toThrow();
    expect(storedAttempt('basket-1')).toBeNull();
    expect(storedDonor()).toBeNull();
  });
});
