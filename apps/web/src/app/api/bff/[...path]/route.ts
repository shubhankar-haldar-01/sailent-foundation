import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { API_PREFIX, REQUEST_ID_HEADER } from '@sailent/config';

import { clientForwardingHeaders, INTERNAL_HEADERS } from '@/lib/api/forwarding';
import { getDonorAccessToken } from '@/lib/auth/donor-session';
import { getAccessToken } from '@/lib/auth/session';

/**
 * Backend-for-frontend proxy (decision A1).
 *
 * The browser calls `/api/bff/*` on this origin; this handler attaches the
 * session token SERVER-SIDE and forwards to the API. Consequences:
 *   • no access token ever reaches client-side JavaScript, so an XSS bug does
 *     not immediately become a session-theft bug
 *   • one cookie domain, so no cross-site cookie configuration
 *   • CORS stays closed on the API
 *
 * THIS IS A TRANSPORT LAYER. It authenticates, forwards and propagates the
 * correlation id. Any business logic that appears here is a bug — it belongs in
 * a Nest service where it can be tested, audited and reused by the worker.
 *
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Path prefixes served by the DONOR session.
 *
 * `me` is the donor's own account. Nothing else is on this list, and adding to
 * it should be a deliberate act reviewed as one.
 */
const DONOR_PREFIXES = new Set(['me']);

function isDonorPath(path: string[]): boolean {
  return path.length > 0 && DONOR_PREFIXES.has(path[0]!);
}

/** Hop-by-hop and identity headers that must not be forwarded verbatim. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  // The browser's cookies are for THIS origin. The API gets a bearer token
  // attached below, never the raw cookie jar.
  'cookie',
  // Ours to set, never the browser's: the API believes the client address
  // only alongside the internal secret, and both are added below (Phase 11).
  ...INTERNAL_HEADERS,
]);

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? randomUUID();
  const target = new URL(`${API_PREFIX}/${path.join('/')}`, ensureTrailingSlash(API_BASE));
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set(REQUEST_ID_HEADER, requestId);
  for (const [key, value] of Object.entries(clientForwardingHeaders(request.headers))) {
    headers.set(key, value);
  }

  /**
   * The token is attached HERE, server-side, from the httpOnly cookie — the
   * whole reason this proxy exists (decision A1). The browser never holds it.
   *
   * ════════════════════════════════════════════════════════════════════════
   * WHICH token depends on the path, and EXACTLY ONE is ever sent.
   *
   * There are two audiences with two cookies, and one person can hold both: a
   * staff member who also donates is a normal person. Sending both, or picking
   * whichever happens to exist, would mean the identity of a request depended
   * on the state of a cookie jar.
   *
   * So the path decides, and it decides on the ALLOW-LIST below rather than by
   * excluding `/admin`. A new donor route added under some other prefix then
   * fails closed — it gets the staff token, which does not verify on a donor
   * route, and the mistake surfaces as a 401 in development instead of as a
   * staff token being offered to a donor-facing endpoint.
   * ════════════════════════════════════════════════════════════════════════
   */
  const token = isDonorPath(path) ? await getDonorAccessToken() : await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
      // Proxied calls are per-user and must never be shared from a cache.
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });

    const body = await response.arrayBuffer();
    const outbound = new Headers();
    const contentType = response.headers.get('content-type');
    if (contentType) outbound.set('content-type', contentType);
    outbound.set(REQUEST_ID_HEADER, response.headers.get(REQUEST_ID_HEADER) ?? requestId);

    return new NextResponse(body, { status: response.status, headers: outbound });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    // Matches the API's error envelope so the client has one shape to handle.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isTimeout ? 'REQUEST_TIMEOUT' : 'SERVICE_UNAVAILABLE',
          message: isTimeout ? 'The request took too long.' : 'Could not reach the server.',
          requestId,
        },
      },
      { status: 503, headers: { [REQUEST_ID_HEADER]: requestId } },
    );
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
