import { NextResponse, type NextRequest } from 'next/server';

import {
  MIDDLEWARE_REFRESH_MARGIN_MS,
  SESSION_AUDIENCES,
  refreshIfDue,
  sessionCookieOptions,
} from '@/lib/auth/session-refresh';

/**
 * Two jobs, in this order:
 *
 *   1. KEEP SIGNED-IN SESSIONS ALIVE, on every page (2026-10-09).
 *   2. Route protection for the two signed-in areas (docs/rbac.md).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 1. WHY THE REFRESH HAPPENS HERE.
 *
 * Access tokens live fifteen minutes. A page render cannot write a cookie, so
 * a refresh attempted during one rotated the token at the API and then lost
 * the new one — and the next use of the spent token was treated as theft and
 * revoked the session. Donors were signed out about fifteen minutes into a
 * visit, on whatever page they happened to open next.
 *
 * The middleware runs before any render and can set cookies, so it refreshes
 * a session that is within two minutes of expiry: the new cookie goes to the
 * browser AND into this request, so the page about to render sees it. A
 * session the API refuses is cleared rather than left to fail later. See
 * `lib/auth/session-refresh.ts`.
 *
 * It runs on every route except static files, so public pages, server actions
 * and the BFF all pass through; a request without a session cookie costs a
 * cookie lookup and nothing more.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 2. WHY MIDDLEWARE AND NOT A LAYOUT CHECK.
 *
 * A guard in the admin layout does not prevent the page from running: Next
 * renders layouts and their children IN PARALLEL, so a page's data fetch fires
 * before the layout's `redirect()` takes effect. The fetch then fails with a
 * 401 and the operator sees an error page instead of the sign-in form — which
 * is what happened before this file existed.
 *
 * Middleware runs before any rendering at all, so a request without a session
 * never reaches a page.
 *
 * WHAT THIS DOES AND DOES NOT CHECK.
 *
 * Presence of the session cookie, and nothing more. It does NOT validate the
 * token, decode it, or check permissions — that happens on every API call at
 * the Nest guard, which is the only place it can be done reliably.
 *
 * So this is a REDIRECT for the signed-out, not an authorization control. A
 * forged cookie gets someone an empty shell full of 401s and no data, which is
 * the correct outcome: the UI is not what protects anything. For donors in
 * particular, ownership is enforced in the SQL of every donor endpoint — the
 * API scopes each query by the session's donor id, so there is no request this
 * middleware could wave through that would return somebody else's giving.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * TWO AREAS, TWO COOKIES, TWO SIGN-IN PAGES.
 *
 * Staff and donors are different audiences with different credentials and
 * different tokens. A donor holding a donor cookie has no business in `/admin`
 * and must not be waved through it, and the reverse is equally true — so the
 * cookie checked depends on the area, and one is never accepted for the other.
 */
const AREAS = [
  {
    prefix: '/admin',
    cookie: 'sailent_staff_session',
    signIn: '/admin/login',
    /*
      Phase 13: reached from an email by somebody who cannot sign in yet —
      an invitee, or a staff member who has forgotten their password. Each
      authenticates by the single-use token in its link, not by a session.
    */
    open: ['/admin/accept-invite', '/admin/forgot-password', '/admin/reset-password'],
  },
  {
    prefix: '/dashboard',
    cookie: 'sailent_donor_session',
    signIn: '/sign-in',
    open: [],
  },
] as const;

type CookieChange = { name: string; value: string; maxAge: number } | { name: string; value: null };

export async function middleware(request: NextRequest) {
  // 1. Keep sessions alive. Each audience's cookie is refreshed on its own —
  //    a donor cookie never touches the staff session, or the reverse.
  const changes: CookieChange[] = [];
  for (const audience of SESSION_AUDIENCES) {
    const raw = request.cookies.get(audience.cookieName)?.value;
    if (!raw) continue;

    const result = await refreshIfDue(raw, {
      marginMs: MIDDLEWARE_REFRESH_MARGIN_MS,
      headers: request.headers,
    });
    if (result.kind === 'refreshed') {
      request.cookies.set(audience.cookieName, result.value);
      changes.push({
        name: audience.cookieName,
        value: result.value,
        maxAge: audience.maxAgeSeconds,
      });
    } else if (result.kind === 'signed-out') {
      request.cookies.delete(audience.cookieName);
      changes.push({ name: audience.cookieName, value: null });
    }
  }

  // 2. Route protection, against the cookies as they now stand.
  const response =
    protect(request) ??
    (changes.length > 0
      ? // Forward the updated cookies, so this request's render sees them.
        NextResponse.next({ request: { headers: request.headers } })
      : NextResponse.next());

  for (const change of changes) {
    if (change.value === null) response.cookies.delete(change.name);
    else response.cookies.set(change.name, change.value, sessionCookieOptions(change.maxAge));
  }
  return response;
}

/** A redirect to the area's sign-in page, or null to let the request through. */
function protect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  const area = AREAS.find(
    (candidate) => pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`),
  );
  if (!area) return null;

  // The sign-in page itself must stay reachable, or this is a redirect loop.
  if (pathname === area.signIn) return null;
  if ((area.open as readonly string[]).includes(pathname)) return null;

  if (!request.cookies.has(area.cookie)) {
    const url = request.nextUrl.clone();
    url.pathname = area.signIn;
    // Where they were going, so sign-in can return them there rather than
    // dumping everyone on the landing page.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return null;
}

export const config = {
  /**
   * Node, not Edge: the refresh reads the client address the same way the
   * rest of the server does, and keeps a short in-process memory of recent
   * refreshes (`session-refresh.ts`), which the Edge runtime does not promise.
   */
  runtime: 'nodejs',
  /**
   * Every route except static files and images. The BFF passes through for
   * the refresh only — it never gets a redirect (it is not under `/admin` or
   * `/dashboard`), so its clients still receive a JSON 401, not an HTML page.
   */
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
