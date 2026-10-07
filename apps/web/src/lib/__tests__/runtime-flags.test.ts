import { describe, expect, it } from 'vitest';

import { loadEnv, webEnvSchema } from '@sailent/config';

import { mockDataEnabled } from '../runtime-flags';

/**
 * Phase 12: demo fixtures are never served in production, and the flag is
 * parsed rather than compared with the string 'false'.
 */
describe('mockDataEnabled', () => {
  it('is never on in production, whatever the flag says', () => {
    for (const value of [undefined, 'true', '1', 'yes']) {
      expect(mockDataEnabled({ APP_ENV: 'production', FEATURE_MOCK_DATA: value })).toBe(false);
    }
  });

  it('is off for false and 0, and on by default for local development', () => {
    expect(mockDataEnabled({ APP_ENV: 'development', FEATURE_MOCK_DATA: 'false' })).toBe(false);
    expect(mockDataEnabled({ APP_ENV: 'development', FEATURE_MOCK_DATA: '0' })).toBe(false);
    expect(mockDataEnabled({ APP_ENV: 'development' })).toBe(true);
  });
});

/** Phase 12: the web server's environment, validated at startup (instrumentation.ts). */
describe('webEnvSchema in production', () => {
  const production = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    FEATURE_MOCK_DATA: 'false',
    INTERNAL_API_SECRET: 'w'.repeat(40),
    CLIENT_IP_HEADER: 'x-forwarded-for',
    NEXT_PUBLIC_APP_URL: 'https://sailent.example',
    API_URL: 'http://api.internal:4000',
  };

  it('accepts a complete production environment', () => {
    expect(() => loadEnv(webEnvSchema, 'web', production)).not.toThrow();
  });

  it.each([
    ['demo fixtures on', { FEATURE_MOCK_DATA: 'true' }, /FEATURE_MOCK_DATA/],
    ['no internal secret', { INTERNAL_API_SECRET: '' }, /INTERNAL_API_SECRET/],
    ['no client address header', { CLIENT_IP_HEADER: '' }, /CLIENT_IP_HEADER/],
    [
      'a localhost site URL',
      { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' },
      /NEXT_PUBLIC_APP_URL/,
    ],
    // Phase 14: the public media origin is printed into every image tag.
    ['an http media URL', { MEDIA_PUBLIC_BASE_URL: 'http://media.sailent.example' }, /MEDIA/],
    [
      'credentials in the media URL',
      { MEDIA_PUBLIC_BASE_URL: 'https://k:s@media.sailent.example' },
      /MEDIA_PUBLIC_BASE_URL/,
    ],
    ['a malformed Sentry DSN', { SENTRY_DSN: 'nope' }, /SENTRY_DSN/],
  ])('refuses %s', (_label, override, message) => {
    expect(() => loadEnv(webEnvSchema, 'web', { ...production, ...override })).toThrow(message);
  });
});

describe('webEnvSchema accepts the Phase 14 production values', () => {
  it('takes a public https media URL and a Sentry DSN', () => {
    expect(() =>
      loadEnv(webEnvSchema, 'web', {
        APP_ENV: 'production',
        NODE_ENV: 'production',
        FEATURE_MOCK_DATA: 'false',
        INTERNAL_API_SECRET: 'w'.repeat(40),
        CLIENT_IP_HEADER: 'x-forwarded-for',
        NEXT_PUBLIC_APP_URL: 'https://sailent.example',
        MEDIA_PUBLIC_BASE_URL: 'https://media.sailent.example',
        SENTRY_DSN: 'https://publickey@o1.ingest.example.io/42',
      }),
    ).not.toThrow();
  });
});
