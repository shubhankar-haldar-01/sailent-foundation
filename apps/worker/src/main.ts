import { createServer } from 'node:http';

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

import { createErrorReporter, describeError, loadEnv, workerEnvSchema } from '@sailent/config';
import { loadRootEnvFile } from '@sailent/config/dotenv';

import { createHealthHandler } from './lib/health.js';
import { createLogger } from './lib/logger.js';
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from './queues/index.js';
import {
  processExampleJob,
  type ExampleJobData,
  type ExampleJobResult,
} from './processors/example.processor.js';
import {
  processDonationConfirmation,
  type DonationConfirmationJob,
} from './processors/donation-confirmation.processor.js';
import {
  processDonorLoginCode,
  type DonorLoginCodeJob,
} from './processors/donor-login-code.processor.js';
import {
  processEventCancelled,
  processEventRegistrationConfirmed,
  type EventCancelledJob,
  type EventRegistrationConfirmedJob,
} from './processors/event-notifications.processor.js';
import {
  PAYMENT_RECONCILE_JOB,
  PAYMENT_RECONCILE_SCHEDULER,
  processPaymentReconciliation,
  type PaymentReconciliationJob,
} from './processors/payment-reconciliation.processor.js';
import {
  processVolunteerApplication,
  processVolunteerAssigned,
  processVolunteerCertificate,
  processVolunteerDecision,
  type VolunteerApplicationJob,
  type VolunteerAssignedJob,
  type VolunteerCertificateJob,
  type VolunteerDecisionJob,
} from './processors/volunteer-notifications.processor.js';
import {
  processContactReceived,
  processNewsletterConfirm,
  processStaffInvite,
  processStaffPasswordReset,
  type ContactReceivedJob,
  type NewsletterConfirmJob,
  type StaffTokenJob,
} from './processors/communications.processor.js';
import {
  announceConnection,
  assertRuntimeDatabaseTarget,
  createDatabaseClient,
  describeRuntimeTarget,
} from '@sailent/database';

/**
 * Worker bootstrap.
 *
 * Runs as a separate process from the API deliberately (docs/architecture.md §2):
 * receipt rendering is CPU-heavy, email depends on a third party that will
 * occasionally be slow, and reconciliation scans thousands of rows. If any of
 * those shared a process with the donation endpoint, a Brevo outage or a large
 * PDF would degrade the one path that must never degrade.
 */

// In production the platform injects environment variables and this is a no-op.
loadRootEnvFile();

const env = loadEnv(workerEnvSchema, 'worker');
const logger = createLogger(env);

/*
  Error tracking (Phase 14): Sentry-compatible, scrubbed, OFF unless
  SENTRY_DSN is set. Reports jobs that failed on every attempt and crashes —
  never job data, which can hold tokens and addresses.
*/
const errorReporter = createErrorReporter({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT ?? env.APP_ENV,
  release: env.SENTRY_RELEASE,
  service: 'sailent-worker',
});

/** A job that has used its last attempt: logged at error and reported. */
function reportExhausted(queue: string, job: Job | undefined, error: Error): void {
  errorReporter.capture(error, {
    tags: { queue, jobName: job?.name, attempts: job?.attemptsMade },
  });
}

// BullMQ requires this setting on its blocking connection.
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
});

connection.on('error', (error: Error) => {
  logger.error({ err: error.message }, 'Redis connection error');
});

/**
 * The worker's own database connection.
 *
 * Small on purpose. This process reads a donation and writes a notification —
 * it is not the API, and a generous pool here competes with the one that
 * serves donors for the same Postgres connection slots.
 */
/*
  The same `APP_ENV` / `DATABASE_URL` agreement check the API makes, for the
  same reason and before the same kind of pool. The worker WRITES — receipts,
  notifications, reconciliation — so a worker pointed at the wrong database is
  not a read that shows stale data, it is rows created in the wrong place.
*/
const target = assertRuntimeDatabaseTarget({
  appEnv: env.APP_ENV,
  connectionString: env.DATABASE_URL,
});
logger.info({ target: describeRuntimeTarget(target, env.APP_ENV) }, 'database target checked');

const database = createDatabaseClient({ connectionString: env.DATABASE_URL, maxConnections: 4 });

/*
  The worker logged NOTHING about its database, which made a misconfigured one
  look like "jobs are not running" rather than "the worker cannot reach
  Postgres". Same report the API prints, same reasoning — see `announce.ts`.
*/
void announceConnection(database, {
  info: (message) => logger.info(message),
  warn: (message) => logger.warn(message),
  error: (message) => logger.error(message),
});

const brevo = {
  apiKey: env.BREVO_API_KEY,
  senderEmail: env.BREVO_SENDER_EMAIL,
  senderName: env.BREVO_SENDER_NAME,
};

const exampleQueue = new Queue<ExampleJobData, ExampleJobResult>(QUEUE_NAMES.EXAMPLE, {
  connection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

const exampleWorker = new Worker<ExampleJobData, ExampleJobResult>(
  QUEUE_NAMES.EXAMPLE,
  (job: Job<ExampleJobData, ExampleJobResult>) => processExampleJob(job, logger),
  { connection, concurrency: env.WORKER_CONCURRENCY },
);

exampleWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id, queue: QUEUE_NAMES.EXAMPLE }, 'Job completed');
});

exampleWorker.on('failed', (job, error) => {
  // A job that has exhausted its attempts is an operational event, not noise:
  // in later phases this is where a dead-lettered webhook raises an alert.
  const exhausted = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : false;
  logger[exhausted ? 'error' : 'warn'](
    {
      jobId: job?.id,
      queue: QUEUE_NAMES.EXAMPLE,
      attempt: job?.attemptsMade,
      err: describeError(error),
    },
    exhausted ? 'Job failed permanently — dead-lettered' : 'Job failed, will retry',
  );
  if (exhausted) reportExhausted(QUEUE_NAMES.EXAMPLE, job, error);
});

/**
 * The EMAIL queue.
 *
 * One worker for every transactional email, dispatched by job name. Concurrency is
 * deliberately lower than the general setting — Brevo rate-limits, and a burst
 * of parallel sends after a busy hour achieves nothing but 429s and retries.
 *
 * Every job here is SAFE TO REPEAT. The capture enqueues with the receipt
 * number as the job id, so a retried capture cannot create a second thank-you,
 * and the processor re-checks the donation status before sending anything.
 */
const emailWorker = new Worker<
  | DonationConfirmationJob
  | DonorLoginCodeJob
  | EventRegistrationConfirmedJob
  | EventCancelledJob
  | VolunteerApplicationJob
  | VolunteerDecisionJob
  | VolunteerAssignedJob
  | VolunteerCertificateJob
  | ContactReceivedJob
  | NewsletterConfirmJob
  | StaffTokenJob
>(
  QUEUE_NAMES.EMAIL,
  (job) => {
    /*
      Dispatched BY JOB NAME, not by inspecting the payload.

      The queue carries more than one kind of message now, and guessing from the
      shape of the data would mean a job with an unexpected payload silently
      running the wrong handler. An unknown name is an error the queue will
      retry and then surface, which is the failure we want.
    */
    switch (job.name) {
      case 'donation.confirmation':
        return processDonationConfirmation(
          job as Job<DonationConfirmationJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      case 'donor.login_code':
        return processDonorLoginCode(
          job as Job<DonorLoginCodeJob>,
          { brevo, appUrl: env.APP_PUBLIC_URL, database },
          logger,
        );
      case 'event.registration.confirmed':
        return processEventRegistrationConfirmed(
          job as Job<EventRegistrationConfirmedJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      case 'event.cancelled':
        return processEventCancelled(
          job as Job<EventCancelledJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      case 'volunteer.application.received':
        return processVolunteerApplication(
          job as Job<VolunteerApplicationJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      /*
        Approval and rejection share a processor and differ by one argument.
        The alternative — two near-identical functions — is two places for the
        "re-read the state before sending" guard to drift out of step.
      */
      case 'volunteer.approved':
        return processVolunteerDecision(
          job as Job<VolunteerDecisionJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
          'approved',
        );
      case 'volunteer.rejected':
        return processVolunteerDecision(
          job as Job<VolunteerDecisionJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
          'rejected',
        );
      case 'volunteer.assigned':
        return processVolunteerAssigned(
          job as Job<VolunteerAssignedJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      case 'volunteer.certificate.issued':
        return processVolunteerCertificate(
          job as Job<VolunteerCertificateJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      // Phase 13: contact messages, newsletter confirmation, staff accounts.
      case 'contact.received':
        return processContactReceived(
          job as Job<ContactReceivedJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      case 'newsletter.confirm':
        return processNewsletterConfirm(
          job as Job<NewsletterConfirmJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      case 'staff.invite':
        return processStaffInvite(
          job as Job<StaffTokenJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      case 'staff.password_reset':
        return processStaffPasswordReset(
          job as Job<StaffTokenJob>,
          { database, brevo, appUrl: env.APP_PUBLIC_URL },
          logger,
        );
      default:
        throw new Error(`Unknown email job: ${job.name}`);
    }
  },
  { connection, concurrency: Math.min(env.WORKER_CONCURRENCY, 4) },
);

emailWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id, queue: QUEUE_NAMES.EMAIL }, 'Job completed');
});

emailWorker.on('failed', (job, error) => {
  const exhausted = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : false;
  // Named by job, because the queue now carries more than one kind and
  // "donation confirmation failed" on a sign-in code would send whoever reads
  // this log looking in the wrong place.
  logger[exhausted ? 'error' : 'warn'](
    {
      jobId: job?.id,
      jobName: job?.name,
      queue: QUEUE_NAMES.EMAIL,
      attempt: job?.attemptsMade,
      err: describeError(error),
    },
    exhausted
      ? `Email job ${job?.name ?? 'unknown'} failed permanently — somebody is waiting for it`
      : `Email job ${job?.name ?? 'unknown'} failed, will retry`,
  );
  if (exhausted) reportExhausted(QUEUE_NAMES.EMAIL, job, error);
});

/**
 * The PAYMENTS queue — reconciliation (Phase 11).
 *
 * A repeatable job every `PAYMENT_RECONCILE_INTERVAL_MS` (ten minutes by
 * default) asks the API to reconcile pending donations against Razorpay and
 * expire the ones nobody paid for. BullMQ keeps ONE schedule under a fixed id,
 * so starting several workers does not multiply the runs, and concurrency 1
 * means two runs never overlap on one worker.
 *
 * Without `API_INTERNAL_URL` and `INTERNAL_API_SECRET` (both required in
 * production) the schedule is removed and the worker says so: reconciliation
 * then does not run at all, which is visible, rather than failing every ten
 * minutes, which is noise.
 */
const paymentsQueue = new Queue<PaymentReconciliationJob>(QUEUE_NAMES.PAYMENTS, {
  connection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

const reconciliationConfigured = Boolean(env.INTERNAL_API_SECRET);
const reconciliationApiUrl = env.API_INTERNAL_URL ?? 'http://localhost:4000';

const paymentsWorker = new Worker<PaymentReconciliationJob>(
  QUEUE_NAMES.PAYMENTS,
  (job) => {
    if (job.name !== PAYMENT_RECONCILE_JOB) {
      throw new Error(`Unknown payments job: ${job.name}`);
    }
    if (!env.INTERNAL_API_SECRET) {
      throw new Error('Reconciliation is not configured (INTERNAL_API_SECRET is unset)');
    }
    return processPaymentReconciliation(
      job,
      { apiUrl: reconciliationApiUrl, secret: env.INTERNAL_API_SECRET },
      logger,
    );
  },
  { connection, concurrency: 1 },
);

paymentsWorker.on('failed', (job, error) => {
  const exhausted = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : false;
  logger[exhausted ? 'error' : 'warn'](
    {
      jobId: job?.id,
      queue: QUEUE_NAMES.PAYMENTS,
      attempt: job?.attemptsMade,
      err: describeError(error),
    },
    exhausted
      ? 'Payment reconciliation failed on every attempt — pending donations are not being settled'
      : 'Payment reconciliation failed, will retry',
  );
  if (exhausted) reportExhausted(QUEUE_NAMES.PAYMENTS, job, error);
});

/*
  A worker that loses Redis emits 'error' and keeps retrying the connection
  (ioredis). Logged so the outage is visible; not reported per occurrence,
  which during an outage would be thousands of identical events (Phase 14).
*/
for (const [queue, worker] of [
  [QUEUE_NAMES.EXAMPLE, exampleWorker],
  [QUEUE_NAMES.EMAIL, emailWorker],
  [QUEUE_NAMES.PAYMENTS, paymentsWorker],
] as const) {
  worker.on('error', (error) => logger.error({ queue, err: describeError(error) }, 'Worker error'));
}

void (async () => {
  try {
    if (reconciliationConfigured) {
      await paymentsQueue.upsertJobScheduler(
        PAYMENT_RECONCILE_SCHEDULER,
        { every: env.PAYMENT_RECONCILE_INTERVAL_MS },
        { name: PAYMENT_RECONCILE_JOB, data: {} },
      );
      logger.info(
        { everyMs: env.PAYMENT_RECONCILE_INTERVAL_MS },
        'Payment reconciliation scheduled',
      );
    } else {
      await paymentsQueue.removeJobScheduler(PAYMENT_RECONCILE_SCHEDULER);
      logger.warn(
        'Payment reconciliation is NOT scheduled: set INTERNAL_API_SECRET (and API_INTERNAL_URL) to enable it',
      );
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : error },
      'Could not register the payment reconciliation schedule',
    );
  }
})();

/**
 * Health endpoint.
 *
 * A worker with no HTTP surface is invisible to a platform health check and
 * gets restarted on a schedule instead of on a signal. Cloud Run also requires
 * every service to listen on `PORT` (Phase 14): `/health` is the liveness
 * probe and `/ready` the startup probe (`lib/health.ts`).
 */
const server = createServer(
  createHealthHandler({
    service: 'sailent-worker',
    environment: env.APP_ENV,
    queues: Object.values(QUEUE_NAMES),
    checks: {
      redis: () => connection.ping(),
      database: () => database.ping(),
    },
    onCheckFailed: (name, error) =>
      logger.warn({ check: name, err: describeError(error) }, 'Readiness check failed'),
  }),
);

/*
  Cloud Run gives the port in `PORT` (Phase 14) and requires listening on all
  interfaces; locally WORKER_PORT (4001) applies.
*/
const healthPort = env.PORT ?? env.WORKER_PORT;
server.listen(healthPort, '0.0.0.0', () => {
  logger.info(
    {
      port: healthPort,
      concurrency: env.WORKER_CONCURRENCY,
      queues: Object.values(QUEUE_NAMES),
      errorReporting: errorReporter.enabled,
    },
    'Worker started',
  );
});

/**
 * Graceful shutdown.
 *
 * `worker.close()` waits for in-flight jobs to finish rather than killing them
 * mid-execution. Once real jobs exist, a job killed halfway is a receipt that
 * was never sent or a webhook that was never applied — so getting this right
 * now costs nothing and matters later.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down…');

  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out after 30s, forcing exit');
    process.exit(1);
  }, 30_000);

  try {
    server.close();
    await emailWorker.close();
    await paymentsWorker.close();
    await paymentsQueue.close();
    await exampleWorker.close();
    await exampleQueue.close();
    await database.close();
    await connection.quit();
    // Error reports still in flight are sent before exit (Phase 14).
    await errorReporter.flush();
    clearTimeout(timeout);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    logger.error({ err: error instanceof Error ? error.message : error }, 'Shutdown failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: describeError(reason) }, 'Unhandled rejection');
  errorReporter.capture(reason, { tags: { kind: 'unhandledRejection' } });
});

/*
  A crash is reported before the process dies (Phase 14). Exiting is still
  right: state after an uncaught exception cannot be trusted, and Cloud Run
  starts a fresh instance.
*/
process.on('uncaughtException', (error) => {
  logger.fatal({ err: describeError(error) }, 'Uncaught exception — exiting');
  errorReporter.capture(error, { tags: { kind: 'uncaughtException' } });
  void errorReporter.flush().finally(() => process.exit(1));
});

export { exampleQueue };
