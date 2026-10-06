import 'server-only';

import { headers } from 'next/headers';

import { CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

import { clientIpFrom } from './client-ip';

/** Headers a browser must never be able to set on a request to the API. */
export const INTERNAL_HEADERS = [CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER] as const;

/**
 * The headers that tell the API who the real client is (Phase 11).
 *
 * The client address the web server derived (`clientIpFrom`), vouched for with
 * `INTERNAL_API_SECRET`. The API believes the address only with the secret, so
 * rate limits apply per donor rather than to the whole site.
 *
 * Empty — and the API falls back to the connecting address, as before — when
 * the secret or the address is unavailable. Never logged.
 */
export function clientForwardingHeaders(source: {
  get(name: string): string | null;
}): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET;
  const ip = clientIpFrom(source);
  if (!secret || !ip) return {};
  return { [INTERNAL_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: ip };
}

/**
 * The same, for a server action: the incoming request's headers are read
 * through `next/headers`. Server actions call the API directly (not through
 * the BFF), so the rate-limited ones — sign-in, sign-in codes, the volunteer
 * application — add these themselves.
 */
export async function actionForwardingHeaders(): Promise<Record<string, string>> {
  return clientForwardingHeaders(await headers());
}
