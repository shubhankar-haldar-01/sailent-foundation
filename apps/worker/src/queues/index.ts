/**
 * Queue registry.
 *
 * Queues are declared here as each phase needs them, so there is one place to
 * see everything that runs in the background. Phase 1 registers only the
 * example queue that proves the pipeline works end to end.
 *
 * Planned (docs/architecture.md §4) — NOT implemented:
 *   webhooks      Phase 5  Process a Razorpay event through the payment state machine
 *   receipts      Phase 5  Render a receipt PDF and store it in R2
 *   email         Phase 4  Send via Brevo
 *   notifications Phase 7  In-app notifications
 *   exports       Phase 7  CSV and Form 10BD generation
 *   certificates  Phase 6  Volunteer certificate PDFs
 *   media         Phase 4  Re-encode images, compute blurhash, strip EXIF
 */

export const QUEUE_NAMES = {
  /** Verifies Redis, BullMQ and the processor wiring end to end. */
  EXAMPLE: 'example',
  /** Registered so the worker consumes them; processors land with their phase. */
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
  PAYMENTS: 'payments',
  CLEANUP: 'cleanup',
} as const;

/**
 * These names MUST match `QUEUE_NAMES` in apps/api. A mismatch produces jobs
 * nobody consumes — a silent failure with no error anywhere, which is the worst
 * kind. The duplication is deliberate: the worker must start without importing
 * the API, and six string literals are cheaper than that coupling. The
 * integration test asserts the two lists agree.
 */

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Default job options.
 *
 * Every job MUST be safe to run twice: at-least-once is the only guarantee a
 * retrying queue provides, so idempotency is a requirement of the processor,
 * not a property of the queue.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  // Keep a window of history for debugging without letting Redis grow unbounded.
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;
