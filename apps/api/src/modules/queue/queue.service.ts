import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

import { RedisService } from '../redis/redis.service.js';

/**
 * Queue names.
 *
 * Declared in ONE place so there is a single list of everything that runs in
 * the background, and so the API and the worker cannot disagree about a name —
 * a typo there produces a job nobody ever consumes, which is a silent failure.
 *
 * Phase 3 implements only `example`, which exists to prove
 * API → Redis → worker end to end. The rest are declared because the worker
 * registers consumers for them and later phases fill them in.
 */
export const QUEUE_NAMES = {
  EXAMPLE: 'example',
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
  PAYMENTS: 'payments',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Build a job id from its parts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * BULLMQ REFUSES A COLON IN A CUSTOM JOB ID, and the refusal is a thrown
 * `Error: Custom Id cannot contain :` rather than anything the type system
 * catches. It uses `:` internally to namespace its Redis keys, so an id
 * containing one would address a different structure.
 *
 * That is not a theoretical hazard. `donation-confirmation:${receiptNumber}`
 * was written with a colon, the capture path wraps its enqueue in a `.catch()`
 * so that a queue outage cannot fail a donation that has already taken the
 * money — and so every donor confirmation email was thrown away at the seam,
 * logged as a warning nobody was reading, for as long as that line existed.
 *
 * So ids are built HERE, from parts, and joined with a separator the queue
 * accepts. A call site that cannot type the separator cannot get it wrong.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Parts are also stripped of anything outside `[A-Za-z0-9_.-]`, so an id built
 * from a title or an email cannot smuggle a separator in through its data.
 */
export function jobKey(...parts: (string | number)[]): string {
  return parts
    .map((part) => String(part).replace(/[^A-Za-z0-9_.-]/g, '-'))
    .filter((part) => part.length > 0)
    .join('--');
}

/**
 * Default job options.
 *
 * Every processor MUST be safe to run twice. At-least-once is the only
 * guarantee a retrying queue provides, so idempotency is a requirement of the
 * job, not a property of the queue.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly redis: RedisService) {}

  private queueFor(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.redis.getClient(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  /**
   * Enqueue a job.
   *
   * `jobId` is how a caller makes enqueueing idempotent: BullMQ ignores a
   * second job with an id it has already seen. Phase 5 uses the Razorpay event
   * id here so a duplicate webhook cannot enqueue duplicate work.
   */
  async enqueue<T extends object>(
    name: QueueName,
    jobName: string,
    data: T,
    options: {
      jobId?: string;
      delayMs?: number;
      /**
       * Override the default retention for jobs whose PAYLOAD is the sensitive
       * part rather than the outcome.
       *
       * The defaults keep completed jobs for a day and failed ones for a week,
       * which is right for a thank-you email and wrong for a sign-in code: that
       * payload is a credential, and leaving it readable in Redis for a week
       * outlives the ten minutes it is valid for by rather a lot.
       */
      removeOnComplete?: boolean | { age: number; count?: number };
      removeOnFail?: boolean | { age: number; count?: number };
    } = {},
  ): Promise<string | undefined> {
    const job = await this.queueFor(name).add(jobName, data, {
      ...(options.jobId ? { jobId: options.jobId } : {}),
      ...(options.delayMs ? { delay: options.delayMs } : {}),
      ...(options.removeOnComplete !== undefined
        ? { removeOnComplete: options.removeOnComplete }
        : {}),
      ...(options.removeOnFail !== undefined ? { removeOnFail: options.removeOnFail } : {}),
    });

    this.logger.debug({ queue: name, jobName, jobId: job.id }, 'Job enqueued');
    return job.id;
  }

  /** Depth per queue, for the health endpoint and the admin dashboard. */
  async counts(name: QueueName) {
    return this.queueFor(name).getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
