import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  The sign-in actions talk to the API with `fetch`, read the client's address
  for the API's per-person limits, store the session, and redirect. All four
  are replaced here, so these tests pin what the actions DO with each answer
  the API can give — the refusal paths above all.
*/
const writeDonorSession = vi.fn();
vi.mock('@/lib/api/forwarding', () => ({ actionForwardingHeaders: async () => ({}) }));
vi.mock('../donor-session', () => ({
  readDonorSession: vi.fn(),
  writeDonorSession: (...args: unknown[]) => writeDonorSession(...args),
  clearDonorSession: vi.fn(),
}));
const redirect = vi.fn((path: string) => {
  // Next's `redirect` throws to stop rendering; so does this.
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));

const { requestSignInCode, verifySignInCode } = await import('../donor-actions');

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function answer(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  writeDonorSession.mockReset();
  redirect.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestSignInCode', () => {
  it('refuses something that is not an address, without asking the API', async () => {
    const state = await requestSignInCode({}, form({ email: 'my name' }));
    expect(state.error).toMatch(/email address/i);
    expect(state.sent).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('moves to the code step with the address normalised', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { data: { sent: true } }));
    const state = await requestSignInCode({}, form({ email: '  Asha@Example.COM ' }));
    expect(state).toEqual({ sent: true, email: 'asha@example.com' });
  });

  it('answers a known and an unknown address identically', async () => {
    fetchMock.mockResolvedValue(answer(200, { data: { sent: true } }));
    const known = await requestSignInCode({}, form({ email: 'donor@example.com' }));
    const unknown = await requestSignInCode({}, form({ email: 'stranger@example.com' }));
    expect(Object.keys(known).sort()).toEqual(Object.keys(unknown).sort());
    expect(known.sent).toBe(unknown.sent);
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const state = await requestSignInCode({}, form({ email: 'asha@example.com' }));
    expect(state.error).toMatch(/could not reach/i);
  });
});

describe('verifySignInCode', () => {
  const codeStep = { sent: true, email: 'asha@example.com' };

  it('refuses a code that is not six digits, without asking the API', async () => {
    const state = await verifySignInCode(
      codeStep,
      form({ email: 'asha@example.com', code: '12ab' }),
    );
    expect(state).toMatchObject({ sent: true, email: 'asha@example.com' });
    expect(state.error).toMatch(/six digits/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses without an address', async () => {
    const state = await verifySignInCode({}, form({ email: '', code: '123456' }));
    expect(state.error).toMatch(/email address/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays on the code step, with the API’s reason, when the code is wrong or expired', async () => {
    fetchMock.mockResolvedValueOnce(
      answer(400, { error: { message: 'That code has expired. Ask for a new one.' } }),
    );
    const state = await verifySignInCode(
      codeStep,
      form({ email: 'asha@example.com', code: '123456' }),
    );
    expect(state).toEqual({
      sent: true,
      email: 'asha@example.com',
      error: 'That code has expired. Ask for a new one.',
    });
    expect(writeDonorSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  const session = {
    data: {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
      actor: { id: 'donor-1', permissions: [] },
    },
  };

  it('signs in and goes where the donor was heading', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, session));
    await expect(
      verifySignInCode(
        codeStep,
        form({ email: 'asha@example.com', code: '123456', next: '/events/open-day' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/events/open-day');
    expect(writeDonorSession).toHaveBeenCalledOnce();
  });

  it('never redirects off the site, whatever `next` says', async () => {
    for (const next of ['//evil.test', 'https://evil.test', 'evil.test']) {
      fetchMock.mockResolvedValueOnce(answer(200, session));
      await expect(
        verifySignInCode(codeStep, form({ email: 'asha@example.com', code: '123456', next })),
      ).rejects.toThrow('NEXT_REDIRECT:/dashboard');
    }
  });
});
