import 'server-only';

import { API_PREFIX } from '@sailent/config';

import { ApiClient } from './client';

/**
 * Server-side API client.
 *
 * `server-only` makes it a BUILD ERROR to import this from a client component,
 * which is the enforcement behind decision A1 — the browser cannot reach the
 * API even by accident.
 *
 * Phase 3 supplies `getToken` from the session cookie.
 */
export function createServerApiClient(options: { requestId?: string } = {}): ApiClient {
  const baseUrl = process.env.API_URL ?? 'http://localhost:4000';

  return new ApiClient({
    baseUrl: `${baseUrl}/${API_PREFIX}`,
    getRequestId: () => options.requestId,
    defaultTimeoutMs: 10_000,
  });
}
