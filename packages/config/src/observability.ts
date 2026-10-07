/**
 * Error-tracking and logging helpers shared by the API, the worker and the
 * web server (Phase 14).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTHING SENSITIVE LEAVES THE PROCESS.
 *
 * Every Sentry event passes through `scrubErrorEvent` before it is sent:
 *
 *   - the request BODY, cookies and query string are dropped entirely, and
 *     only a short allow-list of headers is kept (no Authorization, Cookie,
 *     signature or internal-secret header can survive);
 *   - the `user` block is dropped (no email, IP or id);
 *   - breadcrumbs are dropped (they can carry log lines);
 *   - every remaining object is walked, and a value whose KEY names a secret
 *     (password, otp, token, secret, authorization, cookie, signature, PAN /
 *     tax id, card, api key, refresh/access token…) is replaced;
 *   - every remaining STRING is scanned and JWTs, bearer tokens, Razorpay
 *     keys, PANs and email addresses inside it are masked — exception
 *     messages included, since a message can quote what it failed on.
 *
 * No Sentry type is imported: the function works on the plain JSON shape, so
 * this package stays dependency-free and the rules are unit-tested here.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const REDACTED = '[redacted]';

/**
 * Keys whose VALUES are never sent, matched on whole WORDS of the key
 * (camelCase and snake_case split), so `taxIdNumber`, `refresh_token` and
 * `x-razorpay-signature` match while `company`, `span_id` and `footprint` do
 * not.
 */
const SENSITIVE_WORDS = new Set([
  'password',
  'passwd',
  'pass',
  'secret',
  'token',
  'authorization',
  'cookie',
  'cookies',
  'signature',
  'otp',
  'totp',
  'pan',
  'card',
  'cvv',
  'jwt',
  'dsn',
  'credential',
  'credentials',
  'pin',
  'email',
  'phone',
  'ip',
]);
/** Two-word names (`tax id`, `api key`, `private key`, `access key`). */
const SENSITIVE_PAIRS = new Set(['tax id', 'api key', 'private key', 'access key', 'ip address']);
/** A bare `code` is a one-time code in this application. */
const SENSITIVE_EXACT = new Set(['code']);

function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Request headers that may be kept on an event. Everything else is dropped. */
const SAFE_HEADERS = new Set(['user-agent', 'content-type', 'accept', 'x-request-id']);

const TEXT_PATTERNS: [RegExp, string][] = [
  // JSON Web Tokens: three base64url segments, the first starting "eyJ".
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[jwt]'],
  // "Bearer <anything>".
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]'],
  // Razorpay key ids and secrets.
  [/rzp_(live|test)_[A-Za-z0-9]+/g, 'rzp_[redacted]'],
  // Indian PAN: AAAAA9999A.
  [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[pan]'],
  // Email addresses.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
];

export function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_EXACT.has(key.toLowerCase())) return true;
  const parts = words(key);
  if (parts.some((part) => SENSITIVE_WORDS.has(part))) return true;
  return parts.some((part, index) => SENSITIVE_PAIRS.has(`${part} ${parts[index + 1] ?? ''}`));
}

/** Mask tokens, keys, PANs and email addresses inside free text. */
export function redactSensitiveText(text: string): string {
  return TEXT_PATTERNS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text,
  );
}

/** Recursively redact by key and by content. Depth-limited and cycle-safe. */
export function redactDeep(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 8 || seen.has(value)) return REDACTED;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1, seen));
  const output: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveKey(key) ? REDACTED : redactDeep(inner, depth + 1, seen);
  }
  return output;
}

interface EventLike {
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, unknown>;
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    env?: unknown;
    [key: string]: unknown;
  };
  user?: unknown;
  breadcrumbs?: unknown;
  exception?: { values?: { value?: string; [key: string]: unknown }[] };
  message?: string;
  [key: string]: unknown;
}

/**
 * Make an error event safe to send. Returns a new object; the input is not
 * modified. Use as Sentry's `beforeSend` (and `beforeSendTransaction`).
 */
export function scrubErrorEvent<T extends object>(event: T): T {
  const source = event as EventLike;
  const copy: EventLike = { ...source };

  if (source.request) {
    const headers: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(source.request.headers ?? {})) {
      if (SAFE_HEADERS.has(name.toLowerCase())) headers[name] = value;
    }
    copy.request = {
      method: source.request.method,
      // The path only: a query string can carry a token or an email.
      url: typeof source.request.url === 'string' ? source.request.url.split('?')[0] : undefined,
      headers,
    };
  }
  delete copy.user;
  delete copy.breadcrumbs;

  if (source.exception?.values) {
    copy.exception = {
      ...source.exception,
      values: source.exception.values.map((entry) => ({
        ...entry,
        value: typeof entry.value === 'string' ? redactSensitiveText(entry.value) : entry.value,
      })),
    };
  }
  if (typeof source.message === 'string') copy.message = redactSensitiveText(source.message);

  for (const key of ['extra', 'contexts', 'tags'] as const) {
    if (copy[key] !== undefined) copy[key] = redactDeep(copy[key]);
  }
  return copy as T;
}

/**
 * Cloud Logging reads `severity` from a JSON log line (Phase 14). pino writes
 * a numeric `level`; this maps it so errors show as errors in the console.
 */
export function cloudLoggingSeverity(label: string): string {
  switch (label) {
    case 'trace':
    case 'debug':
      return 'DEBUG';
    case 'info':
      return 'INFO';
    case 'warn':
      return 'WARNING';
    case 'error':
      return 'ERROR';
    case 'fatal':
      return 'CRITICAL';
    default:
      return 'DEFAULT';
  }
}
