import { isIP } from 'node:net';

/**
 * The real client address, as the web server's own proxy chain reports it
 * (Phase 11).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONLY WHERE THE DEPLOYMENT SAYS HOW.
 *
 * Which header carries the client address, and how far to trust it, depends
 * on what sits in front of this server — a platform edge, a load balancer, a
 * CDN — and only the deployment knows. So nothing is guessed:
 *
 *   CLIENT_IP_HEADER    the header to read. Unset → no address is derived,
 *                       and the API falls back to the connecting address
 *                       (site-wide limits, the behaviour before Phase 11).
 *   TRUSTED_PROXY_HOPS  for `x-forwarded-for` only: how many proxies we
 *                       control append to it. The client is the entry that
 *                       many from the END — anything before it was written by
 *                       whoever sent the request and is not believed.
 *                       Default 1. Ignored for single-value headers
 *                       (`x-real-ip`, `cf-connecting-ip`, …), which the edge
 *                       sets and overwrites.
 *
 * Unset by default deliberately: reading `x-forwarded-for` from a server with
 * no proxy in front would believe whatever the browser wrote, and per-client
 * limits that anyone can choose their way out of are worse than none.
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface ClientIpConfig {
  header?: string | undefined;
  trustedHops?: string | number | undefined;
}

export function clientIpFrom(
  headers: { get(name: string): string | null },
  config: ClientIpConfig = {
    header: process.env.CLIENT_IP_HEADER,
    trustedHops: process.env.TRUSTED_PROXY_HOPS,
  },
): string | null {
  const header = config.header?.trim().toLowerCase();
  if (!header) return null;

  const raw = headers.get(header);
  if (!raw) return null;

  let candidate: string | undefined;
  if (header === 'x-forwarded-for') {
    const hops = Number(config.trustedHops ?? 1);
    if (!Number.isInteger(hops) || hops < 1) return null;
    const entries = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    candidate = entries[entries.length - hops];
  } else {
    candidate = raw.split(',')[0]?.trim();
  }

  if (!candidate || isIP(candidate) === 0) return null;
  return candidate;
}
