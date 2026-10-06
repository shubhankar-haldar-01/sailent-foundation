/**
 * Cross-cutting constants that are genuinely shared between runtimes.
 * Domain constants belong to their own package or module — this file stays small.
 */

/** API version prefix. See docs/api-architecture.md §2. */
export const API_PREFIX = 'api/v1';

/** Header carrying the correlation id across web → API → worker. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Headers between our own services (Phase 11).
 *
 * `INTERNAL_AUTH_HEADER` carries `INTERNAL_API_SECRET`; `CLIENT_IP_HEADER` is
 * the real client address the web server determined. The API believes the
 * second ONLY alongside a valid first — the web server strips both from
 * anything a browser sends, so neither can be supplied from outside.
 */
export const INTERNAL_AUTH_HEADER = 'x-sailent-internal-auth';
export const CLIENT_IP_HEADER = 'x-sailent-client-ip';

/** Pagination defaults, shared so the client and server cannot disagree. */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const;

/**
 * Token audiences (decision A8). Donor and staff tokens are NOT interchangeable;
 * the audience guard rejects a mismatch before any permission lookup runs.
 */
export const TOKEN_AUDIENCE = {
  DONOR: 'donor',
  STAFF: 'staff',
} as const;
export type TokenAudience = (typeof TOKEN_AUDIENCE)[keyof typeof TOKEN_AUDIENCE];

/** Currency. INR only for v1 — FCRA is not registered (product-requirements §6). */
export const DEFAULT_CURRENCY = 'INR' as const;

/** Breakpoints, mirrored from the design system so JS and CSS agree. */
export const BREAKPOINTS = {
  xs: 320,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;
