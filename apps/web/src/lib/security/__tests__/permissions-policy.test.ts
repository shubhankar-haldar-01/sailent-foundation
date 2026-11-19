import { describe, expect, it } from 'vitest';

import config from '../../../../next.config';
import {
  PERMISSIONS_POLICY,
  SCANNER_PERMISSIONS_POLICY,
  SCANNER_ROUTES,
} from '../permissions-policy';

/**
 * Phase 11: `payment=()` blocked the Payment Request API inside Razorpay
 * Checkout's frame. Payment is now allowed for this origin and Razorpay only;
 * the other restrictions are unchanged.
 */
describe('PERMISSIONS_POLICY', () => {
  it('allows payment for this site and Razorpay Checkout only', () => {
    expect(PERMISSIONS_POLICY).toContain(
      'payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
    );
    expect(PERMISSIONS_POLICY).not.toContain('payment=()');
  });

  it('keeps camera, microphone and geolocation off for everyone', () => {
    expect(PERMISSIONS_POLICY).toContain('camera=()');
    expect(PERMISSIONS_POLICY).toContain('microphone=()');
    expect(PERMISSIONS_POLICY).toContain('geolocation=()');
  });
});

/**
 * The gate scanners read QR passes with the camera. Their two pages allow it
 * for this site only; every other page keeps it off (the test above).
 */
describe('SCANNER_PERMISSIONS_POLICY', () => {
  it('allows the camera for this site only, and nothing else changes', () => {
    expect(SCANNER_PERMISSIONS_POLICY).toContain('camera=(self)');
    expect(SCANNER_PERMISSIONS_POLICY).not.toContain('camera=()');
    expect(SCANNER_PERMISSIONS_POLICY).toContain('microphone=()');
    expect(SCANNER_PERMISSIONS_POLICY).toContain('geolocation=()');
    expect(SCANNER_PERMISSIONS_POLICY.replace('camera=(self)', 'camera=()')).toBe(
      PERMISSIONS_POLICY,
    );
  });

  it('is sent on the two scanner pages, after the site-wide header so it wins', async () => {
    const rules = await config.headers!();
    const siteWide = rules.findIndex((rule) => rule.source === '/:path*');
    const policyFor = (source: string) =>
      rules
        .filter((rule) => rule.source === source)
        .flatMap((rule) => rule.headers)
        .filter((header) => header.key === 'Permissions-Policy')
        .map((header) => header.value);

    expect(policyFor('/:path*')).toEqual([PERMISSIONS_POLICY]);
    expect([...SCANNER_ROUTES]).toEqual(['/admin/gate/:id', '/admin/events/:id/check-in']);
    for (const route of SCANNER_ROUTES) {
      expect(policyFor(route)).toEqual([SCANNER_PERMISSIONS_POLICY]);
      expect(rules.findIndex((rule) => rule.source === route)).toBeGreaterThan(siteWide);
    }
  });
});
