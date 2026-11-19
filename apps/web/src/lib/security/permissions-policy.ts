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
 * The rest is unchanged: no camera, microphone or geolocation for anyone —
 * except the camera on the two gate scanner pages, below.
 * Confirm on a real device during the Razorpay sandbox trial (human step).
 * ══════════════════════════════════════════════════════════════════════════
 */
export const RAZORPAY_PAYMENT_ORIGINS = [
  'https://api.razorpay.com',
  'https://checkout.razorpay.com',
] as const;

function permissionsPolicy(camera: '()' | '(self)'): string {
  return [
    'geolocation=()',
    'microphone=()',
    `camera=${camera}`,
    `payment=(self ${RAZORPAY_PAYMENT_ORIGINS.map((origin) => `"${origin}"`).join(' ')})`,
  ].join(', ');
}

export const PERMISSIONS_POLICY = permissionsPolicy('()');

/**
 * THE GATE SCANNERS READ QR PASSES WITH THE CAMERA, so their two pages allow
 * it — for this site only, never for a frame from anywhere else. Every other
 * page keeps `camera=()`. `next.config.ts` sends this after the site-wide
 * header for these routes, and the later header wins.
 *
 * A browser still asks the person before the camera turns on, and it only
 * offers the camera on a secure page (https, or localhost on the computer
 * itself).
 */
export const SCANNER_PERMISSIONS_POLICY = permissionsPolicy('(self)');

/** The pages that scan passes: the gate kiosk and an event's check-in page. */
export const SCANNER_ROUTES = ['/admin/gate/:id', '/admin/events/:id/check-in'] as const;
