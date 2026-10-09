import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  The session store, where it renders vs. where it can save.

  `cookies()` is replaced: `canSet` decides whether `set` works (a server
  action or route handler) or throws (a page render, as Next.js does).
*/
const jar = new Map<string, string>();
let canSet = true;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      if (!canSet) {
        throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
      }
      jar.set(name, value);
    },
    delete: (name: string) => {
      if (!canSet)
        throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
      jar.delete(name);
    },
  }),
}));

const { createSessionStore } = await import('../token-store');

const store = createSessionStore<{ id: string; name?: string }>({
  cookieName: 'test_session',
  maxAgeSeconds: 60,
});

function save(inMs: number) {
  jar.set(
    'test_session',
    JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: Date.now() + inMs,
      actor: { id: 'a', name: 'Asha' },
    }),
  );
}

const fetchMock = vi.fn(
  async () =>
    new Response(
      JSON.stringify({
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: 900,
          actor: { id: 'a' },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
);

beforeEach(() => {
  jar.clear();
  canSet = true;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session store — never rotate a token that cannot be saved', () => {
  it('in a page render, uses a token that is due but still valid, and does not call the API', async () => {
    save(30_000);
    canSet = false;
    expect(await store.accessToken()).toBe('old-access');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('in a page render, answers "signed out" for an expired token rather than rotating it', async () => {
    save(-1_000);
    canSet = false;
    expect(await store.accessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // The cookie is left as it was, for the middleware to refresh.
    expect(JSON.parse(jar.get('test_session')!).refreshToken).toBe('old-refresh');
  });

  it('where cookies can be saved, refreshes and saves the new session, keeping the name', async () => {
    save(30_000);
    expect(await store.accessToken()).toBe('new-access');
    expect(fetchMock).toHaveBeenCalledOnce();
    const saved = JSON.parse(jar.get('test_session')!);
    expect(saved.refreshToken).toBe('new-refresh');
    expect(saved.actor).toEqual({ id: 'a', name: 'Asha' });
  });

  it('does not call the API for a token with time left', async () => {
    save(10 * 60_000);
    canSet = false;
    expect(await store.accessToken()).toBe('old-access');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
