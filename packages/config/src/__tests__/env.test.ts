import { describe, expect, it } from 'vitest';

import { senderAddress, workerEnvSchema } from '../env.js';

/**
 * The worker's email settings (Resend), as `loadEnv` checks them at startup.
 * Only the RESEND_* findings are looked at: other production rules have
 * their own reasons and are not what these tests are about.
 */

const DEVELOPMENT = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://sailent:secret@localhost:5432/sailent_dev',
  REDIS_URL: 'redis://localhost:6379',
};

const PRODUCTION = {
  ...DEVELOPMENT,
  APP_ENV: 'production',
  NODE_ENV: 'production',
  API_INTERNAL_URL: 'https://api.sailent.example',
  INTERNAL_API_SECRET: 'x'.repeat(40),
  APP_PUBLIC_URL: 'https://sailent.example',
};

const KEY = 're_test_1234567890abcdef';
const SENDER = 'Sailent Foundation <noreply@sailent.example>';

/** The RESEND_* problems startup would report, as `FIELD: message`. */
function emailIssues(env: Record<string, string>): string[] {
  const result = workerEnvSchema.safeParse(env);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => String(issue.path[0] ?? '').startsWith('RESEND_'))
    .map((issue) => `${String(issue.path[0])}: ${issue.message}`);
}

describe('worker email settings', () => {
  it('runs without email in development, including with empty values', () => {
    expect(emailIssues(DEVELOPMENT)).toEqual([]);
    expect(
      emailIssues({
        ...DEVELOPMENT,
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: '',
        RESEND_REPLY_TO: '',
      }),
    ).toEqual([]);
  });

  it('accepts a key with a sender in either form, and a reply-to', () => {
    expect(emailIssues({ ...DEVELOPMENT, RESEND_API_KEY: KEY, RESEND_FROM_EMAIL: SENDER })).toEqual(
      [],
    );
    expect(
      emailIssues({
        ...DEVELOPMENT,
        RESEND_API_KEY: KEY,
        RESEND_FROM_EMAIL: 'noreply@sailent.example',
        RESEND_REPLY_TO: 'contact@sailent.example',
      }),
    ).toEqual([]);
  });

  it('refuses a key without a sender, and a sender without a key', () => {
    expect(emailIssues({ ...DEVELOPMENT, RESEND_API_KEY: KEY })).toEqual([
      'RESEND_FROM_EMAIL: RESEND_FROM_EMAIL is required when RESEND_API_KEY is set (set both, or neither to send no email)',
    ]);
    expect(emailIssues({ ...DEVELOPMENT, RESEND_FROM_EMAIL: SENDER })).toEqual([
      'RESEND_API_KEY: RESEND_API_KEY is required when RESEND_FROM_EMAIL is set (set both, or neither to send no email)',
    ]);
  });

  it('refuses a malformed key, sender or reply-to', () => {
    const issues = emailIssues({
      ...DEVELOPMENT,
      RESEND_API_KEY: 'sk_live_not_resend',
      RESEND_FROM_EMAIL: 'Sailent Foundation <not-an-address>',
      RESEND_REPLY_TO: 'nobody',
    });
    expect(issues).toContain(
      'RESEND_API_KEY: RESEND_API_KEY must be a Resend API key (it starts with re_)',
    );
    expect(issues).toContain(
      'RESEND_FROM_EMAIL: RESEND_FROM_EMAIL must be "Name <address@your-domain>" or an address',
    );
    expect(issues).toContain('RESEND_REPLY_TO: RESEND_REPLY_TO must be an email address');
  });

  it('requires a key and a sender in production', () => {
    expect(emailIssues(PRODUCTION)).toEqual([
      'RESEND_API_KEY: RESEND_API_KEY is required when APP_ENV=production',
      'RESEND_FROM_EMAIL: RESEND_FROM_EMAIL is required when APP_ENV=production',
    ]);
  });

  it('refuses Resend’s shared test sender in production', () => {
    expect(
      emailIssues({
        ...PRODUCTION,
        RESEND_API_KEY: KEY,
        RESEND_FROM_EMAIL: 'Sailent Foundation <onboarding@resend.dev>',
      }),
    ).toEqual([
      'RESEND_FROM_EMAIL: RESEND_FROM_EMAIL must be an address on your own verified domain in production, not @resend.dev',
    ]);
  });

  it('accepts a sender on your own domain in production', () => {
    expect(emailIssues({ ...PRODUCTION, RESEND_API_KEY: KEY, RESEND_FROM_EMAIL: SENDER })).toEqual(
      [],
    );
  });
});

describe('senderAddress', () => {
  it('reads the address from either form, or nothing', () => {
    expect(senderAddress(SENDER)).toBe('noreply@sailent.example');
    expect(senderAddress('"Sailent, Foundation" <noreply@sailent.example>')).toBe(
      'noreply@sailent.example',
    );
    expect(senderAddress('noreply@sailent.example')).toBe('noreply@sailent.example');
    expect(senderAddress('Sailent Foundation')).toBeNull();
  });
});
