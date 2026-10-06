import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { REQUEST_ID_HEADER } from '@sailent/config';

import { AppConfig } from './config/app.config.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { StoriesModule } from './modules/stories/stories.module.js';
import { BlogModule } from './modules/blog/blog.module.js';
import { PagesModule } from './modules/pages/pages.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { RedisService } from './modules/redis/redis.service.js';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { DonationsModule } from './modules/donations/donations.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { TeamModule } from './modules/team/team.module.js';
import { VolunteersModule } from './modules/volunteers/volunteers.module.js';
import { ImpactModule } from './modules/impact/impact.module.js';
import { MeModule } from './modules/me/me.module.js';
import { DonorsModule } from './modules/donors/donors.module.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { ClientThrottlerGuard } from './common/guards/client-throttler.guard.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.isProduction ? 'info' : 'debug',
          // Pretty output locally; structured JSON everywhere else, because a
          // log aggregator parses JSON and a human reads columns.
          transport: config.isDevelopment
            ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } }
            : undefined,
          genReqId: (req) => (req.headers[REQUEST_ID_HEADER] as string) || randomUUID(),
          customProps: () => ({ environment: config.env.APP_ENV, service: 'sailent-api' }),
          /**
           * REDACTION.
           *
           * Enforced here, once, rather than relying on every call site to
           * remember. Passwords, tokens, API keys, OTP codes and donor PII
           * must never reach a log file — a log aggregator is a second copy
           * of your database with weaker access control
           * (docs/security-architecture.md §9).
           */
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-razorpay-signature"]',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.otp',
              'req.body.code',
              'req.body.token',
              'req.body.taxIdNumber',
              'req.body.pan',
              'req.body.phone',
              'req.body.email',
              '*.password',
              '*.passwordHash',
              '*.totpSecret',
              '*.accessToken',
              '*.refreshToken',
              '*.taxIdNumber',
            ],
            censor: '[redacted]',
          },
          // Health probes would otherwise dominate the log volume.
          autoLogging: {
            ignore: (req) => req.url === '/api/v1/health' || req.url === '/api/v1/health/ready',
          },
        },
      }),
    }),
    /**
     * Rate limiting. A baseline for every route; auth endpoints tighten it
     * further with their own `@Throttle` — staff login at 5/minute, donor OTP
     * request at 3/15min, donor OTP verify at 10/15min.
     *
     * ════════════════════════════════════════════════════════════════════════
     * COUNTERS LIVE IN REDIS, SHARED BY EVERY INSTANCE.
     *
     * This comment used to say "Phase 5 moves it to Redis", then admitted that
     * Phases 5, 6 and 7 had shipped without it. It is now actually done.
     *
     * What was wrong: `ThrottlerModule` defaults to an in-process Map, so
     * every limit was PER INSTANCE. One API process enforced the numbers
     * exactly; two behind a load balancer enforced roughly double, each
     * keeping its own tally. Render scales horizontally, so the limits were
     * silently multiplied by however many processes happened to be running —
     * and nothing reported it. Phase 8 made it worse by adding a public
     * unauthenticated write (the volunteer application) to the endpoints that
     * depend on it.
     *
     * `RedisThrottlerStorage` counts in one Lua script, so two instances
     * incrementing the same key cannot both read the pre-increment value.
     *
     * It is passed as `storage` in this module's own options, which is the
     * ONLY binding that takes. Providing the `ThrottlerStorage` token from the
     * (global) `RedisModule` looks equivalent and is not: `ThrottlerModule`
     * provides that token itself, an imported module's provider beats a global
     * one, and the guard quietly carried on with its in-process Map while
     * every behavioural test still passed. An integration test now asserts
     * that counters actually reach Redis, because nothing else could see it.
     *
     * If Redis is unreachable it degrades to per-instance counting rather than
     * failing open or taking the API down. See that file for why.
     *
     * THE LIMITS ARE UNCHANGED — here, and on every `@Throttle()` decorator.
     * What changed is that they now mean what they say.
     * ════════════════════════════════════════════════════════════════════════
     */
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),

    DatabaseModule,
    RedisModule,
    QueueModule,
    AuditModule,
    AuthModule,
    ContentModule,
    UsersModule,
    CatalogModule,
    ProductsModule,
    DonationsModule,
    EventsModule,
    TeamModule,
    VolunteersModule,
    ImpactModule,
    MeModule,
    DonorsModule,
    SettingsModule,
    StoriesModule,
    BlogModule,
    PagesModule,
    StorageModule,
    MediaModule,
    DocumentsModule,
    NotificationsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    /**
     * Guard order matters. Throttling runs FIRST so a flood is rejected before
     * it costs a token verification or a database round trip — otherwise the
     * rate limiter is doing its work after the expensive part.
     */
    // Keyed on the real client the web server vouched for, not on the web
    // server's own address (Phase 11). See ClientThrottlerGuard.
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
