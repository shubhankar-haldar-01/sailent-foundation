import { ApiClient } from './client';

/**
 * Browser API client.
 *
 * Points at the Next.js BFF on the SAME ORIGIN, never at the API (decision A1).
 * Consequences that make this worth the extra hop:
 *   • one cookie domain, so no cross-site cookie configuration
 *   • no access token in JavaScript
 *   • CORS is closed on the API entirely
 *
 * The BFF route handlers are a transport layer. Any business logic that appears
 * in one is a bug — it belongs in a Nest service where it can be tested and audited.
 */
export const browserApi = new ApiClient({
  baseUrl: '/api/bff',
  defaultTimeoutMs: 15_000,
});
