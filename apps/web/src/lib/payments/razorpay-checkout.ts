/**
 * Razorpay Checkout, in the browser.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE DECIDES ANYTHING.
 *
 * This module loads a script, opens a modal and reports what came back. It does
 * not mark a donation paid, does not compute a total, and does not know a
 * secret — the only credential it handles is the publishable key id, which the
 * API supplies with the order and which is designed to be public.
 *
 * The "success" handler is the weakest signal in the whole flow: it fires in a
 * context an attacker fully controls. What makes it useful is that Razorpay
 * signs its response with a secret held only on our server, so the callback's
 * job is simply to carry that signature back for verification. Everything the
 * donor sees afterwards comes from the server's answer, not from this.
 * ══════════════════════════════════════════════════════════════════════════
 */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export interface CheckoutHandoff {
  razorpayKeyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  donationId: string;
  reference: string;
  donor: { name: string; email: string; phone: string };
  campaign: { slug: string; title: string };
}

export interface CheckoutResult {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (payload: unknown) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

/**
 * Load Checkout once, on demand.
 *
 * Not in the document head: this is a third-party script on the critical
 * rendering path of every page, and the overwhelming majority of visitors never
 * open a payment modal. The promise is cached so a donor who abandons and
 * retries does not download it twice.
 */
export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in a browser'));
  if (window.Razorpay) return Promise.resolve();

  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Checkout failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Cleared so a later attempt can try again — a failed load is often a
      // flaky network rather than a permanent block.
      scriptPromise = null;
      reject(new Error('Checkout failed to load'));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export type CheckoutOutcome =
  | { kind: 'paid'; result: CheckoutResult }
  | { kind: 'dismissed' }
  | { kind: 'failed'; reason: string };

/**
 * Open the modal and settle when the donor is done with it.
 *
 * THREE OUTCOMES, ALL EXPECTED. Paid, dismissed, failed. `dismissed` is not an
 * error and must not be presented as one: closing a payment window is a normal
 * thing to do, and a red failure message for it makes the organisation look
 * broken at the exact moment the donor was hesitating.
 *
 * This resolves rather than rejects for every one of them, so the caller
 * handles them as cases instead of sorting through a thrown error.
 */
export function openRazorpayCheckout(handoff: CheckoutHandoff): Promise<CheckoutOutcome> {
  return new Promise((resolve) => {
    if (!window.Razorpay) {
      resolve({ kind: 'failed', reason: 'Checkout is unavailable. Please try again.' });
      return;
    }

    // Guards against the modal reporting twice — a dismiss firing after a
    // success would otherwise overwrite a completed payment with a cancellation.
    let settled = false;
    const settle = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const razorpay = new window.Razorpay({
      key: handoff.razorpayKeyId,
      order_id: handoff.razorpayOrderId,
      // Shown to the donor. The server already knows the real figure; this is
      // for display and Razorpay validates it against the order regardless.
      amount: handoff.amount,
      currency: handoff.currency,
      name: 'Sailent Foundation',
      description: handoff.campaign.title,
      prefill: {
        name: handoff.donor.name,
        email: handoff.donor.email,
        contact: handoff.donor.phone,
      },
      notes: { reference: handoff.reference },
      theme: { color: '#BA4503' },
      handler: (response: Record<string, string>) => {
        settle({
          kind: 'paid',
          result: {
            razorpayOrderId: response.razorpay_order_id ?? handoff.razorpayOrderId,
            razorpayPaymentId: response.razorpay_payment_id ?? '',
            razorpaySignature: response.razorpay_signature ?? '',
          },
        });
      },
      modal: {
        ondismiss: () => settle({ kind: 'dismissed' }),
        // Razorpay's own confirmation prompt on close. One fewer accidental
        // abandonment, at the cost of one extra tap for a deliberate one.
        confirm_close: true,
        escape: true,
      },
    });

    razorpay.on('payment.failed', (payload: unknown) => {
      const error = (payload as { error?: { description?: string } } | undefined)?.error;
      settle({
        kind: 'failed',
        reason: error?.description ?? 'The payment did not go through.',
      });
    });

    razorpay.open();
  });
}
