import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppConfig } from '../../config/app.config.js';
import { DATABASE } from '../database/database.module.js';
import { RedisService } from '../redis/redis.service.js';
import { QueueService } from '../queue/queue.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const databasePing = vi.fn();
  const redisPing = vi.fn();
  const queueCounts = vi.fn();

  async function build() {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DATABASE, useValue: { ping: databasePing } },
        { provide: RedisService, useValue: { ping: redisPing } },
        { provide: QueueService, useValue: { counts: queueCounts } },
        { provide: AppConfig, useValue: { env: { APP_ENV: 'test' } } },
      ],
    }).compile();

    return moduleRef.get(HealthController);
  }

  beforeEach(() => {
    databasePing.mockReset().mockResolvedValue(true);
    redisPing.mockReset().mockResolvedValue(true);
    queueCounts.mockReset().mockResolvedValue({ waiting: 0, failed: 0 });
  });

  describe('liveness', () => {
    it('reports the service and environment without touching dependencies', async () => {
      const controller = await build();
      const result = controller.live();

      expect(result).toMatchObject({ status: 'ok', service: 'sailent-api', environment: 'test' });
      // Liveness must not depend on Postgres or Redis, or a dependency outage
      // causes the platform to kill an otherwise healthy container.
      expect(databasePing).not.toHaveBeenCalled();
      expect(redisPing).not.toHaveBeenCalled();
      expect(queueCounts).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('reports ok when every dependency responds', async () => {
      const controller = await build();
      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.checks.database?.status).toBe('up');
      expect(result.checks.redis?.status).toBe('up');
      expect(result.checks.queue?.status).toBe('up');
    });

    it('reports queue DEPTH but never connection detail', async () => {
      // This endpoint is unauthenticated by necessity. Depth is operational
      // information; a host name or connection string would be an invitation.
      queueCounts.mockResolvedValue({ waiting: 3, failed: 1, active: 2 });
      const controller = await build();
      const result = await controller.ready();

      expect(result.checks.queue?.detail).toEqual({ waiting: 3, failed: 1 });
      expect(JSON.stringify(result)).not.toMatch(/redis:\/\/|localhost|127\.0\.0\.1|password/i);
    });

    it('degrades rather than throwing when a dependency is down', async () => {
      databasePing.mockRejectedValue(new Error('connection refused'));
      const controller = await build();
      const result = await controller.ready();

      expect(result.status).toBe('degraded');
      expect(result.checks.database?.status).toBe('down');
      // Redis and the queue are still checked: one failure must not mask the others.
      expect(result.checks.redis?.status).toBe('up');
      expect(result.checks.queue?.status).toBe('up');
    });

    it('checks dependencies concurrently, not in series', async () => {
      // A serial readiness probe times out on the sum of its dependencies.
      const order: string[] = [];
      databasePing.mockImplementation(async () => {
        order.push('db-start');
        await new Promise((resolve) => setTimeout(resolve, 20));
        return true;
      });
      redisPing.mockImplementation(async () => {
        order.push('redis-start');
        return true;
      });
      queueCounts.mockImplementation(async () => {
        order.push('queue-start');
        return { waiting: 0, failed: 0 };
      });

      const controller = await build();
      await controller.ready();

      expect(order).toEqual(['db-start', 'redis-start', 'queue-start']);
    });
  });
});
