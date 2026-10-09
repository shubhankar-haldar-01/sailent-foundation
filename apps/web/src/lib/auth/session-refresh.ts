import { createHash } from 'node:crypto';

import { API_PREFIX, CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

import { clientIpFrom } from '@/lib/api/client-ip';

/**
 * Session cookies, and refreshing them WHERE THE NEW COOKIE CAN BE SAVED.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS (2026-10-09).
 *
 * Access tokens live fifteen minutes. The refresh used to happen inside a
 * page render — the public layout asks "who is signed in?" on every page —
 * and Next.js does not allow a cookie to be written during a render. So the
 * API rotated the refresh token, the write of the new one threw, the catch
 * swallowed it, and the browser kept the spent token. Its next use looked
 * exactly like a stolen token being replayed, and the API revoked the whole
 * session. A donor was signed out about fifteen minutes into every visit.
 *
 * The middleware runs before any render and CAN set cookies, so the refresh
 * happens there (`middleware.ts`), and a render never rotates a token it
 * cannot save (`token-store.ts`).
 *
 * NOT `server-only`, and no `next/headers`: the middleware imports this.
 * ══════════════════════════════════════════════════════════════════════════
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface StoredSession<TActor> {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. Used to refresh slightly early rather than on a 401. */
  expiresAt: number;
  actor: TActor;
}

export interface SessionAudience {
  cookieName: string;
  /** Seconds. Matches the audience's refresh-token lifetime. */
  maxAgeSeconds: number;
}

/**
 * Thirty days, matching the donor refresh token: a donor visits a few times a
 * year, and being signed out between visits is the difference between checking
 * a receipt and giving up.
 */
export const DONOR_SESSION: SessionAudience = {
  cookieName: 'sailent_donor_session',
  maxAgeSeconds: 30 * 24 * 60 * 60,
};

/** Seven days, matching the staff refresh token. */
export const STAFF_SESSION: SessionAudience = {
  cookieName: 'sailent_staff_session',
  maxAgeSeconds: 7 * 24 * 60 * 60,
};

/** Separate cookies, refreshed separately: one is never read as the other. */
export const SESSION_AUDIENCES = [DONOR_SESSION, STAFF_SESSION] as const;

/**
 * How early the middleware refreshes. WIDER than the 60 seconds the session
 * store allows itself, so by the time a page renders the token always has at
 * least a minute left and the render never reaches its own refresh path.
 */
export const MIDDLEWARE_REFRESH_MARGIN_MS = 2 * 60_000;

/**
 * The cookie's attributes — one definition for every writer, so the middleware
 * and the session store can never set two different cookies under one name.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Lax, not Strict: Strict would drop the cookie when someone follows a
    // link from an email, which looks exactly like being logged out. Lax
    // still blocks the cross-site POSTs that CSRF depends on.
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // A cookie outliving the session it points at just produces confusing
    // 401s, so this matches the refresh-token lifetime.
    maxAge: maxAgeSeconds,
  };
}

/** A stored session, or null — a malformed cookie is a signed-out user, not a crash. */
export function parseSession<TActor>(raw: string | null | undefined): StoredSession<TActor> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession<TActor>> | null;
    if (
      !parsed ||
      typeof parsed.accessToken !== 'string' ||
      !parsed.accessToken ||
      typeof parsed.refreshToken !== 'string' ||
      !parsed.refreshToken ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed as StoredSession<TActor>;
  } catch {
    return null;
  }
}

export type RefreshResult =
  /** Not due yet; nothing was sent. */
  | { kind: 'fresh' }
  /** Rotated: `value` is the new cookie value. */
  | { kind: 'refreshed'; value: string }
  /** The cookie is unreadable, or the API refused the refresh token: sign out. */
  | { kind: 'signed-out' }
  /** The API could not be reached or failed: leave the cookie as it is. */
  | { kind: 'error' };

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ONE REFRESH PER TOKEN — INCLUDING FOR REQUESTS THAT ARRIVE A MOMENT LATE.
 *
 * Refresh tokens rotate, and presenting a rotated one is treated as theft. A
 * page load is several requests at once (the page, its data, prefetched
 * links), every one carrying the same cookie, and some arrive after the first
 * refresh has finished but before the browser has stored the new cookie. Each
 * of them must get THE SAME new session, not present the spent token again.
 *
 * So a result is kept for a minute after it settles, keyed on the refresh
 * token that produced it. Keyed per token, it is only ever handed to a request
 * holding that token — the same person the API would have given it to — and
 * two sessions never share a result. A failed call is not kept, so the next
 * request may try again.
 *
 * THIS IS THE WEB SERVER'S MEMORY ONLY. The API is unchanged: a spent refresh
 * token presented to it is still a replay, and still revokes the session. A
 * request inside the minute never reaches the API; one after it does.
 *
 * WHAT IS HELD, AND HOW MUCH: the key is the SHA-256 of the spent token (the
 * token itself is not kept); the value is the new session, which has to be
 * handed out. Entries leave a minute after they settle, and the map never
 * holds more than `MAX_REMEMBERED` — the oldest goes first — so a burst of
 * sign-ins cannot grow it without limit.
 *
 * Per server process: see DEVELOPMENT_STATUS.md for running several instances.
 * ══════════════════════════════════════════════════════════════════════════
 */
const SETTLED_GRACE_MS = 60_000;
const MAX_REMEMBERED = 5_000;
const recent = new Map<string, Promise<RefreshResult>>();

function keyFor(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

/** Test hook: forget every remembered refresh. */
export function resetRefreshCache(): void {
  recent.clear();
}

/** Test hook: how many refreshes are remembered. */
export function rememberedRefreshes(): number {
  return recent.size;
}

export async function refreshIfDue(
  raw: string | null | undefined,
  options: {
    marginMs: number;
    /** The incoming request's headers, for the client address the API limits by. */
    headers?: { get(name: string): string | null };
    now?: number;
  },
): Promise<RefreshResult> {
  const session = parseSession<Record<string, unknown>>(raw);
  if (!session) return { kind: 'signed-out' };

  const now = options.now ?? Date.now();
  if (session.expiresAt - now > options.marginMs) return { kind: 'fresh' };

  const key = keyFor(session.refreshToken);
  const existing = recent.get(key);
  if (existing) return existing;

  const pending = callRefresh(session, options.headers);
  // Bounded: the oldest entry makes room (a Map keeps insertion order).
  if (recent.size >= MAX_REMEMBERED) {
    const oldest = recent.keys().next().value;
    if (oldest !== undefined) recent.delete(oldest);
  }
  recent.set(key, pending);
  void pending.then((result) => {
    if (result.kind === 'error') {
      recent.delete(key);
      return;
    }
    const timer = setTimeout(() => recent.delete(key), SETTLED_GRACE_MS);
    // Never hold a process open just to tidy this map.
    (timer as { unref?: () => void }).unref?.();
  });
  return pending;
}

async function callRefresh(
  session: StoredSession<Record<string, unknown>>,
  headers?: { get(name: string): string | null },
): Promise<RefreshResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...forwardingHeaders(headers) },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return { kind: 'error' };
  }

  // A rate limit or a server failure is not a verdict on the session.
  if (response.status === 429 || response.status >= 500) return { kind: 'error' };
  // Anything else unsuccessful is: expired, revoked, replayed or forged.
  if (!response.ok) return { kind: 'signed-out' };

  const body = (await response.json().catch(() => null)) as {
    data?: {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      actor?: Record<string, unknown>;
    };
  } | null;
  const data = body?.data;
  if (!data?.accessToken || !data.refreshToken || typeof data.expiresIn !== 'number') {
    return { kind: 'error' };
  }

  const refreshed: StoredSession<Record<string, unknown>> = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
    // The API's actor wins (a permission change takes effect without signing
    // out); anything it does not send — the donor's display name, stored at
    // sign-in — is kept.
    actor: { ...session.actor, ...(data.actor ?? {}) },
  };
  return { kind: 'refreshed', value: JSON.stringify(refreshed) };
}

/**
 * The real client address for the API's per-person limits — the same rule as
 * `clientForwardingHeaders` in `lib/api/forwarding.ts`, which cannot be
 * imported here (it is `server-only`).
 */
function forwardingHeaders(source?: { get(name: string): string | null }): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET;
  const ip = source ? clientIpFrom(source) : null;
  if (!secret || !ip) return {};
  return { [INTERNAL_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: ip };
}
