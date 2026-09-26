import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { RedisService } from './redis.service.js';

/**
 * Cache and distributed locks.
 *
 * DESIGNED TO FAIL OPEN. Every method degrades to "no cache" when Redis is
 * unavailable rather than throwing, because a Redis blip should slow the site
 * down, not take it offline. The one exception is `withLock`, which fails
 * CLOSED — if we cannot prove we hold the lock, we must not run the critical
 * section.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.getClient().get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(`Cache read failed for ${key}: ${String(error)}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await this.redis.getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Cache write failed for ${key}: ${String(error)}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.getClient().del(key);
    } catch (error) {
      this.logger.warn(`Cache delete failed for ${key}: ${String(error)}`);
    }
  }

  /** Read-through. A cache failure costs a database round trip, never a request. */
  async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Distributed lock.
   *
   * `SET key token NX PX ttl` to acquire, and release only if the token still
   * matches — checked with a Lua script so the compare-and-delete is atomic. A
   * plain GET-then-DEL could delete a lock that had already expired and been
   * re-acquired by someone else, which is worse than no lock at all.
   *
   * Phase 5 needs this so two API instances cannot process the same Razorpay
   * webhook concurrently.
   */
  async withLock<T>(
    key: string,
    ttlSeconds: number,
    critical: () => Promise<T>,
  ): Promise<T | null> {
    const token = randomUUID();
    const lockKey = `lock:${key}`;
    const client = this.redis.getClient();

    const acquired = await client.set(lockKey, token, 'EX', ttlSeconds, 'NX');
    if (acquired !== 'OK') return null;

    try {
      return await critical();
    } finally {
      // Atomic compare-and-delete: only the holder releases the lock.
      await client.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        1,
        lockKey,
        token,
      );
    }
  }
}
