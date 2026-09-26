import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadRootEnvFile } from '@sailent/config/dotenv';

import { RedisThrottlerStorage } from './redis-throttler.storage.js';
import type { RedisService } from './redis.service.js';

/**
 * The rate limiter's storage.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ONE ASSERTION THAT MATTERS IS "TWO INSTANCES SHARE A COUNTER".
 *
 * Everything else here could pass with the in-process Map this replaces. The
 * bug being fixed is not that counting was wrong — it was exactly right, once
 * per process. It is that staff sign-in allowed five attempts a minute PER
 * INSTANCE, and nothing anywhere reported that the number had been multiplied.
 *
 * So the test constructs two storages over one Redis, which is what two API
 * processes behind a load balancer are, and asserts they count as one.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Runs against `TEST_REDIS_URL` (db 1), never the application's Redis — the
 * suites write and delete keys.
 */

loadRootEnvFile();

const REDIS_URL = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;

describe.skipIf(!REDIS_URL)('RedisThrottlerStorage', () => {
  let client: Redis;
  let storage: RedisThrottlerStorage;

  /** The real class takes a `RedisService`; only `getClient` is used. */
  const serviceFor = (redis: Redis) => ({ getClient: () => redis }) as unknown as RedisService;

  let key = '';

  beforeAll(() => {
    client = new Redis(REDIS_URL!, { maxRetriesPerRequest: 1 });
    storage = new RedisThrottlerStorage(serviceFor(client));
  });

  beforeEach(async () => {
    // A fresh key per test: these are counters, and a leaked one from an
    // earlier test reads as an off-by-one in this one.
    key = `spec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.del(`throttle:default:${key}`, `throttle:default:${key}:blocked`);
  });

  afterAll(async () => {
    const keys = await client.keys('throttle:default:spec-*');
    if (keys.length > 0) await client.del(...keys);
    await client.quit();
  });

  it('counts hits, and reports the window in SECONDS', async () => {
    const first = await storage.increment(key, 60_000, 5, 60_000, 'default');
    expect(first.totalHits).toBe(1);
    expect(first.isBlocked).toBe(false);
    // The guard puts this in `X-RateLimit-Reset`, which is seconds, not ms.
    expect(first.timeToExpire).toBeGreaterThan(0);
    expect(first.timeToExpire).toBeLessThanOrEqual(60);

    const second = await storage.increment(key, 60_000, 5, 60_000, 'default');
    expect(second.totalHits).toBe(2);
  });

  it('SHARES the counter between two storages over one Redis', async () => {
    // Two API processes behind a load balancer. This is the whole point.
    const instanceA = new RedisThrottlerStorage(serviceFor(client));
    const instanceB = new RedisThrottlerStorage(serviceFor(client));

    await instanceA.increment(key, 60_000, 5, 60_000, 'default');
    await instanceB.increment(key, 60_000, 5, 60_000, 'default');
    const third = await instanceA.increment(key, 60_000, 5, 60_000, 'default');

    // Three, not "two on one instance and one on the other". With the
    // in-process Map this was 2 and 1, and staff login allowed ten a minute.
    expect(third.totalHits).toBe(3);
  });

  it('blocks once the limit is passed', async () => {
    // `blockDuration` is `ttl` here because that is what `ThrottlerGuard`
    // resolves — `blockDuration || ttl` — and nothing in this application sets
    // it explicitly. Passing 0 would test a call the guard never makes.
    for (let hit = 0; hit < 3; hit += 1) {
      const record = await storage.increment(key, 60_000, 3, 60_000, 'default');
      expect(record.isBlocked, `hit ${hit + 1} of 3`).toBe(false);
    }

    const over = await storage.increment(key, 60_000, 3, 60_000, 'default');
    expect(over.totalHits).toBe(4);
    expect(over.isBlocked).toBe(true);
  });

  it('keeps a block alive past the counting window when blockDuration is longer', async () => {
    /*
      The block marker is a separate Redis key, and this is why. Folding it
      into the counter would either end the block when the window rolls — so a
      blocked caller is released early — or hold the window open for the length
      of the block, turning a fixed window into something else.
    */
    await storage.increment(key, 1_000, 1, 0, 'default');
    const blocked = await storage.increment(key, 1_000, 1, 30_000, 'default');

    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(1);

    const ttls = await client.pttl(`throttle:default:${key}:blocked`);
    expect(ttls).toBeGreaterThan(1_000);
  });

  it('expires the window, so a limit is a WINDOW and not a lifetime ban', async () => {
    await storage.increment(key, 300, 5, 300, 'default');
    await new Promise((resolve) => setTimeout(resolve, 450));

    const afterWindow = await storage.increment(key, 300, 5, 300, 'default');
    expect(afterWindow.totalHits).toBe(1);
  });

  it('always leaves an expiry on the counter', async () => {
    // A counter with no TTL counts forever and locks somebody out permanently.
    await storage.increment(key, 60_000, 5, 60_000, 'default');
    expect(await client.pttl(`throttle:default:${key}`)).toBeGreaterThan(0);
  });

  it('namespaces its keys, so a shared Redis cannot collide with BullMQ', async () => {
    await storage.increment(key, 60_000, 5, 60_000, 'default');
    expect(await client.exists(`throttle:default:${key}`)).toBe(1);
  });

  it('counts separate throttler names separately', async () => {
    await storage.increment(key, 60_000, 5, 60_000, 'default');
    const other = await storage.increment(key, 60_000, 5, 60_000, 'strict');
    expect(other.totalHits).toBe(1);
  });

  it('DEGRADES to per-instance counting when Redis is unreachable', async () => {
    /*
      ══════════════════════════════════════════════════════════════════════
      Not fail-open, and not a 500.

      Failing open would remove rate limiting from sign-in, OTP and the public
      volunteer application at exactly the moment infrastructure is unhealthy,
      and nothing outside could tell. Failing closed would turn a Redis blip
      into a total outage, contradicting `RedisService`, which logs connection
      errors on the stated grounds that a blip must not take the API down.

      So it falls back to counting in memory: still enforced, multiplied by
      instance count — which is precisely the behaviour this system shipped
      with until today, and therefore a known quantity rather than a surprise.
      ══════════════════════════════════════════════════════════════════════
    */
    const dead = new Redis('redis://127.0.0.1:6', {
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });
    dead.on('error', () => undefined);

    const offline = new RedisThrottlerStorage(serviceFor(dead));

    const first = await offline.increment(key, 60_000, 2, 60_000, 'default');
    const second = await offline.increment(key, 60_000, 2, 60_000, 'default');
    const third = await offline.increment(key, 60_000, 2, 60_000, 'default');

    // Counting continued rather than resetting to 1 or throwing.
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    // And the limit is STILL enforced on the way down.
    expect(third.isBlocked).toBe(true);

    dead.disconnect();
  });
});
