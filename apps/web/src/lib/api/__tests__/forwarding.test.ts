import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

import { clientForwardingHeaders } from '../forwarding';

const incoming = (values: Record<string, string>) => new Headers(values);

/**
 * The web server vouches for a client address only when the deployment has
 * said where to find it AND holds the secret the API checks it with.
 */
describe('clientForwardingHeaders', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends nothing without the secret, whatever the request says', () => {
    vi.stubEnv('INTERNAL_API_SECRET', '');
    vi.stubEnv('CLIENT_IP_HEADER', 'x-client-ip');
    expect(clientForwardingHeaders(incoming({ 'x-client-ip': '203.0.113.7' }))).toEqual({});
  });

  it('sends nothing when no client address can be derived', () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'a-test-secret-of-sufficient-length');
    vi.stubEnv('CLIENT_IP_HEADER', '');
    expect(clientForwardingHeaders(incoming({ 'x-client-ip': '203.0.113.7' }))).toEqual({});

    vi.stubEnv('CLIENT_IP_HEADER', 'x-client-ip');
    expect(clientForwardingHeaders(incoming({}))).toEqual({});
    expect(clientForwardingHeaders(incoming({ 'x-client-ip': 'not-an-address' }))).toEqual({});
  });

  it('ignores the internal headers a browser sends, and the entries it wrote itself', () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'a-test-secret-of-sufficient-length');
    vi.stubEnv('CLIENT_IP_HEADER', 'x-forwarded-for');
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
    const forged = incoming({
      [CLIENT_IP_HEADER]: '198.51.100.66',
      [INTERNAL_AUTH_HEADER]: 'a-guess',
      // The browser wrote the first entry; our one proxy appended the real one.
      'x-forwarded-for': '198.51.100.66, 203.0.113.7',
    });
    expect(clientForwardingHeaders(forged)).toEqual({
      [INTERNAL_AUTH_HEADER]: 'a-test-secret-of-sufficient-length',
      [CLIENT_IP_HEADER]: '203.0.113.7',
    });
  });

  it('refuses a configuration that reads the address from an internal header', () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'a-test-secret-of-sufficient-length');
    vi.stubEnv('CLIENT_IP_HEADER', CLIENT_IP_HEADER);
    expect(clientForwardingHeaders(incoming({ [CLIENT_IP_HEADER]: '198.51.100.66' }))).toEqual({});
  });

  it('vouches for the derived address with the secret', () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'a-test-secret-of-sufficient-length');
    vi.stubEnv('CLIENT_IP_HEADER', 'x-client-ip');
    expect(clientForwardingHeaders(incoming({ 'x-client-ip': '203.0.113.7' }))).toEqual({
      [INTERNAL_AUTH_HEADER]: 'a-test-secret-of-sufficient-length',
      [CLIENT_IP_HEADER]: '203.0.113.7',
    });
  });
});
