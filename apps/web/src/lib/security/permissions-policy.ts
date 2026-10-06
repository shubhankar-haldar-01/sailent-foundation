/**
 * The site's `Permissions-Policy` header.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `payment` IS ALLOWED FOR RAZORPAY, AND ONLY FOR RAZORPAY (Phase 11).
 *
 * It was `payment=()`, which turns the Payment Request API off for this page
 * AND every frame inside it — including Razorpay Checkout, which runs in a
 * frame from api.razorpay.com and uses that API for wallet and UPI-intent
 * payments on Android (Google Pay and others). The blanket ban risked exactly
 * the methods most donors here use. It is now limited to this origin and
 * Razorpay's two; every other origin is still refused.
 *
 * The rest is unchanged: no camera, microphone or geolocation for anyone.
 * Confirm on a real device during the Razorpay sandbox trial (human step).
 * ══════════════════════════════════════════════════════════════════════════
 */
export const RAZORPAY_PAYMENT_ORIGINS = [
  'https://api.razorpay.com',
  'https://checkout.razorpay.com',
] as const;

export const PERMISSIONS_POLICY = [
  'geolocation=()',
  'microphone=()',
  'camera=()',
  `payment=(self ${RAZORPAY_PAYMENT_ORIGINS.map((origin) => `"${origin}"`).join(' ')})`,
].join(', ');
