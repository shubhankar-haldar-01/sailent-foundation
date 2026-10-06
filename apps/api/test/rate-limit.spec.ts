import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import { RedisService } from '../src/modules/redis/redis.service.js';
import { CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

import { PREFIX, createTestApp, errorCode, type Envelope } from './harness.js';

// Phase 11: the secret the web server presents with a client's address. Set
// before the app is built, because the API reads its config at startup.
const INTERNAL_SECRET = 'internal-secret-for-rate-limit-tests-0123456789';
process.env.INTERNAL_API_SECRET = INTERNAL_SECRET;

/** A documentation-range address, random per run so counters from a previous run cannot interfere. */
function randomClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
}

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
   * PER-CLIENT LIMITS (Phase 11).
   *
   * Every browser request arrives through the web server, so the API used to
   * see one address for everybody and every limit was site-wide. The web
   * server now sends the real client address with the internal secret; with
   * the secret, each client has its own bucket, and without it the address is
   * ignored — so forging the header (or X-Forwarded-For) buys nothing.
   */
  describe('limits apply per real client', () => {
    const asClient = (call: request.Test, ip: string) =>
      call.set(INTERNAL_AUTH_HEADER, INTERNAL_SECRET).set(CLIENT_IP_HEADER, ip);

    afterAll(async () => {
      // The sign-in codes the OTP test requested for its throwaway addresses.
      const database = app.get<{ db: { execute(query: unknown): Promise<unknown> } }>(DATABASE);
      await database.db.execute(
        sql`DELETE FROM otp_codes WHERE identifier LIKE 'per-client-%@example.test'`,
      );
    });

    // An empty body: 422 until the limit, 429 after — nothing is created.
    const startDonation = () => request(server).post(`${PREFIX}/donations`).send({});

    it('limits one client without limiting another', async () => {
      const clientA = randomClientIp();
      const clientB = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

      const statusesA: number[] = [];
      for (let index = 0; index < 11; index += 1) {
        statusesA.push((await asClient(startDonation(), clientA)).status);
      }
      // Ten donation starts a minute: the first ten pass the limiter, the
      // eleventh is refused.
      expect(statusesA.slice(0, 10).every((status) => status !== 429)).toBe(true);
      expect(statusesA[10]).toBe(429);

      // Client B is somebody else, with their own allowance.
      expect((await asClient(startDonation(), clientB)).status).not.toBe(429);
    });

    it('does not let a forged address escape the limit without the secret', async () => {
      // A new spoofed address on every request, in both our header and
      // X-Forwarded-For, but no secret: all of it is ignored and every request
      // counts against the one connecting address.
      const statuses: number[] = [];
      for (let index = 0; index < 12; index += 1) {
        const spoofed = `192.0.2.${index + 1}`;
        statuses.push(
          (
            await startDonation()
              .set(CLIENT_IP_HEADER, spoofed)
              .set(INTERNAL_AUTH_HEADER, 'not-the-secret')
              .set('X-Forwarded-For', spoofed)
          ).status,
        );
      }
      expect(statuses).toContain(429);
    });

    it('limits sign-in codes per client, not for everyone at once', async () => {
      const clientC = randomClientIp();
      const request_ = () =>
        asClient(
          request(server)
            .post(`${PREFIX}/auth/donor/otp/request`)
            .send({ email: `per-client-${Math.random().toString(36).slice(2)}@example.test` }),
          clientC,
        );

      const statuses: number[] = [];
      for (let index = 0; index < 4; index += 1) statuses.push((await request_()).status);
      // Three codes per fifteen minutes per client, unchanged.
      expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
      expect(statuses[3]).toBe(429);

      // Another client can still ask for a code.
      const otherClient = await asClient(
        request(server)
          .post(`${PREFIX}/auth/donor/otp/request`)
          .send({ email: `per-client-other-${Math.random().toString(36).slice(2)}@example.test` }),
        `203.0.113.${Math.floor(Math.random() * 250) + 1}`,
      );
      expect(otherClient.status).not.toBe(429);
    });
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
