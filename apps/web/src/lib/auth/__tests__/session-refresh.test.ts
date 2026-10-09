import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseSession,
  refreshIfDue,
  rememberedRefreshes,
  resetRefreshCache,
} from '../session-refresh';

const MARGIN = 2 * 60_000;

function cookie(refreshToken: string, inMs: number, actor: object = { id: 'actor-1' }) {
  return JSON.stringify({
    accessToken: `access-${refreshToken}`,
    refreshToken,
    expiresAt: Date.now() + inMs,
    actor,
  });
}

function rotatingApi() {
  let issued = 0;
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { refreshToken } = JSON.parse(String(init.body)) as { refreshToken: string };
    issued += 1;
    return new Response(
      JSON.stringify({
        data: {
          accessToken: `access-${issued}`,
          refreshToken: `${refreshToken}-rotated-${issued}`,
          expiresIn: 900,
          actor: { id: 'actor-1', permissions: ['x'] },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
}

let fetchMock: ReturnType<typeof rotatingApi>;

beforeEach(() => {
  resetRefreshCache();
  fetchMock = rotatingApi();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseSession', () => {
  it('reads a well-formed session', () => {
    expect(parseSession(cookie('t', 1000))?.refreshToken).toBe('t');
  });

  it.each([
    ['nothing', undefined],
    ['an empty value', ''],
    ['garbled JSON', '{not json'],
    ['JSON that is not a session', JSON.stringify({ hello: 'world' })],
    ['a session without a refresh token', JSON.stringify({ accessToken: 'a', expiresAt: 1 })],
    [
      'a session with a non-numeric expiry',
      JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: 'soon' }),
    ],
  ])('treats %s as no session', (_label, raw) => {
    expect(parseSession(raw)).toBeNull();
  });
});

describe('refreshIfDue', () => {
  it('does not call the API for a session with time left', async () => {
    expect(await refreshIfDue(cookie('t', 10 * 60_000), { marginMs: MARGIN })).toEqual({
      kind: 'fresh',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs out a garbled cookie without calling the API', async () => {
    expect(await refreshIfDue('{not json', { marginMs: MARGIN })).toEqual({ kind: 'signed-out' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rotates a session that is due, keeping the actor fields the API does not send', async () => {
    const result = await refreshIfDue(
      cookie('t', 30_000, { id: 'actor-1', permissions: [], name: 'Asha' }),
      { marginMs: MARGIN },
    );
    expect(result.kind).toBe('refreshed');
    const saved = JSON.parse((result as { value: string }).value);
    expect(saved.refreshToken).toBe('t-rotated-1');
    expect(saved.actor).toEqual({ id: 'actor-1', permissions: ['x'], name: 'Asha' });
    expect(saved.expiresAt).toBeGreaterThan(Date.now() + 800_000);
  });

  it('makes ONE call for requests that arrive together with the same token', async () => {
    const raw = cookie('t', 30_000);
    const results = await Promise.all([
      refreshIfDue(raw, { marginMs: MARGIN }),
      refreshIfDue(raw, { marginMs: MARGIN }),
      refreshIfDue(raw, { marginMs: MARGIN }),
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it('gives a request that arrives a moment late, still holding the old cookie, the same result', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const raw = cookie('t', 30_000);
    const first = await refreshIfDue(raw, { marginMs: MARGIN });
    await vi.advanceTimersByTimeAsync(30_000);
    const late = await refreshIfDue(raw, { marginMs: MARGIN });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(late).toEqual(first);
  });

  it('sends a replay of the old token to the API once the minute is up, where reuse detection applies', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const raw = cookie('t', 30_000);
    await refreshIfDue(raw, { marginMs: MARGIN });
    await vi.advanceTimersByTimeAsync(61_000);

    // The API now refuses the spent token (and revokes its family).
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    expect(await refreshIfDue(raw, { marginMs: MARGIN })).toEqual({ kind: 'signed-out' });
  });

  it('never shares a result between two sessions', async () => {
    const [a, b] = await Promise.all([
      refreshIfDue(cookie('alpha', 30_000), { marginMs: MARGIN }),
      refreshIfDue(cookie('beta', 30_000), { marginMs: MARGIN }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse((a as { value: string }).value).refreshToken).toMatch(/^alpha-rotated/);
    expect(JSON.parse((b as { value: string }).value).refreshToken).toMatch(/^beta-rotated/);
  });

  it.each([401, 400, 403])('signs out when the API refuses the token (%i)', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status })),
    );
    expect(await refreshIfDue(cookie('t', 30_000), { marginMs: MARGIN })).toEqual({
      kind: 'signed-out',
    });
  });

  it.each([
    ['unreachable', () => Promise.reject(new TypeError('down'))],
    ['failing', () => Promise.resolve(new Response('{}', { status: 503 }))],
    ['rate-limiting', () => Promise.resolve(new Response('{}', { status: 429 }))],
    ['answering nonsense', () => Promise.resolve(new Response('not json', { status: 200 }))],
  ])('reports an error, and does not remember it, when the API is %s', async (_label, answer) => {
    const failing = vi.fn(answer);
    vi.stubGlobal('fetch', failing);
    const raw = cookie('t', 30_000);

    expect(await refreshIfDue(raw, { marginMs: MARGIN })).toEqual({ kind: 'error' });
    // Not cached: the next request tries again.
    await refreshIfDue(raw, { marginMs: MARGIN });
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('forgets a refresh a minute after it settles', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await refreshIfDue(cookie('t', 30_000), { marginMs: MARGIN });
    expect(rememberedRefreshes()).toBe(1);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(rememberedRefreshes()).toBe(0);
  });

  it('never remembers more than 5,000 refreshes, dropping the oldest first', async () => {
    const first = cookie('first', 30_000);
    await refreshIfDue(first, { marginMs: MARGIN });
    for (let index = 0; index < 5_000; index += 1) {
      await refreshIfDue(cookie(`t-${index}`, 30_000), { marginMs: MARGIN });
    }
    expect(rememberedRefreshes()).toBe(5_000);

    // The oldest was dropped, so its token goes to the API again.
    fetchMock.mockClear();
    await refreshIfDue(first, { marginMs: MARGIN });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
