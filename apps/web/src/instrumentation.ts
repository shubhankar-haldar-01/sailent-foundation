import type { ErrorReporter } from '@sailent/config';

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
 * DEMO ORGANISATION DATA. Phase 12 also refused to start while
 * `lib/demo-org.ts` held DEMO values. Since Phase 13 the organisation's
 * details come from Admin → Settings, and `getOrganisation()` uses a demo
 * value only while mock data is on — which the schema below refuses in
 * production, and `mockDataEnabled()` never allows with APP_ENV=production.
 * The guarantee ("no fake registration numbers on a live site") is therefore
 * enforced where the values are read, and a missing detail is simply left
 * out until staff enter it.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function register(): Promise<void> {
  // The edge runtime has no Node APIs and serves only the middleware.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { loadEnv, webEnvSchema } = await import('@sailent/config');
  loadEnv(webEnvSchema, 'web');
}

/*
  SERVER-SIDE ERROR TRACKING (Phase 14). Next.js calls this for every error
  thrown while rendering a page, a route handler or a server action. It goes
  to the same Sentry-compatible reporter as the API and worker
  (`@sailent/config`), scrubbed, and only when SENTRY_DSN is set.

  What is sent: the error, the route PATTERN (`/campaigns/[slug]`, never the
  real path, which can carry a slug or a token), the method and the kind of
  route. No headers, no body, no cookies, no search params.

  Browser-side errors are NOT reported: that would need a public DSN in the
  page, a CSP change and a consent decision (Phase 14 decision, DEPLOYMENT.md).
*/
let reporter: ErrorReporter | null = null;

async function getReporter(): Promise<ErrorReporter> {
  if (reporter) return reporter;
  const { createErrorReporter } = await import('@sailent/config');
  reporter = createErrorReporter({
    dsn: process.env.SENTRY_DSN || undefined,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.APP_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    service: 'sailent-web',
  });
  return reporter;
}

export async function onRequestError(
  error: unknown,
  request: { method: string },
  context: { routePath: string; routeType: string; routerKind?: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    (await getReporter()).capture(error, {
      tags: { route: context.routePath, method: request.method, routeType: context.routeType },
    });
  } catch {
    // Reporting never becomes the failure.
  }
}
