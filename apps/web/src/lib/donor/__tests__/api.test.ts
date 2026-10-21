import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

const incoming = new Headers();
vi.mock('next/headers', () => ({ headers: async () => incoming }));
vi.mock('@/lib/auth/donor-session', () => ({ getDonorAccessToken: async () => 'a-donor-token' }));

const { donorFetch } = await import('../api');

/**
 * A server-rendered donor page calls the API as that donor's client: the
 * forwarding headers go with the call when the deployment provides them, and
 * nothing extra goes when it does not.
 */
describe('donorFetch', () => {
  const sent: Record<string, string>[] = [];

  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: URL, init: RequestInit) => {
        sent.push(init.headers as Record<string, string>);
        return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    incoming.delete('x-client-ip');
  });

  it("forwards the donor's address, vouched for, when configured", async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'a-test-secret-of-sufficient-length');
    vi.stubEnv('CLIENT_IP_HEADER', 'x-client-ip');
    incoming.set('x-client-ip', '203.0.113.7');

    await donorFetch('me');

    expect(sent[0]).toMatchObject({
      Authorization: 'Bearer a-donor-token',
      [INTERNAL_AUTH_HEADER]: 'a-test-secret-of-sufficient-length',
      [CLIENT_IP_HEADER]: '203.0.113.7',
    });
  });

  it('adds nothing when the deployment does not configure it', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', '');
    vi.stubEnv('CLIENT_IP_HEADER', '');
    incoming.set('x-client-ip', '203.0.113.7');

    await donorFetch('me');

    expect(sent[0]).toEqual({ Authorization: 'Bearer a-donor-token' });
  });
});
