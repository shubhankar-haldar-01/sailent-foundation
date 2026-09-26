import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';

import { RedisService } from './redis.service.js';

/**
 * Rate-limit counters in Redis, shared by every API instance.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS.
 *
 * `ThrottlerModule` defaults to an in-process Map, so every limit is PER
 * INSTANCE. Two API processes behind a load balancer means staff sign-in
 * allows ten attempts a minute rather than five, and the volunteer application
 * endpoint six an hour rather than three. The limits are not wrong — they are
 * silently multiplied by however many instances happen to be running, which is
 * the worst property a security control can have, because nothing reports it.
 *
 * It was carried as a known gap since Phase 7 and became load-bearing in Phase
 * 8, which added a public unauthenticated write (volunteer application) to the
 * endpoints that depend on it.
 *
 * NO NEW DEPENDENCY. `app.module.ts` already recorded the choice: "a
 * third-party storage package, or ~40 lines implementing the interface". This
 * is the second, reusing the `ioredis` connection the app already holds — the
 * same reasoning that made `TotpService` thirty lines of `node:crypto` rather
 * than a supply-chain surface bought for a well-specified algorithm.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * COUNTING IS ATOMIC. The whole increment-and-expire is one Lua script, so two
 * instances incrementing the same key at the same moment cannot both read the
 * pre-increment value. A read-then-write from the application would let a
 * flood through precisely when a flood is happening.
 *
 * TTLs are milliseconds throughout, because that is what `@nestjs/throttler`
 * v6 hands over and what it expects back.
 */

/**
 * INCR, set the window on first hit, and block once the limit is passed.
 *
 * KEYS[1] the hit counter · KEYS[2] the block marker
 * ARGV[1] ttl ms · ARGV[2] limit · ARGV[3] blockDuration ms
 *
 * Returns { totalHits, timeToExpire ms, isBlocked, timeToBlockExpire ms }.
 *
 * The block marker is a SEPARATE key on purpose. A block usually outlives the
 * counting window — `blockDuration` may be longer than `ttl` — and folding the
 * two into one key would either cut the block short when the window rolls or
 * hold the window open for the length of the block, quietly turning a fixed
 * window into something else.
 */
const INCREMENT = `
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), blocked, 1, blocked }
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  -- A key with no expiry would count forever. Should not happen; costs nothing
  -- to repair, and the failure mode if it did would be a permanent lockout.
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

if hits > tonumber(ARGV[2]) then
  local block = tonumber(ARGV[3])
  if block > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', block)
    -- Carry the COUNTER to the same expiry as the block.
    --
    -- Otherwise, where a block is shorter than the window, the block lapses
    -- while the counter is still above the limit and the caller is re-blocked
    -- on their very next request — a rolling lockout they can never leave.
    -- The in-memory storage this replaces avoids that by resetting the count
    -- when a block expires; matching it with one PEXPIRE is simpler than
    -- reproducing the reset, and gives the same observable behaviour.
    --
    -- With the default blockDuration = ttl the two already coincide, so this
    -- changes nothing for the limits this application actually configures.
    if block > ttl then
      redis.call('PEXPIRE', KEYS[1], block)
      ttl = block
    end
    return { hits, ttl, 1, block }
  end
  return { hits, ttl, 1, ttl }
end

return { hits, ttl, 0, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  /**
   * THE FALLBACK IS IN-MEMORY COUNTING, NOT AN OPEN DOOR.
   *
   * ════════════════════════════════════════════════════════════════════════
   * If Redis is unreachable there are three options and only one is defensible.
   *
   * Failing OPEN removes rate limiting entirely at the moment infrastructure
   * is already unhealthy — sign-in, OTP and the public application endpoint
   * all become unlimited, and nothing on the outside can tell.
   *
   * Failing CLOSED turns a Redis blip into a total outage. It also contradicts
   * `RedisService`, which logs connection errors rather than throwing on the
   * stated grounds that "a Redis blip must not take the API down".
   *
   * So it degrades to the behaviour this application had until now: per-
   * instance counting. Limits are still enforced, multiplied by the number of
   * instances — worse than shared, far better than absent, and the same
   * property the system shipped with. It is logged at `error` so the
   * degradation is visible rather than inferred.
   * ════════════════════════════════════════════════════════════════════════
   */
  private readonly fallback = new ThrottlerStorageService();
  private degraded = false;

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // Namespaced so these cannot collide with BullMQ's keys on a shared Redis,
    // and so `redis-cli --scan --pattern 'throttle:*'` shows only these.
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:${throttlerName}:${key}:blocked`;

    try {
      const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = (await this.redis
        .getClient()
        .eval(INCREMENT, 2, hitKey, blockKey, ttl, limit, blockDuration)) as [
        number,
        number,
        number,
        number,
      ];

      if (this.degraded) {
        this.degraded = false;
        this.logger.log('Redis rate-limit storage recovered — limits are shared again.');
      }

      return {
        totalHits,
        // The guard reports these to the client in seconds.
        timeToExpire: Math.ceil(timeToExpire / 1000),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
      };
    } catch (error) {
      if (!this.degraded) {
        this.degraded = true;
        this.logger.error(
          `Redis rate-limit storage unavailable (${
            error instanceof Error ? error.message : String(error)
          }). Falling back to PER-INSTANCE counting: limits still apply but are no longer shared between instances.`,
        );
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }
}
