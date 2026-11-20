import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorText, friendlyError } from '../error-messages';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const apiError = (code: string, status: number, message: string) =>
  Object.assign(new Error(message), { code, status });

describe('friendlyError', () => {
  it('keeps a refusal the API wrote for a person, as the next step', () => {
    expect(
      friendlyError(apiError('CONFLICT', 409, 'That slug is already used by another campaign.')),
    ).toEqual({
      title: 'Couldn’t save',
      description: 'That slug is already used by another campaign.',
      retryable: false,
    });
    expect(friendlyError(apiError('VALIDATION_FAILED', 422, 'Enter a goal.')).title).toBe(
      'Check the form',
    );
  });

  it('never shows a server failure’s own text', () => {
    const shown = friendlyError(
      apiError('INTERNAL_ERROR', 500, 'password authentication failed for user "sailent"'),
    );

    expect(shown.title).toBe('Something went wrong');
    expect(JSON.stringify(shown)).not.toMatch(/password|sailent/);
    expect(shown.retryable).toBe(true);
  });

  it('turns technical text into a generic line even on a refusal', () => {
    const shown = friendlyError(
      apiError('CONFLICT', 409, 'TypeError: Cannot read properties of undefined'),
    );
    expect(shown.description).toBe('It clashes with something that already exists.');
  });

  it.each([
    ['UNAUTHENTICATED', 401, 'Your session has ended', false],
    ['REAUTH_REQUIRED', 403, 'Confirm it’s you', false],
    ['RATE_LIMITED', 429, 'Too many attempts', true],
    ['SERVICE_UNAVAILABLE', 503, 'Service unavailable', true],
    ['REQUEST_TIMEOUT', 504, 'That took too long', true],
  ])('%s → "%s"', (code, status, title, retryable) => {
    const shown = friendlyError(apiError(code, status, 'whatever'));
    expect(shown.title).toBe(title);
    expect(shown.retryable).toBe(retryable);
  });

  it('recognises a network failure and being offline', () => {
    expect(friendlyError(new TypeError('Failed to fetch')).title).toBe('Connection problem');

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(friendlyError(new Error('anything')).title).toBe('You’re offline');
  });

  it('reads a server action’s { error } result', () => {
    expect(friendlyError({ error: 'Enter a title.' })).toEqual({
      title: 'Couldn’t save',
      description: 'Enter a title.',
      retryable: true,
    });
  });

  it('logs the technical detail, and falls back to a generic line for the unknown', () => {
    const logged = vi.mocked(console.error);
    const shown = friendlyError(42);

    expect(shown.title).toBe('Something went wrong');
    expect(logged).toHaveBeenCalledWith('[feedback]', 42);
  });
});

describe('errorText (an inline line under an upload or a photo)', () => {
  const FALLBACK = 'Couldn’t upload the photo. Try again.';

  it('keeps the API’s own message, written for people', () => {
    expect(errorText(new Error('That file is too large. The limit is 5 MB.'), FALLBACK)).toBe(
      'That file is too large. The limit is 5 MB.',
    );
  });

  it('turns a dropped connection into what to do, not "Failed to fetch"', () => {
    expect(errorText(new TypeError('Failed to fetch'), FALLBACK)).toBe(
      'Check your connection and try again.',
    );
  });

  it('never shows a stack, a driver error or a framework message', () => {
    for (const raw of [
      'TypeError: x is not a function\n    at upload (file.js:1:1)',
      'connect ECONNREFUSED 127.0.0.1:5432',
      'relation "media" does not exist',
      'An error occurred in the Server Components render. '.repeat(5),
    ]) {
      expect(errorText(new Error(raw), FALLBACK)).toBe(FALLBACK);
    }
  });
});
