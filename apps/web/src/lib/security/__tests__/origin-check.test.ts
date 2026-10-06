import { describe, expect, it } from 'vitest';

import { isTrustedRequestOrigin } from '../origin-check';

const headers = (values: Record<string, string>) => new Headers(values);
const config = {
  appUrl: 'https://sailent.example',
  trustedOrigins: 'https://admin.sailent.example',
};

/** Phase 12: state-changing requests through the BFF must come from this site. */
describe('isTrustedRequestOrigin', () => {
  it('lets reads through without checking', () => {
    expect(isTrustedRequestOrigin('GET', headers({ origin: 'https://evil.example' }), config)).toBe(
      true,
    );
  });

  it('accepts a write from the same origin as the request', () => {
    expect(
      isTrustedRequestOrigin(
        'POST',
        headers({ origin: 'http://localhost:3100', host: 'localhost:3100' }),
        config,
      ),
    ).toBe(true);
  });

  it('accepts a write from a configured origin', () => {
    for (const origin of ['https://sailent.example', 'https://admin.sailent.example']) {
      expect(
        isTrustedRequestOrigin('PATCH', headers({ origin, host: 'internal:3000' }), config),
      ).toBe(true);
    }
  });

  it('refuses a write from any other origin', () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(
        isTrustedRequestOrigin(
          method,
          headers({ origin: 'https://evil.example', host: 'sailent.example' }),
          config,
        ),
      ).toBe(false);
    }
    // A look-alike is not the same origin.
    expect(
      isTrustedRequestOrigin(
        'POST',
        headers({ origin: 'https://sailent.example.evil.example', host: 'x' }),
        config,
      ),
    ).toBe(false);
  });

  it('without Origin, accepts only a browser-declared same-origin request', () => {
    expect(
      isTrustedRequestOrigin('POST', headers({ 'sec-fetch-site': 'same-origin' }), config),
    ).toBe(true);
    expect(
      isTrustedRequestOrigin('POST', headers({ 'sec-fetch-site': 'cross-site' }), config),
    ).toBe(false);
    expect(isTrustedRequestOrigin('POST', headers({}), config)).toBe(false);
  });

  it('refuses a malformed Origin', () => {
    expect(isTrustedRequestOrigin('POST', headers({ origin: 'null', host: 'x' }), config)).toBe(
      false,
    );
  });
});
