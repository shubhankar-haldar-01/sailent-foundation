import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';

import {
  processExampleJob,
  type ExampleJobData,
  type ExampleJobResult,
} from './example.processor.js';
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from '../queues/index.js';

const logger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as never;

function createJob(data: ExampleJobData): Job<ExampleJobData, ExampleJobResult> {
  return {
    id: 'job-1',
    data,
    attemptsMade: 0,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<ExampleJobData, ExampleJobResult>;
}

describe('processExampleJob', () => {
  it('returns a result and reports progress', async () => {
    const job = createJob({ message: 'hello', enqueuedAt: new Date().toISOString() });

    const result = await processExampleJob(job, logger);

    expect(result.echoed).toBe('hello');
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('is idempotent — running twice produces the same outcome', async () => {
    // At-least-once is the only guarantee a retrying queue provides, so every
    // processor must be safe to run again. This is a property later phases
    // depend on for webhook and receipt jobs.
    const data = { message: 'hello', enqueuedAt: new Date().toISOString() };

    const first = await processExampleJob(createJob(data), logger);
    const second = await processExampleJob(createJob(data), logger);

    expect(first.echoed).toBe(second.echoed);
  });
});

describe('queue configuration', () => {
  it('retries with exponential backoff rather than hammering a failing dependency', () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBeGreaterThan(1);
    expect(DEFAULT_JOB_OPTIONS.backoff.type).toBe('exponential');
  });

  it('keeps failed jobs longer than completed ones, for debugging', () => {
    expect(DEFAULT_JOB_OPTIONS.removeOnFail.age).toBeGreaterThan(
      DEFAULT_JOB_OPTIONS.removeOnComplete.age,
    );
  });

  it('declares the queue names the API enqueues to', () => {
    // A name that differs between the API and the worker produces jobs nobody
    // consumes, with no error anywhere. This asserts the two lists agree.
    expect(Object.values(QUEUE_NAMES)).toEqual([
      'example',
      'email',
      'notifications',
      'reports',
      'payments',
      'cleanup',
    ]);
  });
});
