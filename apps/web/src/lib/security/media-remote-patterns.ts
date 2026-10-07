/**
 * The ONE remote image origin next/image may load: the media library's public
 * bucket (Phase 13 `MEDIA_PUBLIC_BASE_URL`, hardened in Phase 14).
 *
 * ══════════════════════════════════════════════════════════════════════════
 *   - Exact host, no wildcard; everything under the base path and nothing
 *     else. Unset → no remote images at all.
 *   - The URL must not carry a user name, password, query or fragment: it is
 *     printed into every image tag on the site.
 *   - In production it must be a public https:// URL (not localhost).
 *
 * A bad value THROWS, so `next build` / `next start` fails with a sentence
 * instead of quietly allowing nothing — a deployment where every library
 * image is broken is not something to discover from a donor.
 *
 * It is the same value as the API's `R2_PUBLIC_BASE_URL`, which the API's
 * environment schema checks with the same rules. Private media is never
 * reachable here: private objects live in another bucket and are served only
 * through short-lived signed URLs, which next/image is not given.
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface MediaRemotePattern {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

export function mediaRemotePatterns(
  base: string | undefined,
  options: { production: boolean },
): MediaRemotePattern[] {
  if (!base || base.trim() === '') return [];

  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    throw new Error('MEDIA_PUBLIC_BASE_URL is not a valid URL.');
  }

  if (url.username || url.password) {
    throw new Error('MEDIA_PUBLIC_BASE_URL must not contain a user name or password.');
  }
  if (url.search || url.hash) {
    throw new Error('MEDIA_PUBLIC_BASE_URL must not contain a query string or fragment.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('MEDIA_PUBLIC_BASE_URL must be an http(s) URL.');
  }
  if (options.production && (url.protocol !== 'https:' || LOOPBACK.has(url.hostname))) {
    throw new Error('MEDIA_PUBLIC_BASE_URL must be a public https:// URL in production.');
  }
  if (url.hostname.includes('*')) {
    throw new Error('MEDIA_PUBLIC_BASE_URL must name one host, not a wildcard.');
  }

  return [
    {
      protocol: url.protocol === 'https:' ? 'https' : 'http',
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: `${url.pathname.replace(/\/+$/, '')}/**`,
    },
  ];
}
