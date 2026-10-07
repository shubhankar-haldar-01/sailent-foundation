import { describe, expect, it, vi } from 'vitest';

import { CHECK_TIMEOUT_MS, createHealthHandler } from './health.js';

interface HealthBody {
  status?: string;
  service?: string;
  checks?: Record<string, { status: string }>;
}

/** Call the handler like Node's http server would, and collect the answer. */
async function request(
  handler: ReturnType<typeof createHealthHandler>,
  url: string,
  method = 'GET',
) {
  let status = 0;
  let body = '';
  await handler(
    { url, method } as never,
    {
      writeHead: (code: number) => {
        status = code;
      },
      end: (chunk: string) => {
        body = chunk;
      },
    } as never,
  );
  return { status, json: body ? (JSON.parse(body) as HealthBody) : null, body };
}

function handler(checks: Record<string, () => Promise<unknown>>) {
  return createHealthHandler({
    service: 'sailent-worker',
    environment: 'production',
    queues: ['email', 'payments'],
    checks,
  });
}

describe('worker health', () => {
  it('liveness answers 200 without touching a dependency', async () => {
    const redis = vi.fn().mockRejectedValue(new Error('down'));
    const result = await request(handler({ redis }), '/health');
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: 'ok', service: 'sailent-worker' });
    expect(redis).not.toHaveBeenCalled();
  });

  it('readiness is 200 when Redis and the database answer', async () => {
    const result = await request(
      handler({ redis: async () => 'PONG', database: async () => true }),
      '/ready',
    );
    expect(result.status).toBe(200);
    expect(result.json?.checks).toMatchObject({
      redis: { status: 'up' },
      database: { status: 'up' },
    });
  });

  it('readiness is 503 when one is down, and never returns the error text', async () => {
    const result = await request(
      handler({
        redis: async () => {
          throw new Error('connect ECONNREFUSED 10.8.0.3:6379 password=abc');
        },
        database: async () => true,
      }),
      '/ready',
    );
    expect(result.status).toBe(503);
    expect(result.json?.status).toBe('unavailable');
    expect(result.body).not.toMatch(/ECONNREFUSED|10\.8\.0\.3|6379|password/);
  });

  it('a check that hangs times out instead of holding the probe', async () => {
    vi.useFakeTimers();
    try {
      const pending = request(handler({ redis: () => new Promise(() => {}) }), '/ready');
      await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS + 10);
      expect((await pending).status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caches readiness for a few seconds', async () => {
    const database = vi.fn().mockResolvedValue(true);
    const instance = handler({ database });
    await request(instance, '/ready');
    await request(instance, '/ready');
    expect(database).toHaveBeenCalledTimes(1);
  });

  it('serves nothing else, and only GET/HEAD', async () => {
    const instance = handler({});
    expect((await request(instance, '/metrics')).status).toBe(404);
    expect((await request(instance, '/health', 'POST')).status).toBe(405);
  });
});
