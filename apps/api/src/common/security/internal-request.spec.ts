import { describe, expect, it } from 'vitest';

import { CLIENT_IP_HEADER, INTERNAL_AUTH_HEADER } from '@sailent/config';

import { presentsInternalSecret, trustedClientIp } from './internal-request.js';

const SECRET = 'x'.repeat(40);

/**
 * The client address is believed only with the shared secret (Phase 11).
 * Anything else falls back to the connecting address, never to a guess.
 */
describe('trustedClientIp', () => {
  it('returns the vouched-for address with the right secret', () => {
    expect(
      trustedClientIp(
        { [INTERNAL_AUTH_HEADER]: SECRET, [CLIENT_IP_HEADER]: '203.0.113.7' },
        SECRET,
      ),
    ).toBe('203.0.113.7');
    expect(
      trustedClientIp(
        { [INTERNAL_AUTH_HEADER]: SECRET, [CLIENT_IP_HEADER]: '2001:db8::1' },
        SECRET,
      ),
    ).toBe('2001:db8::1');
  });

  it('ignores the address without the secret, with a wrong one, or with none configured', () => {
    expect(trustedClientIp({ [CLIENT_IP_HEADER]: '203.0.113.7' }, SECRET)).toBeNull();
    expect(
      trustedClientIp(
        { [INTERNAL_AUTH_HEADER]: 'nope', [CLIENT_IP_HEADER]: '203.0.113.7' },
        SECRET,
      ),
    ).toBeNull();
    expect(
      trustedClientIp(
        { [INTERNAL_AUTH_HEADER]: SECRET, [CLIENT_IP_HEADER]: '203.0.113.7' },
        undefined,
      ),
    ).toBeNull();
  });

  it('ignores something that is not an IP address', () => {
    expect(
      trustedClientIp(
        { [INTERNAL_AUTH_HEADER]: SECRET, [CLIENT_IP_HEADER]: 'evil, 1.2.3.4' },
        SECRET,
      ),
    ).toBeNull();
  });

  it('never reads X-Forwarded-For', () => {
    expect(trustedClientIp({ 'x-forwarded-for': '198.51.100.9' }, SECRET)).toBeNull();
  });
});

describe('presentsInternalSecret', () => {
  it('compares the secret exactly', () => {
    expect(presentsInternalSecret({ [INTERNAL_AUTH_HEADER]: SECRET }, SECRET)).toBe(true);
    expect(presentsInternalSecret({ [INTERNAL_AUTH_HEADER]: `${SECRET}x` }, SECRET)).toBe(false);
    expect(presentsInternalSecret({}, SECRET)).toBe(false);
  });
});
