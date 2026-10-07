import { redactSensitiveText, scrubErrorEvent } from './observability.js';

/**
 * A small Sentry-compatible error reporter (Phase 14).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY NOT THE SENTRY SDK.
 *
 * `@sentry/node` 11 brings OpenTelemetry, bundler plugins and runtime
 * injection. Installing it split `drizzle-orm` into two copies (an optional
 * OpenTelemetry peer) and broke the API's types, it needs special handling
 * inside the Next.js server bundle, and its default integrations capture
 * request bodies and IP addresses unless each one is switched off.
 *
 * This sends errors to Sentry's documented ingestion endpoint (the
 * "envelope" API) with nothing else attached: exception type, message and
 * stack frames, the service, environment and release, and the tags a caller
 * passes. Every event goes through `scrubErrorEvent` first. No dependency,
 * no automatic instrumentation, nothing captured that was not chosen.
 *
 * It never throws and never blocks a request: sends are fire-and-forget with
 * a timeout, at most `MAX_EVENTS_PER_MINUTE` per process (an error storm must
 * not become a storm of outbound requests), and `flush()` waits for what is
 * in flight on shutdown.
 *
 * OFF unless a DSN is configured: development and tests send nothing.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const MAX_EVENTS_PER_MINUTE = 30;
const SEND_TIMEOUT_MS = 3_000;

export interface ErrorReporterOptions {
  dsn?: string;
  environment: string;
  release?: string;
  /** `sailent-api`, `sailent-worker`, `sailent-web`. */
  service: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface ErrorContext {
  tags?: Record<string, string | number | undefined>;
  extra?: Record<string, unknown>;
}

export interface ErrorReporter {
  readonly enabled: boolean;
  capture(error: unknown, context?: ErrorContext): void;
  flush(timeoutMs?: number): Promise<void>;
}

interface ParsedDsn {
  url: string;
  publicKey: string;
}

/** `https://<key>@<host>[/<path>]/<project>` → the envelope URL and key. */
export function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const segments = url.pathname.split('/').filter(Boolean);
    const project = segments.pop();
    if (!url.username || !project || !/^\d+$/.test(project)) return null;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const prefix = segments.length > 0 ? `/${segments.join('/')}` : '';
    return {
      url: `${url.protocol}//${url.host}${prefix}/api/${project}/envelope/`,
      publicKey: decodeURIComponent(url.username),
    };
  } catch {
    return null;
  }
}

interface Frame {
  function?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
}

/** V8 stack lines → Sentry frames, oldest first (Sentry's order). */
export function parseStack(stack: string | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split('\n').slice(1, 51)) {
    const match =
      /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line) ??
      /^\s*at (.+?) \((.+?)\)$/.exec(line);
    if (!match) continue;
    const filename = match[2] ?? '';
    frames.push({
      function: match[1] || undefined,
      filename,
      lineno: match[3] ? Number(match[3]) : undefined,
      colno: match[4] ? Number(match[4]) : undefined,
      in_app: !filename.includes('node_modules') && !filename.startsWith('node:'),
    });
  }
  return frames.reverse();
}

function exceptionValues(error: unknown) {
  const values: { type: string; value: string; stacktrace?: { frames: Frame[] } }[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof Error) {
      const frames = parseStack(current.stack);
      values.push({
        type: current.name || 'Error',
        value: current.message,
        ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
      });
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      values.push({
        type: 'Error',
        value: typeof current === 'string' ? current : 'Non-Error thrown',
      });
      break;
    }
  }
  // Sentry lists the outermost exception LAST.
  return values.reverse();
}

export function createErrorReporter(options: ErrorReporterOptions): ErrorReporter {
  const parsed = options.dsn ? parseDsn(options.dsn) : null;
  const send = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const now = options.now ?? Date.now;
  const inFlight = new Set<Promise<void>>();
  let windowStart = 0;
  let sentInWindow = 0;

  if (!parsed || !send) {
    return { enabled: false, capture: () => undefined, flush: async () => undefined };
  }

  return {
    enabled: true,

    capture(error, context = {}) {
      try {
        const time = now();
        if (time - windowStart > 60_000) {
          windowStart = time;
          sentInWindow = 0;
        }
        if (sentInWindow >= MAX_EVENTS_PER_MINUTE) return;
        sentInWindow += 1;

        const eventId = globalThis.crypto.randomUUID().replace(/-/g, '');
        const tags: Record<string, string> = { service: options.service };
        for (const [key, value] of Object.entries(context.tags ?? {})) {
          if (value !== undefined) tags[key] = String(value);
        }
        const event = scrubErrorEvent({
          event_id: eventId,
          timestamp: time / 1000,
          platform: 'node',
          level: 'error',
          logger: options.service,
          server_name: options.service,
          environment: options.environment,
          ...(options.release ? { release: options.release } : {}),
          tags,
          ...(context.extra ? { extra: context.extra } : {}),
          exception: { values: exceptionValues(error) },
        });
        const body =
          `${JSON.stringify({ event_id: eventId, sent_at: new Date(time).toISOString() })}\n` +
          `${JSON.stringify({ type: 'event' })}\n` +
          `${JSON.stringify(event)}\n`;

        const request = send(parsed.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
            'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=sailent-reporter/1.0`,
          },
          body,
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        })
          .then(() => undefined)
          .catch(() => undefined);
        const tracked = request.finally(() => inFlight.delete(tracked));
        inFlight.add(tracked);
      } catch {
        // Reporting must never be the thing that fails.
      }
    },

    async flush(timeoutMs = 2_000) {
      if (inFlight.size === 0) return;
      await Promise.race([
        Promise.allSettled([...inFlight]),
        new Promise((resolve) => setTimeout(resolve, timeoutMs).unref?.()),
      ]);
    },
  };
}

/** A one-line, scrubbed description of an error, for a log field. */
export function describeError(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return redactSensitiveText(text).slice(0, 500);
}
