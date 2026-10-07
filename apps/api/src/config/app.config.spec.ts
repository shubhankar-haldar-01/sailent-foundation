import { describe, expect, it } from 'vitest';

import { apiEnvSchema, loadEnv, workerEnvSchema } from '@sailent/config';

import { AppConfig } from './app.config.js';

/**
 * The flag that decides whether donor sign-in codes reach the log.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS EXISTS BECAUSE THE OBVIOUS VERSION WAS WRONG IN PRODUCTION.
 *
 * `auth.service.ts` used to gate its development-only OTP log on
 * `process.env.FEATURE_MOCK_DATA !== 'false'`. That reads as "only when mock
 * data is on", and it is not: the schema accepts `0` as well as `false`, and
 * `'0' !== 'false'`. A production deployment configured with
 * `FEATURE_MOCK_DATA=0` passed validation, booted, and then logged every
 * donor's plaintext sign-in code.
 *
 * So the test is specifically about the spelling `0`, not about the happy path.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** An AppConfig around a given env, without touching the real process env. */
function configWith(env: Record<string, unknown>): AppConfig {
  const config = Object.create(AppConfig.prototype) as AppConfig;
  Object.defineProperty(config, 'env', { value: env, enumerable: true });
  return config;
}

describe('AppConfig.mockDataEnabled', () => {
  it('is false for FEATURE_MOCK_DATA=0, the spelling that used to slip through', () => {
    const parsed = loadEnv(apiEnvSchema, 'api', {
      ...baseEnv,
      APP_ENV: 'production',
      FEATURE_MOCK_DATA: '0',
    });

    // The schema's job: `0` is false, not "not the string false".
    expect(parsed.FEATURE_MOCK_DATA).toBe(false);
    expect(configWith(parsed).mockDataEnabled).toBe(false);
  });

  it('is false in production even if the flag somehow says otherwise', () => {
    // Belt and braces. The schema refuses to boot production with this on, so
    // the two floors cannot disagree today — this pins that a change to one
    // does not quietly unlock the other.
    expect(configWith({ APP_ENV: 'production', FEATURE_MOCK_DATA: true }).mockDataEnabled).toBe(
      false,
    );
  });

  it('is true in development, where the flow has to be testable', () => {
    expect(configWith({ APP_ENV: 'development', FEATURE_MOCK_DATA: true }).mockDataEnabled).toBe(
      true,
    );
  });

  it('refuses to validate a production environment with mock data enabled', () => {
    expect(() =>
      loadEnv(apiEnvSchema, 'api', {
        ...baseEnv,
        APP_ENV: 'production',
        FEATURE_MOCK_DATA: 'true',
      }),
    ).toThrow();
  });
});

/** The minimum a production API environment must declare to validate. */
const baseEnv: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@db.example.test:5432/sailent',
  REDIS_URL: 'redis://redis.example.test:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  APP_PUBLIC_URL: 'https://sailent.example',
  API_PUBLIC_URL: 'https://api.sailent.example',
  // Production insists on these, which is itself worth knowing: the payment
  // provider cannot be left unconfigured on a box that takes donations.
  RAZORPAY_KEY_ID: 'rzp_live_example',
  RAZORPAY_KEY_SECRET: 'c'.repeat(32),
  RAZORPAY_WEBHOOK_SECRET: 'd'.repeat(32),
  /*
    Same reasoning as Razorpay above: a box that accepts uploads cannot be left
    with nowhere to put them. These are obviously-fake fixture values — the
    schema only checks presence and shape, never that they authenticate.
  */
  R2_ACCOUNT_ID: 'e'.repeat(32),
  R2_ACCESS_KEY_ID: 'f'.repeat(32),
  R2_SECRET_ACCESS_KEY: 'g'.repeat(64),
  R2_PUBLIC_BASE_URL: 'https://media.sailent.example',
  SWAGGER_ENABLED: 'false',
  // Phase 11: the secret the web server and worker present to the API.
  INTERNAL_API_SECRET: 'h'.repeat(40),
  // Phase 12: encryption at rest for the donor tax id (32 bytes, base64).
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
};

/**
 * Phase 11 production guards: live payment keys only, and the internal secret
 * present wherever per-client limits and reconciliation depend on it. The
 * messages name variables, never values.
 */
describe('production payment configuration', () => {
  it('accepts a complete production environment with a live Razorpay key', () => {
    expect(() =>
      loadEnv(apiEnvSchema, 'api', {
        ...baseEnv,
        APP_ENV: 'production',
        FEATURE_MOCK_DATA: 'false',
      }),
    ).not.toThrow();
  });

  it('refuses a Razorpay TEST key in production, without printing it', () => {
    const testKey = 'rzp_test_AbCdEf123456';
    let message = '';
    try {
      loadEnv(apiEnvSchema, 'api', {
        ...baseEnv,
        APP_ENV: 'production',
        FEATURE_MOCK_DATA: 'false',
        RAZORPAY_KEY_ID: testKey,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/RAZORPAY_KEY_ID must be a live key/);
    expect(message).not.toContain(testKey);
  });

  it('allows a test key outside production', () => {
    expect(() =>
      loadEnv(apiEnvSchema, 'api', {
        APP_ENV: 'development',
        DATABASE_URL: 'postgres://u:p@localhost:5432/sailent_dev',
        REDIS_URL: 'redis://localhost:6379',
        RAZORPAY_KEY_ID: 'rzp_test_AbCdEf123456',
      }),
    ).not.toThrow();
  });

  it('requires INTERNAL_API_SECRET for the API in production', () => {
    const { INTERNAL_API_SECRET: _omitted, ...withoutSecret } = baseEnv;
    expect(() =>
      loadEnv(apiEnvSchema, 'api', {
        ...withoutSecret,
        APP_ENV: 'production',
        FEATURE_MOCK_DATA: 'false',
      }),
    ).toThrow(/INTERNAL_API_SECRET/);
  });

  it('requires FIELD_ENCRYPTION_KEY in production, as a real 32-byte key', () => {
    const { FIELD_ENCRYPTION_KEY: _omitted, ...withoutKey } = baseEnv;
    const production = { APP_ENV: 'production', FEATURE_MOCK_DATA: 'false' };
    expect(() => loadEnv(apiEnvSchema, 'api', { ...withoutKey, ...production })).toThrow(
      /FIELD_ENCRYPTION_KEY/,
    );
    expect(() =>
      loadEnv(apiEnvSchema, 'api', {
        ...baseEnv,
        ...production,
        FIELD_ENCRYPTION_KEY: 'not-a-32-byte-key',
      }),
    ).toThrow(/FIELD_ENCRYPTION_KEY must be 32 bytes/);
  });

  it('refuses a localhost or plain-http public URL for the worker in production', () => {
    const worker = {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@db.example.test:5432/sailent',
      REDIS_URL: 'redis://redis.example.test:6379',
      API_INTERNAL_URL: 'https://api.internal.example',
      INTERNAL_API_SECRET: 'h'.repeat(40),
    };
    expect(() => loadEnv(workerEnvSchema, 'worker', worker)).toThrow(/APP_PUBLIC_URL/);
    expect(() =>
      loadEnv(workerEnvSchema, 'worker', { ...worker, APP_PUBLIC_URL: 'http://sailent.example' }),
    ).toThrow(/APP_PUBLIC_URL/);
  });

  it('requires the worker to know where the API is and how to authenticate in production', () => {
    const worker = {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@db.example.test:5432/sailent',
      REDIS_URL: 'redis://redis.example.test:6379',
      APP_PUBLIC_URL: 'https://sailent.example',
    };
    expect(() => loadEnv(workerEnvSchema, 'worker', worker)).toThrow(
      /API_INTERNAL_URL[\s\S]*INTERNAL_API_SECRET/,
    );
    expect(() =>
      loadEnv(workerEnvSchema, 'worker', {
        ...worker,
        API_INTERNAL_URL: 'https://api.internal.example',
        INTERNAL_API_SECRET: 'h'.repeat(40),
      }),
    ).not.toThrow();
  });
});

/**
 * Phase 14: Cloud Run and production media. `PORT` (set by Cloud Run) wins
 * over API_PORT; the pool size is configurable; the public media URL must be
 * a public https URL with nothing secret in it.
 */
describe('Cloud Run and media configuration (Phase 14)', () => {
  const development = {
    ...baseEnv,
    APP_ENV: 'development',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://u:p@localhost:5432/sailent_dev',
  };

  it('listens on Cloud Run’s PORT when it is set, and on API_PORT otherwise', () => {
    expect(configWith(loadEnv(apiEnvSchema, 'api', { ...development, PORT: '8080' })).port).toBe(
      8080,
    );
    expect(configWith(loadEnv(apiEnvSchema, 'api', development)).port).toBe(4000);
    expect(() => loadEnv(apiEnvSchema, 'api', { ...development, PORT: '0' })).toThrow(/PORT/);
  });

  it('takes the pool size from DATABASE_POOL_MAX, with 20/5 defaults', () => {
    const production = { ...baseEnv, APP_ENV: 'production', FEATURE_MOCK_DATA: 'false' };
    expect(configWith(loadEnv(apiEnvSchema, 'api', production)).databasePoolMax).toBe(20);
    expect(
      configWith(loadEnv(apiEnvSchema, 'api', { ...production, DATABASE_POOL_MAX: '8' }))
        .databasePoolMax,
    ).toBe(8);
    expect(configWith(loadEnv(apiEnvSchema, 'api', development)).databasePoolMax).toBe(5);
  });

  it.each([
    ['http, not https', 'http://media.sailent.example'],
    ['credentials in the URL', 'https://key:secret@media.sailent.example'],
    ['a query string', 'https://media.sailent.example/?token=abc'],
    ['a loopback host', 'https://localhost:9000'],
  ])('refuses an R2_PUBLIC_BASE_URL with %s in production', (_label, value) => {
    expect(() =>
      loadEnv(apiEnvSchema, 'api', {
        ...baseEnv,
        APP_ENV: 'production',
        FEATURE_MOCK_DATA: 'false',
        R2_PUBLIC_BASE_URL: value,
      }),
    ).toThrow(/R2_PUBLIC_BASE_URL/);
  });

  it('gives the worker’s health server Cloud Run’s PORT', () => {
    const worker = loadEnv(workerEnvSchema, 'worker', {
      APP_ENV: 'development',
      DATABASE_URL: 'postgres://u:p@localhost:5432/sailent_dev',
      REDIS_URL: 'redis://localhost:6379',
      PORT: '8080',
    });
    expect(worker.PORT ?? worker.WORKER_PORT).toBe(8080);
  });

  it('refuses a malformed SENTRY_DSN, and accepts none at all', () => {
    expect(() => loadEnv(apiEnvSchema, 'api', { ...development, SENTRY_DSN: 'not a url' })).toThrow(
      /SENTRY_DSN/,
    );
    expect(() => loadEnv(apiEnvSchema, 'api', development)).not.toThrow();
  });
});
