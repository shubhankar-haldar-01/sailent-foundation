import { describe, expect, it } from 'vitest';

import { clientIpFrom } from '../client-ip';

const headers = (values: Record<string, string>) => new Headers(values);

/**
 * Phase 11: the web server works out the real client address only where the
 * deployment says how — and never believes what the browser wrote.
 */
describe('clientIpFrom', () => {
  it('derives nothing when no header is configured — the safe default', () => {
    expect(clientIpFrom(headers({ 'x-forwarded-for': '203.0.113.7' }), {})).toBeNull();
  });

  it('takes the entry our own proxy appended, not the ones the browser wrote', () => {
    // The browser sent "1.1.1.1"; our one trusted proxy appended the real address.
    const forwarded = headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7' });
    expect(clientIpFrom(forwarded, { header: 'x-forwarded-for', trustedHops: 1 })).toBe(
      '203.0.113.7',
    );
    // Two trusted proxies: the client is two from the end.
    const twoHops = headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7, 10.0.0.5' });
    expect(clientIpFrom(twoHops, { header: 'x-forwarded-for', trustedHops: 2 })).toBe(
      '203.0.113.7',
    );
  });

  it('reads a single-value header set by the edge', () => {
    expect(
      clientIpFrom(headers({ 'cf-connecting-ip': '2001:db8::7' }), { header: 'cf-connecting-ip' }),
    ).toBe('2001:db8::7');
  });

  it('refuses anything that is not an address, or a chain shorter than the hops', () => {
    expect(
      clientIpFrom(headers({ 'x-forwarded-for': 'not-an-ip' }), { header: 'x-forwarded-for' }),
    ).toBeNull();
    expect(
      clientIpFrom(headers({ 'x-forwarded-for': '203.0.113.7' }), {
        header: 'x-forwarded-for',
        trustedHops: 3,
      }),
    ).toBeNull();
    expect(clientIpFrom(headers({}), { header: 'x-real-ip' })).toBeNull();
  });
});
