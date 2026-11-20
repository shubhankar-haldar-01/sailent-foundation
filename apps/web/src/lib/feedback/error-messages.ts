/**
 * What to tell a person when something they did failed.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE MAPPER FOR THE WHOLE SITE (2026-11-19, docs/ui-feedback.md).
 *
 * It takes anything a failure can be (an API error from the admin, donor or
 * public client, a network failure, an action's `{ error }`, a string) and
 * returns a short title and a "what to do next" line. The technical detail is
 * logged, never shown.
 *
 * WHAT IS SHOWN FROM THE SERVER. The API writes its 4xx messages for people
 * ("That slug is already used by another campaign.") and they are more useful
 * than any generic line, so they are kept as the description for a refusal
 * (validation, conflict, not found, forbidden). A server failure (5xx) never
 * shows its message: in development it can be a database error.
 *
 * Pure and dependency-free, so it runs in the browser, on the server and in
 * tests. API errors are recognised by their shape (`code`, `status`) because
 * the admin and donor clients are server-only modules.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface FriendlyError {
  /** 2–5 words, sentence case: what happened. */
  title: string;
  /** What to do next. */
  description: string;
  /** Whether trying the same thing again could succeed. */
  retryable: boolean;
}

type CodedError = { code?: unknown; status?: unknown; message?: unknown };

const GENERIC: FriendlyError = {
  title: 'Something went wrong',
  description: 'Please try again. If it keeps happening, contact us.',
  retryable: true,
};

/** A message the API wrote for a person, not a stack trace or a driver error. */
function isHumanMessage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 200 &&
    !/\n\s+at\s|^\w*Error:|ECONN|ETIMEDOUT|SQL|relation "|undefined|null/i.test(value)
  );
}

function fromCode(code: string, status: number, message: unknown): FriendlyError {
  const said = isHumanMessage(message) ? message : null;
  switch (code) {
    case 'UNAUTHENTICATED':
      return {
        title: 'Your session has ended',
        description: 'Sign in again to continue.',
        retryable: false,
      };
    case 'REAUTH_REQUIRED':
      return {
        title: 'Confirm it’s you',
        description: 'Enter your password again to continue.',
        retryable: false,
      };
    case 'FORBIDDEN':
      return {
        title: 'Not allowed',
        description: said ?? 'Your account doesn’t have permission to do this.',
        retryable: false,
      };
    case 'NOT_FOUND':
      return {
        title: 'Not found',
        description: said ?? 'It may have been moved or deleted. Refresh and try again.',
        retryable: false,
      };
    case 'CONFLICT':
      return {
        title: 'Couldn’t save',
        description: said ?? 'It clashes with something that already exists.',
        retryable: false,
      };
    case 'VALIDATION_FAILED':
      return {
        title: 'Check the form',
        description: said ?? 'Some details need correcting. They are marked below.',
        retryable: false,
      };
    case 'RATE_LIMITED':
      return {
        title: 'Too many attempts',
        description: 'Wait a minute, then try again.',
        retryable: true,
      };
    case 'REQUEST_TIMEOUT':
      return {
        title: 'That took too long',
        description: 'Check your connection and try again.',
        retryable: true,
      };
    case 'SERVICE_UNAVAILABLE':
      return {
        title: 'Service unavailable',
        description: 'We couldn’t reach our server. Try again in a moment.',
        retryable: true,
      };
    default:
      if (status >= 500 || code === 'INTERNAL_ERROR') {
        return {
          title: 'Something went wrong',
          description: 'This is on our side. Please try again in a moment.',
          retryable: true,
        };
      }
      return said ? { ...GENERIC, title: 'Couldn’t finish that', description: said } : GENERIC;
  }
}

export function friendlyError(error: unknown): FriendlyError {
  // The technical detail goes to the console (and error tracking, where set up).
  if (error !== undefined && error !== null && typeof console !== 'undefined') {
    console.error('[feedback]', error);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      title: 'You’re offline',
      description: 'Check your connection. We’ll keep what you entered.',
      retryable: true,
    };
  }

  // fetch() rejects with a TypeError when the network is down or blocked.
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return {
      title: 'Connection problem',
      description: 'Check your connection and try again.',
      retryable: true,
    };
  }

  if (error && typeof error === 'object') {
    const coded = error as CodedError;
    if (typeof coded.code === 'string') {
      return fromCode(
        coded.code,
        typeof coded.status === 'number' ? coded.status : 0,
        coded.message,
      );
    }
    // A server action's result: `{ error: 'That slug is already used…' }`.
    const state = error as { error?: unknown };
    if ('error' in state) {
      return isHumanMessage(state.error)
        ? { title: 'Couldn’t save', description: state.error, retryable: true }
        : GENERIC;
    }
  }

  if (isHumanMessage(error)) {
    return { title: 'Couldn’t finish that', description: error, retryable: true };
  }

  return GENERIC;
}

/**
 * One line for an inline error under a control (an upload, a photo), from
 * whatever was caught.
 *
 * A message our own code threw from the API's answer is kept: the API writes
 * it for people ("That file is too large."). A dropped connection or being
 * offline gets the friendly line. Anything else, a stack-traced or framework
 * error, gets `fallback`: never the raw text.
 */
export function errorText(error: unknown, fallback: string): string {
  const friendly = friendlyError(
    error instanceof Error && !(error instanceof TypeError) ? error.message : error,
  );
  return friendly === GENERIC ? fallback : friendly.description;
}
