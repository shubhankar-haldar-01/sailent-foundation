import 'server-only';

import { cookies } from 'next/headers';

import { API_PREFIX } from '@sailent/config';

/**
 * One httpOnly session cookie, and the refresh that keeps it alive.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Decision A1: NO ACCESS TOKEN EVER REACHES CLIENT-SIDE JAVASCRIPT.
 *
 * The browser holds an opaque, httpOnly, SameSite=Lax cookie. Every
 * authenticated call goes to `/api/bff/*` on this origin, and the BFF reads the
 * cookie server-side and attaches the bearer token. An XSS bug therefore does
 * not immediately become a session-theft bug: the script can make requests as
 * the user, which is bad, but it cannot take the token elsewhere and keep using
 * it.
 *
 * The cookie holds both tokens because the refresh has to happen server-side
 * too, and a refresh token in a second store is a second thing to keep in sync.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THIS IS A FACTORY BECAUSE THERE ARE TWO AUDIENCES AND THEY MUST NOT SHARE A
 * COOKIE. Staff and donor tokens are signed with different keys and mean
 * different things — `actor.id` is a `users.id` on one and a `donors.id` on the
 * other — so mixing them up is not a small bug. They are separate cookies with
 * separate lifetimes, built from this one implementation so that a fix to the
 * refresh path cannot land on one audience and miss the other.
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface StoredSession<TActor> {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. Used to refresh slightly early rather than on a 401. */
  expiresAt: number;
  actor: TActor;
}

export interface SessionStore<TActor> {
  read(): Promise<StoredSession<TActor> | null>;
  write(session: StoredSession<TActor>): Promise<void>;
  clear(): Promise<void>;
  /** A usable access token, refreshing when it is close to expiry. */
  accessToken(): Promise<string | null>;
  actor(): Promise<TActor | null>;
}

export function createSessionStore<TActor>(options: {
  cookieName: string;
  /** Seconds. Match the audience's refresh-token lifetime. */
  maxAgeSeconds: number;
}): SessionStore<TActor> {
  async function read(): Promise<StoredSession<TActor> | null> {
    const raw = (await cookies()).get(options.cookieName)?.value;
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as StoredSession<TActor>;
      return parsed.accessToken && parsed.refreshToken ? parsed : null;
    } catch {
      // A malformed cookie is a signed-out user, not a crash.
      return null;
    }
  }

  async function write(session: StoredSession<TActor>): Promise<void> {
    (await cookies()).set(options.cookieName, JSON.stringify(session), {
      httpOnly: true,
      // Lax, not Strict: Strict would drop the cookie when someone follows a
      // link from an email, which looks exactly like being logged out. Lax
      // still blocks the cross-site POSTs that CSRF depends on.
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // A cookie outliving the session it points at just produces confusing
      // 401s, so this matches the refresh-token lifetime.
      maxAge: options.maxAgeSeconds,
    });
  }

  async function clear(): Promise<void> {
    (await cookies()).delete(options.cookieName);
  }

  /**
   * Refreshes 60 seconds EARLY rather than reacting to a 401: a token that
   * expires mid-request produces a failure the user sees, and retrying after
   * the fact means every call needs retry logic.
   *
   * Returns null when the session is gone — including after a refresh-token
   * reuse has revoked the whole family, which is the API telling us the session
   * is compromised and must not be silently re-established.
   *
   * ════════════════════════════════════════════════════════════════════════
   * CONCURRENT CALLERS MUST SHARE ONE REFRESH, OR THEY REVOKE THE SESSION.
   *
   * Refresh tokens ROTATE, and presenting a rotated one is treated as theft —
   * correctly, because that is what replay looks like. So two callers that each
   * refresh with the same token end with the second triggering reuse detection
   * and the API revoking the entire family. The donor is signed out, and
   * nothing in the logs says why beyond "session is not valid".
   *
   * This is not hypothetical and it is not rare: a Next layout and the page
   * inside it render CONCURRENTLY, and on the donor dashboard both fetch. Every
   * single page view past the refresh window did it. It showed up first as a
   * test that failed on all four viewports after passing in isolation, which is
   * exactly the shape of a bug that only appears once two things run at once.
   *
   * `inFlight` collapses them into one, KEYED ON THE REFRESH TOKEN.
   *
   * The key is not optional bookkeeping. A single shared promise would be
   * shared by every visitor this server process is handling — so a request from
   * one donor, arriving while another donor's refresh was in flight, would
   * receive THAT DONOR'S ACCESS TOKEN and read their giving history with it.
   * Keying on the token means two callers share a refresh only when they are
   * genuinely refreshing the same session.
   *
   * The entry is deleted in a `finally`, so a failed refresh does not wedge
   * every later request for that session.
   * ════════════════════════════════════════════════════════════════════════
   */
  const inFlight = new Map<string, Promise<string | null>>();

  async function accessToken(): Promise<string | null> {
    const session = await read();
    if (!session) return null;

    if (Date.now() < session.expiresAt - 60_000) return session.accessToken;

    // Someone is already rotating THIS token. Wait for their result.
    const existing = inFlight.get(session.refreshToken);
    if (existing) return existing;

    const pending = refresh(session.refreshToken).finally(() => {
      inFlight.delete(session.refreshToken);
    });
    inFlight.set(session.refreshToken, pending);
    return pending;
  }

  async function refresh(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });

      if (!response.ok) {
        await clear();
        return null;
      }

      const body = (await response.json()) as {
        data: {
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
          actor: TActor;
        };
      };

      const refreshed: StoredSession<TActor> = {
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
        expiresAt: Date.now() + body.data.expiresIn * 1000,
        // The actor is re-read on every refresh, so a permission change takes
        // effect without signing out.
        actor: body.data.actor,
      };

      await write(refreshed);
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }

  async function actor(): Promise<TActor | null> {
    const token = await accessToken();
    if (!token) return null;
    return (await read())?.actor ?? null;
  }

  /*
    NO `cache()` WRAPPER HERE, DELIBERATELY.

    React's `cache` would dedupe within a single render, which sounds like
    exactly what the layout-and-page race needs — but this module is also called
    from a route handler (the BFF), which is not a render, and the scoping
    guarantees outside a render context are not ones to bet a session token on.
    The keyed map above already collapses those callers correctly and does not
    depend on framework internals to be safe.
  */
  return { read, write, clear, accessToken, actor };
}
