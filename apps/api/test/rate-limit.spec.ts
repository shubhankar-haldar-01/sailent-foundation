import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import { RedisService } from '../src/modules/redis/redis.service.js';
import { PREFIX, createTestApp, errorCode, type Envelope } from './harness.js';

/**
 * Rate limiting, with the real limiter left in place.
 *
 * Every other suite replaces the throttler's storage, because a suite that
 * exercises authorization needs more sessions than five a minute. That makes
 * this file the only place the limits are actually proven — so it is the one
 * that must not be skipped.
 */
describe('Rate limiting (integration)', () => {
  let app: INestApplication;
  let server: unknown;

  beforeAll(async () => {
    app = await createTestApp({ throttling: true });
    server = app.getHttpServer();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('caps staff login attempts, so a password spray is throttled', async () => {
    // The limit is on the ENDPOINT as well as per account, so spraying one
    // password across many accounts is throttled too — that is the attack that
    // per-account limits miss entirely.
    const attempt = (index: number) =>
      request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: `sprayed-${index}@sailent.local`, password: 'Password123!' });

    const statuses: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      statuses.push((await attempt(index)).status);
    }

    expect(statuses).toContain(429);
    // The first few must NOT be throttled, or the limit is set too tight to
    // let a person who mistyped their password try again.
    expect(statuses.slice(0, 3).every((status) => status === 401)).toBe(true);
  });

  it('answers a throttled request in the standard envelope, with no framework wording', async () => {
    // Sequential, not Promise.all: supertest binds an ephemeral port per call,
    // and firing a dozen at once resets connections rather than exercising the
    // limiter — the failure looks like a rate-limit bug and is a test bug.
    let throttled: Awaited<ReturnType<typeof request>> | undefined;
    for (let index = 0; index < 12 && !throttled; index += 1) {
      const response = await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: 'flood@sailent.local', password: 'Password123!' });
      if (response.status === 429) throttled = response as never;
    }

    expect(throttled).toBeDefined();

    const body = throttled!.body as Envelope;
    expect(errorCode(body)).toBe('RATE_LIMITED');
    // "ThrottlerException: Too Many Requests" is accurate and useless: a donor
    // does not know what a throttler is, and the class name is ours to keep.
    expect(body.error?.message).not.toMatch(/Exception|Throttler/);
    expect(body.error?.message).toMatch(/too many requests/i);
    expect(body.error?.requestId).toBeTruthy();
  });

  it('sets the standard rate-limit headers so a client can back off politely', async () => {
    const response = await request(server)
      .post(`${PREFIX}/auth/donor/otp/request`)
      .send({ email: 'rate-limit-headers@example.test' });

    expect(response.headers['x-ratelimit-limit']).toBeTruthy();
    expect(response.headers['x-ratelimit-remaining']).toBeTruthy();
  });

  it('caps OTP requests per address in the service, independently of the HTTP limiter', async () => {
    // Defence in depth: the HTTP limiter counts per IP, so it does nothing
    // against a distributed attempt to flood ONE person's inbox with codes.
    const email = 'rate-limit-flood@example.test';
    const database = app.get<{ db: { execute(query: unknown): Promise<unknown> } }>(DATABASE);
    await database.db.execute(sql`DELETE FROM otp_codes WHERE identifier = ${email}`);

    const statuses: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      statuses.push(
        (await request(server).post(`${PREFIX}/auth/donor/otp/request`).send({ email })).status,
      );
    }

    expect(statuses).toContain(429);
    await database.db.execute(sql`DELETE FROM otp_codes WHERE identifier = ${email}`);
  });

  it('does not throttle ordinary public reads at a browsing rate', async () => {
    // A rate limit that fires while a person reads three campaign pages is a
    // bug, not a control.
    const statuses: number[] = [];
    for (let index = 0; index < 15; index += 1) {
      statuses.push((await request(server).get(`${PREFIX}/campaigns`)).status);
    }

    expect(statuses.every((status) => status === 200)).toBe(true);
  });
  /**
   * Where the counters actually live.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * The tests above proved the LIMITS. They passed just as well when every
   * counter sat in a per-process Map, which meant a second API instance
   * silently doubled every one of them and nothing reported it.
   *
   * These two assert the storage, because that is the part that was wrong and
   * the part no behavioural test can see from one process.
   * ══════════════════════════════════════════════════════════════════════════
   */
  describe('counters are shared, not per-process', () => {
    it('writes the limiter state to REDIS', async () => {
      const redis = app.get(RedisService).getClient();
      await redis.del(...(await redis.keys('throttle:*')).slice(0, 1000));

      await request(server)
        .post(`${PREFIX}/auth/staff/login`)
        .send({ email: 'storage-probe@sailent.local', password: 'Password123!' });

      const keys = await redis.keys('throttle:*');
      // With the in-process Map this array is empty however many requests run.
      expect(keys.length).toBeGreaterThan(0);
    });

    it('keeps the throttler namespace clear of BullMQ keys', async () => {
      // One Redis serves queues and limits. A collision would either lose a job
      // or lift a limit, and neither would be obvious.
      const redis = app.get(RedisService).getClient();
      const keys = await redis.keys('throttle:*');
      expect(keys.every((key) => !key.includes('bull'))).toBe(true);
    });
  });
});
