/**
 * Web server startup checks (Phase 12).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE WEB SERVER VALIDATES ITS ENVIRONMENT, AND PRODUCTION FAILS CLOSED.
 *
 * It never did: `webEnvSchema` existed and nothing loaded it, so a production
 * deployment with demo fixtures switched on, no internal secret (site-wide
 * rate limits) or a localhost URL started without complaint. Next.js runs
 * `register()` once when the server starts; throwing here stops the start.
 *
 * In production it also refuses to start while the organisation's statutory
 * details are still the DEMO placeholders in `lib/demo-org.ts` — a live site
 * must not publish fake registration numbers (replaced in Phase 13).
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function register(): Promise<void> {
  // The edge runtime has no Node APIs and serves only the middleware.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { loadEnv, webEnvSchema } = await import('@sailent/config');
  const env = loadEnv(webEnvSchema, 'web');

  if (env.APP_ENV === 'production') {
    const { demoOrg } = await import('@/lib/demo-org');
    if (demoOrg.isDemo) {
      throw new Error(
        'Refusing to start in production: the organisation details in lib/demo-org.ts are DEMO placeholders.',
      );
    }
  }
}
