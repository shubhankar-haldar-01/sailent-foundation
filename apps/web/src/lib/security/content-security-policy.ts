import { RAZORPAY_PAYMENT_ORIGINS } from './permissions-policy';

/**
 * The site's Content-Security-Policy (Phase 12).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IT ALLOWS, AND WHY EACH LINE IS THERE.
 *
 *   default-src 'self'          everything not named below: this origin only
 *   script-src  'self' 'unsafe-inline' checkout.razorpay.com
 *                               Next.js inlines its hydration scripts. A
 *                               nonce-based policy would remove
 *                               'unsafe-inline', but nonces need every page
 *                               rendered per request, which would end the
 *                               caching the public site depends on — a
 *                               deliberate trade-off, recorded in SECURITY.md.
 *                               Scripts from any OTHER origin are refused,
 *                               which is what stops an injected <script src>.
 *   style-src   'self' 'unsafe-inline'   Next.js and the component library
 *   img-src     'self' data: blob: https:  campaign and media images (R2, any
 *                               CDN in front of it) and Razorpay's logos
 *   font-src    'self' data:    fonts are self-hosted by next/font
 *   connect-src 'self' *.razorpay.com   the browser talks only to this site
 *                               (the BFF) and to Razorpay Checkout
 *   frame-src   'self' Razorpay        Checkout's window; 'self' for the
 *                               admin email preview
 *   frame-ancestors 'none'      nobody may frame this site (with X-Frame-
 *                               Options: DENY for older browsers)
 *   form-action 'self'          forms post only here
 *   base-uri 'self', object-src 'none'
 *
 * In development `'unsafe-eval'` and websockets are added for React refresh.
 * `upgrade-insecure-requests` is added for production (served over HTTPS
 * only), alongside HSTS.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function contentSecurityPolicy(options: {
  development: boolean;
  production: boolean;
}): string {
  const razorpay = [...RAZORPAY_PAYMENT_ORIGINS];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      'https://checkout.razorpay.com',
      ...(options.development ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      'https://*.razorpay.com',
      ...(options.development ? ['ws:', 'wss:'] : []),
    ],
    'frame-src': ["'self'", ...razorpay],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (options.production) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/**
 * HSTS for a production deployment (served over HTTPS only): two years,
 * including subdomains. Not `preload` — that is a commitment the owner makes
 * for the domain, not something the application should decide.
 */
export const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';
