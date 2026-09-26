import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection for the two signed-in areas (docs/rbac.md).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY MIDDLEWARE AND NOT A LAYOUT CHECK.
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
  },
  {
    prefix: '/dashboard',
    cookie: 'sailent_donor_session',
    signIn: '/sign-in',
  },
] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const area = AREAS.find(
    (candidate) => pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`),
  );
  if (!area) return NextResponse.next();

  // The sign-in page itself must stay reachable, or this is a redirect loop.
  if (pathname === area.signIn) return NextResponse.next();

  if (!request.cookies.has(area.cookie)) {
    const url = request.nextUrl.clone();
    url.pathname = area.signIn;
    // Where they were going, so sign-in can return them there rather than
    // dumping everyone on the landing page.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * The two signed-in areas. Deliberately not the BFF: those requests carry their
   * own authorization and answer with a JSON 401 that the client handles — a
   * redirect to an HTML page in response to a fetch produces a parse error
   * rather than a useful message.
   */
  matcher: ['/admin/:path*', '/dashboard/:path*'],
};
