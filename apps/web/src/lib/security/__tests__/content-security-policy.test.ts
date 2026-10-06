import { describe, expect, it } from 'vitest';

import { STRICT_TRANSPORT_SECURITY, contentSecurityPolicy } from '../content-security-policy';

const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? '';

/** Phase 12: the site's CSP, which must keep Razorpay Checkout working. */
describe('contentSecurityPolicy', () => {
  const production = contentSecurityPolicy({ development: false, production: true });

  it('allows scripts only from this origin and Razorpay Checkout', () => {
    const scripts = directive(production, 'script-src');
    expect(scripts).toContain("'self'");
    expect(scripts).toContain('https://checkout.razorpay.com');
    expect(scripts.split(' ')).not.toContain('https:');
    expect(scripts.split(' ')).not.toContain('*');
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("lets Razorpay's frame load and keeps the site out of anyone else's frames", () => {
    expect(directive(production, 'frame-src')).toContain('https://api.razorpay.com');
    expect(directive(production, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(production, 'object-src')).toBe("object-src 'none'");
    expect(directive(production, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(production, 'form-action')).toBe("form-action 'self'");
  });

  it('upgrades insecure requests in production only', () => {
    expect(production).toContain('upgrade-insecure-requests');
    expect(contentSecurityPolicy({ development: false, production: false })).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it("adds 'unsafe-eval' for the development server only", () => {
    expect(
      directive(contentSecurityPolicy({ development: true, production: false }), 'script-src'),
    ).toContain("'unsafe-eval'");
  });

  it('sets a two-year HSTS with subdomains', () => {
    expect(STRICT_TRANSPORT_SECURITY).toBe('max-age=63072000; includeSubDomains');
  });
});
