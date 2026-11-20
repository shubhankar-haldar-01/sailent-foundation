import type { CheckoutAttempt } from './checkout-attempt';

/**
 * What this browser tab remembers about a checkout (2026-11-19, Phase 3 of the
 * UI feedback system).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY IT IS REMEMBERED AT ALL.
 *
 * The attempt (the donation and Razorpay order already made for this basket,
 * and its idempotency key) used to live only in memory. A refresh, the Back
 * button after paying, or a duplicated tab lost it, and the next press of Pay
 * created a second donation for a basket that was already paid. Kept here, the
 * checkout can ask the server what became of it first: paid goes to the
 * receipt, still open reopens the same order, failed starts afresh.
 *
 * The donor's details are kept so "Try again" after a failed payment does not
 * mean typing them again.
 *
 * SESSION storage: this tab only, gone when it closes, never sent anywhere.
 * Every read and write tolerates storage being unavailable (private mode,
 * blocked site data): the checkout then works as it did before, in memory.
 * ══════════════════════════════════════════════════════════════════════════
 */

const STORAGE_KEY = 'sailent:checkout';

export interface CheckoutDonorDetails {
  name: string;
  email: string;
  phone: string;
  message?: string;
  anonymous: boolean;
}

interface StoredCheckout {
  /** Which basket the attempt belongs to (`selectionKey`). */
  selection?: string;
  attempt?: CheckoutAttempt;
  donor?: CheckoutDonorDetails;
}

/** The basket only (not the donor), so a reload can match it before anything is typed. */
export function selectionKey(selection: {
  campaignSlug: string;
  items: { campaignProductId: string; quantity: number }[];
  customAmount: number;
}): string {
  return JSON.stringify({
    campaign: selection.campaignSlug,
    items: [...selection.items].sort((a, b) =>
      a.campaignProductId.localeCompare(b.campaignProductId),
    ),
    custom: selection.customAmount,
  });
}

function read(): StoredCheckout {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as StoredCheckout) : {};
  } catch {
    return {};
  }
}

function write(next: StoredCheckout): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Unavailable: the checkout carries on in memory.
  }
}

/** The attempt saved for this basket, if any. */
export function storedAttempt(selection: string): CheckoutAttempt | null {
  const stored = read();
  return stored.selection === selection && stored.attempt ? stored.attempt : null;
}

export function saveAttempt(selection: string, attempt: CheckoutAttempt): void {
  write({ ...read(), selection, attempt });
}

/** Forget the attempt (it was paid, or it can no longer be paid); keep the donor's details. */
export function forgetAttempt(): void {
  const { donor } = read();
  write(donor ? { donor } : {});
}

export function storedDonor(): CheckoutDonorDetails | null {
  const donor = read().donor;
  return donor && typeof donor.name === 'string' ? donor : null;
}

export function saveDonor(donor: CheckoutDonorDetails): void {
  write({ ...read(), donor });
}

/**
 * What the checkout should do about an earlier attempt, given its donation's
 * status on the server.
 */
export type AttemptVerdict = 'show-result' | 'reopen' | 'start-afresh';

export function verdictFor(status: string | null): AttemptVerdict {
  switch (status) {
    // Paid, or being confirmed right now: the status page shows the outcome.
    case 'successful':
    case 'processing':
      return 'show-result';
    // Still open: the same order is reopened, never a second donation.
    case 'pending':
      return 'reopen';
    // Failed, cancelled, unknown: that order is finished; a new attempt.
    default:
      return 'start-afresh';
  }
}
