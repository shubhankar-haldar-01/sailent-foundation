import type { CheckoutHandoff } from './razorpay-checkout';

/**
 * One donation attempt in the checkout (Phase 11).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SAME BASKET REUSES THE SAME DONATION AND ORDER.
 *
 * A donor who closes the payment window, or whose card is declined, and then
 * presses Donate again is paying for the SAME thing. Before this, every press
 * created a new donation and a new Razorpay order — a duplicate pending row
 * each time, holding the same stock, and a second order a donor could end up
 * paying as well as the first.
 *
 * Now the attempt is keyed on exactly what is sent (`basketKey`): the same
 * request reopens the same order, which Razorpay lets a donor try again on.
 * Anything different — another amount, item, name or email — is a new attempt
 * with a new `Idempotency-Key`. The key also makes a double submission, or a
 * retry after a network error, return the donation the server already made
 * rather than a second one (the API's `DonationIdempotencyService`).
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface CheckoutAttempt {
  /** `basketKey` of the request this attempt was made for. */
  key: string;
  /** Sent as `Idempotency-Key` when the donation is created. */
  idempotencyKey: string;
  /** The donation and order, once created. */
  handoff: CheckoutHandoff | null;
}

/** A stable identity for one request: the exact body that is sent. */
export function basketKey(body: unknown): string {
  return JSON.stringify(body);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** The attempt to use for this request — the previous one if it is the same request. */
export function attemptFor(
  previous: CheckoutAttempt | null,
  key: string,
  makeKey: () => string = newIdempotencyKey,
): CheckoutAttempt {
  if (previous && previous.key === key) return previous;
  return { key, idempotencyKey: makeKey(), handoff: null };
}
