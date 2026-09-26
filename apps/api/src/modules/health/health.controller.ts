import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { DatabaseClient } from '@sailent/database';

import { Public } from '../../common/decorators/public.decorator.js';
import { DATABASE } from '../database/database.module.js';
import { AppConfig } from '../../config/app.config.js';
import { RedisService } from '../redis/redis.service.js';
import { QUEUE_NAMES, QueueService } from '../queue/queue.service.js';

interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
  detail?: Record<string, number>;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
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
   * Readiness. Answers "can this process serve traffic" by actually touching
   * each dependency. Returns 200 with per-dependency detail; the deploy target
   * decides what to do with a `down`.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — checks database and Redis' })
  async ready(): Promise<{
    status: 'ok' | 'degraded';
    checks: Record<string, DependencyStatus>;
  }> {
    const [database, redis, queue] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueue(),
    ]);

    const checks = { database, redis, queue };
    const status = Object.values(checks).every((check) => check.status === 'up')
      ? 'ok'
      : 'degraded';

    return { status, checks };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const startedAt = Date.now();
    try {
      await this.database.ping();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        // Safe to surface: this endpoint is operational, and the message is a
        // connection error rather than user data.
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }

  /**
   * Queue reachability.
   *
   * Reports only DEPTH, never connection strings or host names. A health
   * endpoint is unauthenticated by necessity, so it must not become a way to
   * enumerate infrastructure.
   */
  private async checkQueue(): Promise<DependencyStatus> {
    const startedAt = Date.now();
    try {
      const counts = await this.queues.counts(QUEUE_NAMES.EXAMPLE);
      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
        detail: { waiting: counts.waiting ?? 0, failed: counts.failed ?? 0 },
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const startedAt = Date.now();
    try {
      await this.redis.ping();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }
}
