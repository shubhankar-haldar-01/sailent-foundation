import { describe, expect, it } from 'vitest';

import { PERMISSIONS_POLICY } from '../permissions-policy';

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
