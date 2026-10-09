// @vitest-environment node
// The middleware runs on Node (`runtime: 'nodejs'`), not in a browser.
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRefreshCache } from '@/lib/auth/session-refresh';

import { middleware } from '../middleware';

const DONOR = 'sailent_donor_session';
const STAFF = 'sailent_staff_session';

/** A well-formed session cookie value, expiring `inMs` from now. */
function sessionValue(refreshToken: string, inMs: number, actor: object = { id: 'actor-1' }) {
  return JSON.stringify({
    accessToken: `access-${refreshToken}`,
    refreshToken,
    expiresAt: Date.now() + inMs,
    actor,
  });
}

const FRESH = 10 * 60_000;
const DUE = 30_000;

function visit(path: string, cookies: Record<string, string> = {}) {
  const header = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
  return middleware(
    new NextRequest(`http://localhost:3000${path}`, {
      headers: header ? { cookie: header } : {},
    }),
  );
}

/** What the API answers to `POST /auth/refresh`, by status. */
function apiAnswers(status: number, refreshToken = 'rotated-token') {
  return vi.fn(async () =>
    status === 200
      ? new Response(
          JSON.stringify({
            data: {
              accessToken: 'new-access',
              refreshToken,
              expiresIn: 900,
              actor: { id: 'actor-1', permissions: [] },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      : new Response(JSON.stringify({ error: { message: 'no' } }), { status }),
  );
}

let fetchMock: ReturnType<typeof apiAnswers>;

beforeEach(() => {
  resetRefreshCache();
  fetchMock = apiAnswers(200);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Phase 13: the invitation and password pages are reached by somebody who
 * cannot sign in yet, so they must not bounce to sign-in — and nothing else
 * under /admin may become reachable without a session.
 */
describe('middleware — route protection', () => {
  it.each([
    '/admin/accept-invite',
    '/admin/forgot-password',
    '/admin/reset-password',
    '/admin/login',
  ])('%s is reachable without a session', async (path) => {
    expect((await visit(path)).headers.get('location')).toBeNull();
  });

  it.each(['/admin', '/admin/messages', '/admin/accept-invite-x', '/admin/reset-password/extra'])(
    '%s still needs a session',
    async (path) => {
      expect((await visit(path)).headers.get('location')).toContain('/admin/login');
    },
  );

  it('lets a signed-in staff member through', async () => {
    const response = await visit('/admin/messages', { [STAFF]: sessionValue('staff-1', FRESH) });
    expect(response.headers.get('location')).toBeNull();
  });

  it('sends a signed-out visitor to the donor sign-in, keeping where they were going', async () => {
    const location = (await visit('/dashboard/donations')).headers.get('location');
    expect(location).toContain('/sign-in');
    expect(location).toContain('next=%2Fdashboard%2Fdonations');
  });
});

/**
 * 2026-10-09: sessions are refreshed HERE, before any render, because a render
 * cannot save the new cookie — refreshing there spent the token, lost the new
 * one, and the next replay revoked the session.
 */
describe('middleware — keeping sessions alive', () => {
  it('does nothing for a visitor without a session', async () => {
    const response = await visit('/');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('leaves a session with time left alone', async () => {
    const response = await visit('/', { [DONOR]: sessionValue('donor-1', FRESH) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get(DONOR)).toBeUndefined();
  });

  it.each(['/', '/campaigns/school-kits-jharkhand', '/dashboard'])(
    'refreshes a donor session about to expire on %s, for the browser and for this render',
    async (path) => {
      const response = await visit(path, {
        [DONOR]: sessionValue('donor-1', DUE, { id: 'donor-1', permissions: [], name: 'Asha' }),
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'donor-1' });

      // The browser gets the rotated session…
      const saved = JSON.parse(response.cookies.get(DONOR)!.value);
      expect(saved).toMatchObject({ accessToken: 'new-access', refreshToken: 'rotated-token' });
      // …keeping the display name the API does not send back.
      expect(saved.actor.name).toBe('Asha');
      expect(response.headers.get('location')).toBeNull();

      // …and so does the page about to render (Next's forwarded request cookies).
      expect(response.headers.get('x-middleware-request-cookie') ?? '').toContain('rotated-token');
    },
  );

  it.each([
    [401, 'an expired, revoked or replayed refresh token'],
    [403, 'a refused session'],
    [400, 'a forged refresh token'],
  ])(
    'clears the cookie and sends the donor to sign-in when the API answers %i (%s)',
    async (status) => {
      vi.stubGlobal('fetch', apiAnswers(status));
      const response = await visit('/dashboard', { [DONOR]: sessionValue('donor-1', DUE) });

      expect(response.headers.get('location')).toContain('/sign-in');
      expect(response.cookies.get(DONOR)?.value ?? '').toBe('');
    },
  );

  it('clears a garbled cookie without asking the API, and does not loop', async () => {
    const response = await visit('/dashboard', { [DONOR]: '{not json' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.cookies.get(DONOR)?.value ?? '').toBe('');

    // The sign-in page itself is reachable with the same cookie — no loop.
    expect((await visit('/sign-in', { [DONOR]: '{not json' })).headers.get('location')).toBeNull();
  });

  it.each([
    ['the API cannot be reached', () => vi.fn(async () => Promise.reject(new TypeError('down')))],
    ['the API fails', () => apiAnswers(500)],
    ['the API rate-limits the refresh', () => apiAnswers(429)],
  ])('keeps the session when %s', async (_label, makeFetch) => {
    vi.stubGlobal('fetch', makeFetch());
    const value = sessionValue('donor-1', DUE);
    const response = await visit('/dashboard', { [DONOR]: value });

    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get(DONOR)).toBeUndefined();
  });

  it('refreshes a staff session in /admin with the staff token only', async () => {
    const response = await visit('/admin/messages', {
      [STAFF]: sessionValue('staff-1', DUE),
      [DONOR]: sessionValue('donor-1', FRESH),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'staff-1' });
    expect(response.cookies.get(STAFF)?.value).toContain('rotated-token');
    // The donor session is untouched.
    expect(response.cookies.get(DONOR)).toBeUndefined();
  });

  it('never refreshes one audience with the other’s token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const { refreshToken } = JSON.parse(String(init.body)) as { refreshToken: string };
        return new Response(
          JSON.stringify({
            data: {
              accessToken: `new-${refreshToken}`,
              refreshToken: `rotated-${refreshToken}`,
              expiresIn: 900,
              actor: { id: refreshToken, permissions: [] },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await visit('/', {
      [STAFF]: sessionValue('staff-1', DUE),
      [DONOR]: sessionValue('donor-1', DUE),
    });

    expect(JSON.parse(response.cookies.get(DONOR)!.value).refreshToken).toBe('rotated-donor-1');
    expect(JSON.parse(response.cookies.get(STAFF)!.value).refreshToken).toBe('rotated-staff-1');
  });
});
