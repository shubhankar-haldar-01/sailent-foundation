import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import { CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

/**
 * Requests from our own services — the web server and the worker.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE PROBLEM THIS SOLVES.
 *
 * Every browser request reaches the API through the Next.js server, so the
 * API's own view of "the client" is that server's address. Rate limits keyed
 * on it were SITE-WIDE: ten donation starts a minute for the whole country,
 * three sign-in codes per fifteen minutes for everyone at once.
 *
 * The web server knows the real address, and now sends it in
 * `x-sailent-client-ip` — together with `INTERNAL_API_SECRET` in
 * `x-sailent-internal-auth`. The address is believed ONLY with the secret.
 * A browser can put anything it likes in either header, and the web server
 * strips both before forwarding, so the only way to choose the address the
 * limiter sees is to hold the secret.
 *
 * WHAT IS NOT TRUSTED: `X-Forwarded-For`. It is whatever the last hop chose to
 * write, and without a fixed proxy topology there is no safe way to pick an
 * entry from it here. The web server applies its own configured rule
 * (`CLIENT_IP_HEADER`, `TRUSTED_PROXY_HOPS`) where the topology is known.
 * ══════════════════════════════════════════════════════════════════════════
 */

type HeaderBag = Record<string, string | string[] | undefined>;

function firstHeader(headers: HeaderBag, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Whether the request carries the shared secret. Constant-time, and compared
 * as SHA-256 digests so the lengths always match and leak nothing.
 */
export function presentsInternalSecret(headers: HeaderBag, secret: string | undefined): boolean {
  if (!secret) return false;
  const presented = firstHeader(headers, INTERNAL_AUTH_HEADER);
  if (!presented) return false;
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(presented), digest(secret));
}

/**
 * The real client address the web server vouched for, or null.
 *
 * Null when the secret is missing or wrong, when no address was sent, or when
 * what was sent is not an IP address — in every one of those cases the caller
 * falls back to the connecting address, which is the old behaviour and never
 * looser than it.
 */
export function trustedClientIp(headers: HeaderBag, secret: string | undefined): string | null {
  if (!presentsInternalSecret(headers, secret)) return null;
  const ip = firstHeader(headers, CLIENT_IP_HEADER)?.trim();
  if (!ip || isIP(ip) === 0) return null;
  return ip;
}
