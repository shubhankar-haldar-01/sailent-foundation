/**
 * Whether development fixtures (demo content) may be served (Phase 12).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * PARSED, AND NEVER ON IN PRODUCTION.
 *
 * This read `process.env.FEATURE_MOCK_DATA !== 'false'` in two places — the
 * bug the API fixed for itself in an earlier phase: `0`, `no`, a typo, or the
 * variable simply being unset all meant "serve demo content", including in
 * production, where an unreachable API then filled the site with invented
 * campaigns behind a demo banner.
 *
 * Now: always off when `APP_ENV=production` (and production startup refuses
 * the flag being on at all — `instrumentation.ts`); otherwise on by default
 * for local development, and off for `false` or `0`, the same spellings the
 * API's schema accepts.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function mockDataEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.APP_ENV === 'production') return false;
  const raw = env.FEATURE_MOCK_DATA?.trim().toLowerCase();
  if (raw === undefined || raw === '') return true;
  return raw === 'true' || raw === '1';
}
