import type { Job } from 'bullmq';

import { API_PREFIX, INTERNAL_AUTH_HEADER } from '@sailent/config';

import type { Logger } from '../lib/logger.js';

/** The job name on the `payments` queue. */
export const PAYMENT_RECONCILE_JOB = 'payments.reconcile';
/** The repeatable schedule's id: one schedule, however many workers start. */
export const PAYMENT_RECONCILE_SCHEDULER = 'payments-reconcile';

export type PaymentReconciliationJob = Record<string, never>;

export interface PaymentReconciliationDeps {
  /** Where the worker reaches the API, e.g. http://localhost:4000. */
  apiUrl: string;
  /** `INTERNAL_API_SECRET`. Never logged. */
  secret: string;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Run payment reconciliation (Phase 11).
 *
 * The WORKER owns the schedule — a BullMQ repeatable job on the `payments`
 * queue — and the API owns the work: capture must stay in one place, so this
 * processor only calls the API's internal endpoint with the shared secret and
 * reports what it did. See `PaymentReconciliationService` in the API.
 *
 * A non-2xx answer throws, so BullMQ retries it with backoff; a run that keeps
 * failing is logged at error level when its attempts are exhausted, and the
 * next scheduled run tries again regardless. Every run is idempotent.
 */
export async function processPaymentReconciliation(
  job: Job<PaymentReconciliationJob>,
  deps: PaymentReconciliationDeps,
  logger: Logger,
): Promise<Record<string, number>> {
  const doFetch = deps.fetchImpl ?? fetch;
  const url = `${deps.apiUrl.replace(/\/$/, '')}/${API_PREFIX}/internal/payments/reconcile`;

  const response = await doFetch(url, {
    method: 'POST',
    headers: { [INTERNAL_AUTH_HEADER]: deps.secret, 'content-type': 'application/json' },
    body: '{}',
    // A run fetches up to a hundred orders from Razorpay; give it room.
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Reconciliation request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Record<string, number>;
  };
  const summary = payload.data ?? {};

  logger.info({ jobId: job.id, summary }, 'Payment reconciliation finished');
  return summary;
}
