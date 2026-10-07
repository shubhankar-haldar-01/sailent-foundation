import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * The worker's HTTP surface (Phase 14): Cloud Run requires a container to
 * listen on `PORT`, and probes it.
 *
 *   GET /health  liveness — the process is running. Always 200, never touches
 *                a dependency, so a Redis blip does not get the worker killed.
 *   GET /ready   readiness — Redis and the database answer. 200 when both do,
 *                503 otherwise. Each check times out, the result is cached for
 *                a few seconds, and no error text is returned (a driver
 *                message can name hosts).
 *
 * Nothing else is served; the worker takes no requests.
 */
export const READY_CACHE_MS = 5_000;
export const CHECK_TIMEOUT_MS = 2_000;

export interface HealthOptions {
  service: string;
  environment: string;
  queues: string[];
  checks: Record<string, () => Promise<unknown>>;
  onCheckFailed?: (name: string, error: unknown) => void;
}

type CheckResult = { status: 'up' | 'down'; latencyMs: number };

async function runCheck(run: () => Promise<unknown>): Promise<CheckResult & { error?: unknown }> {
  const startedAt = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out')), CHECK_TIMEOUT_MS);
      }),
    ]);
    return { status: 'up', latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { status: 'down', latencyMs: Date.now() - startedAt, error };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createHealthHandler(options: HealthOptions) {
  let cached: {
    at: number;
    result: Promise<{ ready: boolean; checks: Record<string, CheckResult> }>;
  } | null = null;

  const readiness = () => {
    const now = Date.now();
    if (cached && now - cached.at < READY_CACHE_MS) return cached.result;
    const result = (async () => {
      const entries = await Promise.all(
        Object.entries(options.checks).map(async ([name, run]) => {
          const outcome = await runCheck(run);
          if (outcome.status === 'down') options.onCheckFailed?.(name, outcome.error);
          return [name, { status: outcome.status, latencyMs: outcome.latencyMs }] as const;
        }),
      );
      const checks = Object.fromEntries(entries);
      return { ready: entries.every(([, check]) => check.status === 'up'), checks };
    })();
    cached = { at: now, result };
    return result;
  };

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = (req.url ?? '').split('?')[0];
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };

    if (req.method !== 'GET' && req.method !== 'HEAD')
      return send(405, { error: 'Method not allowed' });

    if (path === '/health') {
      return send(200, {
        status: 'ok',
        service: options.service,
        environment: options.environment,
        uptimeSeconds: Math.floor(process.uptime()),
        queues: options.queues,
      });
    }

    if (path === '/ready') {
      const { ready, checks } = await readiness();
      return send(ready ? 200 : 503, {
        status: ready ? 'ok' : 'unavailable',
        service: options.service,
        checks,
      });
    }

    return send(404, { error: 'Not found' });
  };
}
