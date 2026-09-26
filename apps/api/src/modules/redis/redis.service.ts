import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfig } from '../../config/app.config.js';

/**
 * Redis client.
 *
 * Used for rate limiting and, from Phase 5, as the BullMQ transport. It is not
 * a general-purpose cache: Next.js and Cloudflare cover page caching, and
 * adding a third cache layer would mean three places to invalidate
 * (docs/architecture.md §7).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: AppConfig) {
    this.client = new Redis(config.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      // Back off rather than hammering a Redis that is restarting.
      retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
    });

    this.client.on('error', (error: Error) => {
      // Logged, not thrown: a Redis blip must not take the API down.
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    const result = await this.client.ping();
    return result === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Cache and lock helpers.
 *
 * Deliberately small. Phase 0 §7 rejected Redis as a general-purpose cache —
 * Next.js and Cloudflare already cache pages, and a third cache layer means
 * three places to invalidate and three ways to serve stale data. What Redis is
 * for here is rate limiting, queues, and the distributed locks that later
 * phases need so two API instances cannot both process the same webhook.
 */
export interface CacheOptions {
  /** Seconds. */
  ttl?: number;
}
