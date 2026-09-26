import type { Job } from 'bullmq';

import type { Logger } from '../lib/logger.js';

export interface ExampleJobData {
  message: string;
  enqueuedAt: string;
}

export interface ExampleJobResult {
  processedAt: string;
  echoed: string;
}

/**
 * Example processor.
 *
 * Exists solely to prove the worker pipeline — Redis connection, queue
 * registration, job dispatch, result handling, graceful shutdown — before any
 * real job depends on it. It has no business meaning and is removed in Phase 5
 * when the first real queue (webhooks) lands.
 */
export async function processExampleJob(
  job: Job<ExampleJobData, ExampleJobResult>,
  logger: Logger,
): Promise<ExampleJobResult> {
  logger.info({ jobId: job.id, attempt: job.attemptsMade + 1 }, 'Processing example job');

  await job.updateProgress(50);

  const result: ExampleJobResult = {
    processedAt: new Date().toISOString(),
    echoed: job.data.message,
  };

  await job.updateProgress(100);
  logger.info({ jobId: job.id }, 'Example job complete');

  return result;
}
