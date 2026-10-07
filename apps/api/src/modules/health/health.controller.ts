import { Controller, Get, Inject, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { Response } from 'express';

import type { DatabaseClient } from '@sailent/database';

import { Public } from '../../common/decorators/public.decorator.js';
import { DATABASE } from '../database/database.module.js';
import { AppConfig } from '../../config/app.config.js';
import { RedisService } from '../redis/redis.service.js';
import { QUEUE_NAMES, QueueService } from '../queue/queue.service.js';

interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  /** Always the word `unavailable` — never a driver message. */
  error?: 'unavailable';
  detail?: Record<string, number>;
}

export interface ReadinessReport {
  status: 'ok' | 'degraded' | 'unavailable';
  checks: Record<string, DependencyStatus>;
}

/** Readiness results are reused for this long. */
export const READINESS_CACHE_MS = 5_000;
/** A dependency that has not answered in this long is down. */
export const CHECK_TIMEOUT_MS = 2_000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly redis: RedisService,
    private readonly queues: QueueService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Liveness. Answers "is this process running" and nothing more, so a
   * dependency outage never causes the platform to kill a healthy container.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: string; service: string; environment: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      service: 'sailent-api',
      environment: this.config.env.APP_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  /**
   * Readiness (Phase 14): "can this instance serve traffic?"
   *
   * ══════════════════════════════════════════════════════════════════════════
   *   - DATABASE down → HTTP 503 `unavailable`. Nothing useful can be served
   *     without it; Cloud Run's startup probe uses this, so a revision that
   *     cannot reach its database never takes traffic.
   *   - Redis or the queue down → HTTP 200 `degraded`. The API keeps serving:
   *     the throttler falls back to in-process counting, idempotency and
   *     enqueues fail open (ARCHITECTURE.md §8). The detail says what is down.
   *   - Every check has a timeout, and the result is cached for a few seconds,
   *     so a probe cannot hold a connection open or hammer the database.
   *   - No error text is returned — a driver message can name hosts. The real
   *     error is logged server-side.
   * ══════════════════════════════════════════════════════════════════════════
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — 503 if the database is unreachable' })
  async ready(@Res({ passthrough: true }) response?: Response): Promise<ReadinessReport> {
    const report = await this.readiness();
    if (report.status === 'unavailable') response?.status(503);
    return report;
  }

  private cached: { at: number; report: Promise<ReadinessReport> } | null = null;

  private readiness(): Promise<ReadinessReport> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < READINESS_CACHE_MS) return this.cached.report;
    const report = this.runChecks();
    this.cached = { at: now, report };
    return report;
  }

  private async runChecks(): Promise<ReadinessReport> {
    const [database, redis, queue] = await Promise.all([
      this.check('database', () => this.database.ping()),
      this.check('redis', () => this.redis.ping()),
      this.check('queue', async () => {
        const counts = await this.queues.counts(QUEUE_NAMES.EXAMPLE);
        // Depth only — never connection strings or host names.
        return { waiting: counts.waiting ?? 0, failed: counts.failed ?? 0 };
      }),
    ]);

    const checks = { database, redis, queue };
    const status =
      database.status === 'down'
        ? 'unavailable'
        : Object.values(checks).every((check) => check.status === 'up')
          ? 'ok'
          : 'degraded';
    return { status, checks };
  }

  private async check(name: string, run: () => Promise<unknown>): Promise<DependencyStatus> {
    const startedAt = Date.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race([
        run(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timed out')), CHECK_TIMEOUT_MS);
        }),
      ]);
      const detail =
        result && typeof result === 'object' && !Array.isArray(result)
          ? (result as Record<string, number>)
          : undefined;
      return { status: 'up', latencyMs: Date.now() - startedAt, ...(detail ? { detail } : {}) };
    } catch (error) {
      this.logger.warn(
        `Readiness: ${name} is down (${error instanceof Error ? error.message : 'unknown error'})`,
      );
      return { status: 'down', latencyMs: Date.now() - startedAt, error: 'unavailable' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
