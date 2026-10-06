/**
 * Is this state-changing request from our own pages? (Phase 12, CSRF)
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THE BFF NEEDS IT.
 *
 * The browser holds the session in cookies, and the BFF turns those cookies
 * into a bearer token for the API. A page on another site could therefore
 * make a signed-in visitor's browser POST to `/api/bff/…` and have the BFF
 * act for them. `SameSite=Lax` cookies stop most of that; this stops the
 * rest by checking where the request came from.
 *
 * THE RULE, for POST, PATCH, PUT and DELETE:
 *   - `Origin` present → allowed only if it is this site's own origin (the
 *     request's host) or one listed in `TRUSTED_ORIGINS` / the configured
 *     `NEXT_PUBLIC_APP_URL`. Browsers set `Origin` themselves and a page
 *     cannot forge it.
 *   - `Origin` absent → allowed only if the browser says `Sec-Fetch-Site:
 *     same-origin`. Neither header → refused: a browser always sends one of
 *     them on these requests, so their absence means it is not a browser
 *     acting for the signed-in visitor.
 *
 * NOT AFFECTED: the Razorpay webhook and the worker call the API directly,
 * not through the BFF. Server actions get Next.js's own Origin check.
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface OriginConfig {
  /** Comma-separated extra origins (`TRUSTED_ORIGINS`). */
  trustedOrigins?: string | undefined;
  /** The site's configured public URL (`NEXT_PUBLIC_APP_URL`). */
  appUrl?: string | undefined;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

export function isTrustedRequestOrigin(
  method: string,
  headers: { get(name: string): string | null },
  config: OriginConfig = {
    trustedOrigins: process.env.TRUSTED_ORIGINS,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  },
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;

  const origin = headers.get('origin');
  if (!origin) return headers.get('sec-fetch-site') === 'same-origin';

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  // Same origin as the request itself — the host the browser addressed.
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (host && parsed.host === host.split(',')[0]!.trim()) return true;

  const allowed = new Set(
    [config.appUrl, ...(config.trustedOrigins ?? '').split(',')]
      .map((value) => originOf(value))
      .filter((value): value is string => value !== null),
  );
  return allowed.has(parsed.origin);
}
