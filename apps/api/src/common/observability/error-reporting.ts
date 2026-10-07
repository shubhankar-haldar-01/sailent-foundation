import { createErrorReporter, type ErrorContext, type ErrorReporter } from '@sailent/config';

/**
 * Error tracking for the API (Phase 14).
 *
 * Sentry-compatible, through the dependency-free reporter in
 * `@sailent/config` (`error-reporter.ts` explains why not the SDK). OFF
 * unless `SENTRY_DSN` is set. Every event is scrubbed there: no request
 * bodies, cookies, query strings, users, unsafe headers, tokens, keys, PANs
 * or email addresses.
 *
 * What is reported: every 5xx from the exception filter (request id, method,
 * route path, status, error code) and a failed bootstrap — so a Sentry issue
 * can be matched to the Cloud Logging line with the same `requestId`.
 */
let reporter: ErrorReporter = createErrorReporter({
  environment: 'development',
  service: 'sailent-api',
});

export interface ErrorReportingConfig {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  APP_ENV: string;
}

export function initErrorReporting(config: ErrorReportingConfig, service: string): boolean {
  reporter = createErrorReporter({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT ?? config.APP_ENV,
    release: config.SENTRY_RELEASE,
    service,
  });
  return reporter.enabled;
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  reporter.capture(error, context);
}

/** Send what is in flight before the process exits. */
export async function flushErrorReporting(timeoutMs = 2_000): Promise<void> {
  await reporter.flush(timeoutMs);
}
