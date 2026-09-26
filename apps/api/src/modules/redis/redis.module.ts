import { Global, Module } from '@nestjs/common';

import { CacheService } from './cache.service.js';
import { RedisService } from './redis.service.js';

/**
 * Redis.
 *
 * `@Global()` so `RedisService` can be injected anywhere — including into the
 * `ThrottlerModule.forRootAsync` factory in `app.module.ts`, which is what
 * gives the rate limiter its shared storage.
 *
 * The `ThrottlerStorage` token is deliberately NOT provided here. It was, and
 * it silently did nothing: `ThrottlerModule` provides that token itself, and
 * a provider from an imported module wins over a global one, so `ThrottlerGuard`
 * carried on using the in-process Map while every test still passed. Passing
 * `storage` into the module's own options is the only binding that takes.
 */
@Global()
@Module({ providers: [RedisService, CacheService], exports: [RedisService, CacheService] })
export class RedisModule {}
