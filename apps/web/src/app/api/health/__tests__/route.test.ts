import { afterEach, describe, expect, it } from 'vitest';

import { GET, dynamic } from '../route';

/**
 * The web service's Cloud Run probe (Phase 14): it answers without touching
 * the API, is never prerendered, is never cached, and carries no
 * configuration value even when secrets are set.
 */
describe('GET /api/health', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('answers ok, uncached, and is not prerendered', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(dynamic).toBe('force-dynamic');
    expect(await response.json()).toMatchObject({ status: 'ok', service: 'sailent-web' });
  });

  it('leaks no configuration value', async () => {
    process.env.INTERNAL_API_SECRET = 'internal-secret-value-that-must-not-leak-1234';
    process.env.API_URL = 'https://api-internal.example.run.app';
    process.env.SENTRY_DSN = 'https://publickey@o1.ingest.example.io/42';
    const body = JSON.stringify(await GET().json());
    expect(body).not.toContain('internal-secret-value');
    expect(body).not.toContain('api-internal');
    expect(body).not.toContain('publickey');
    expect(Object.keys(JSON.parse(body)).sort()).toEqual([
      'environment',
      'service',
      'status',
      'uptimeSeconds',
    ]);
  });
});
