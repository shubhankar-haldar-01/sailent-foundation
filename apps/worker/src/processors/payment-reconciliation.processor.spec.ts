import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import { INTERNAL_AUTH_HEADER } from '@sailent/config';

import {
  processPaymentReconciliation,
  type PaymentReconciliationJob,
} from './payment-reconciliation.processor.js';

const SECRET = 's'.repeat(40);
const job = { id: 'job-1' } as Job<PaymentReconciliationJob>;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

/**
 * The worker side of reconciliation: it calls the API's internal endpoint with
 * the shared secret, and turns a failure into a thrown error BullMQ retries.
 */
describe('processPaymentReconciliation', () => {
  it('calls the internal endpoint with the shared secret and returns the summary', async () => {
    const fetchImpl = respond(200, { success: true, data: { examined: 3, captured: 1 } });

    const summary = await processPaymentReconciliation(
      job,
      { apiUrl: 'http://api.internal:4000/', secret: SECRET, fetchImpl },
      logger,
    );

    expect(summary).toEqual({ examined: 3, captured: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.internal:4000/api/v1/internal/payments/reconcile');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)[INTERNAL_AUTH_HEADER]).toBe(SECRET);
  });

  it('throws on a non-2xx answer, so BullMQ retries the run', async () => {
    await expect(
      processPaymentReconciliation(
        job,
        { apiUrl: 'http://api.internal:4000', secret: SECRET, fetchImpl: respond(503, {}) },
        logger,
      ),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('never writes the secret to the log', async () => {
    const info = vi.fn();
    await processPaymentReconciliation(
      job,
      {
        apiUrl: 'http://api.internal:4000',
        secret: SECRET,
        fetchImpl: respond(200, { data: { examined: 0 } }),
      },
      { info, warn: vi.fn(), error: vi.fn() } as never,
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain(SECRET);
  });
});
