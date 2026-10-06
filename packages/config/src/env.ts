import { z } from 'zod';

/**
 * Environment validation.
 *
 * Every application validates its environment at boot. A missing or malformed
 * value fails startup loudly rather than surfacing as `undefined` three weeks
 * later in a code path nobody exercised (docs/architecture.md §6).
 *
 * Schemas are split per surface so the web app is not forced to know about
 * Razorpay secrets, and the worker is not forced to know about the browser's
 * public URL.
 */

const appEnvSchema = z.enum(['development', 'test', 'staging', 'production']);
export type AppEnv = z.infer<typeof appEnvSchema>;

/** `true`/`false`/`1`/`0` from a shell, coerced to a real boolean. */
const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

const port = z.coerce.number().int().min(1).max(65535);

/**
 * Treat an empty value as absent.
 *
 * `.env.example` declares every variable, including ones that stay optional
 * until a later phase, as `KEY=`. dotenv parses that as an EMPTY STRING, not
 * `undefined` — so `z.string().min(32).optional()` receives `''`, fails the
 * length check, and the application refuses to boot from its own documented
 * template.
 *
 * Wrapping optional variables in this makes "declared but blank" mean
 * "not set", which is what a reader of the template expects it to mean.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/** Postgres URL. Rejects the Neon HTTP driver form — see decision A12. */
const postgresUrl = z
  .string()
  .min(1, 'DATABASE_URL is required')
  .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
    message: 'DATABASE_URL must be a postgres:// or postgresql:// connection string',
  });

const redisUrl = z
  .string()
  .min(1, 'REDIS_URL is required')
  .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
    message: 'REDIS_URL must be a redis:// or rediss:// connection string',
  });

// ---------------------------------------------------------------------------
// Shared base — present in every runtime
// ---------------------------------------------------------------------------

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: appEnvSchema.default('development'),
});

// ---------------------------------------------------------------------------
// API (NestJS)
// ---------------------------------------------------------------------------

export const apiEnvSchema = baseSchema
  .extend({
    DATABASE_URL: postgresUrl,
    DATABASE_MIGRATION_URL: optional(z.string()),
    /**
     * Skip TLS certificate verification on the database connection.
     *
     * Defaults to false and is refused in production below. An unverified TLS
     * connection is encrypted against a passive listener and wide open to an
     * active one — for a link carrying password hashes and donor PII that is
     * not a trade worth making.
     */
    DATABASE_INSECURE_TLS: booleanFromString.default(false),
    REDIS_URL: redisUrl,

    API_PORT: port.default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    SWAGGER_ENABLED: booleanFromString.default(true),

    // [PHASE 3] Auth. Optional now; enforced below once APP_ENV is production.
    JWT_ACCESS_SECRET: optional(z.string().min(32)),
    JWT_REFRESH_SECRET: optional(z.string().min(32)),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL_DONOR: z.string().default('30d'),
    JWT_REFRESH_TTL_STAFF: z.string().default('7d'),
    FIELD_ENCRYPTION_KEY: optional(z.string()),

    SENTRY_DSN: optional(z.string()),
    SENTRY_ENVIRONMENT: z.string().default('development'),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    FEATURE_FCRA_ENABLED: booleanFromString.default(false),
    FEATURE_MOCK_DATA: booleanFromString.default(true),

    /*
      RAZORPAY.

      All three are optional in development so the API boots without payment
      credentials — the donation endpoints then refuse with a clear message
      rather than the whole service failing to start, which is what a developer
      working on the campaigns page needs.

      All three become REQUIRED in production, below. A production API that
      starts without them accepts donations it cannot charge for.

      KEY_ID is the only one that may reach a browser: Razorpay Checkout needs
      it. KEY_SECRET signs order creation and verifies the checkout handshake;
      WEBHOOK_SECRET verifies the HMAC over the raw webhook body. Neither ever
      leaves the server, and neither is ever logged — pino's redaction list in
      the API covers the signature header, and nothing prints these values.
    */
    RAZORPAY_KEY_ID: optional(z.string().min(8)),
    RAZORPAY_KEY_SECRET: optional(z.string().min(8)),
    RAZORPAY_WEBHOOK_SECRET: optional(z.string().min(8)),

    /*
      THE SHARED SECRET BETWEEN OUR OWN SERVICES (Phase 11).

      The web server and the worker present it to the API to prove a request
      is theirs. Two things depend on it:
        - the client IP the web server forwards (`x-sailent-client-ip`) is
          believed only alongside this secret, so rate limits apply per real
          donor rather than to the whole site;
        - the worker's payment reconciliation calls an internal endpoint that
          refuses anything without it.

      Optional in development (limits then fall back to the connecting
      address, and the internal endpoint answers 503); required in
      production, below. Never logged, never sent to a browser.
    */
    INTERNAL_API_SECRET: optional(z.string().min(32)),

    /*
      BREVO, for the donor's confirmation email.

      Optional everywhere, including production, and that is deliberate: a
      failure to send a receipt email must never stop a donation being
      recorded. Without a key the notification row is still written and marked
      unsent, so nothing is lost and the backlog is visible.
    */
    BREVO_API_KEY: optional(z.string().min(8)),
    BREVO_SENDER_EMAIL: optional(z.string().email()),
    BREVO_SENDER_NAME: z.string().default('Sailent Foundation'),

    /*
      CLOUDFLARE R2, the object store (decision from Phase 0, §11 of
      architecture.md). S3-compatible, which is why the adapter uses an S3
      client rather than a Cloudflare-specific one.

      OPTIONAL IN DEVELOPMENT AND REQUIRED IN PRODUCTION, like Razorpay above.
      Most of this application does not touch storage at all — the donation
      flow, volunteers, events and every public page work without it — so
      demanding credentials to run the test suite would make them a tax on
      unrelated work. What must not happen is a production deployment that
      accepts an upload and has nowhere to put it, and the production block
      below refuses to boot in that state.

      NONE OF THESE ARE `NEXT_PUBLIC_`. The access key and secret are read by
      the API process only; the browser never sees them, and no storage call is
      made from the browser. `R2_PUBLIC_BASE_URL` is not secret — it is the
      hostname that appears in every public image URL — but it is still read
      server-side, because the URL is built where the storage key lives.
    */
    R2_ACCOUNT_ID: optional(z.string().min(1)),
    R2_ACCESS_KEY_ID: optional(z.string().min(1)),
    R2_SECRET_ACCESS_KEY: optional(z.string().min(1)),
    /*
      TWO buckets, because R2 public access is per-BUCKET, not per-prefix. One
      bucket is either public — in which case nothing in it is private — or it
      is not, in which case every image on the public site needs an expiring
      URL. There is no third option and no prefix-level setting.

      A `sailent-temp` bucket was declared here and read by nothing. Removed:
      a config naming a bucket that does not exist sends whoever reads it next
      looking for the code that uses it.
    */
    R2_BUCKET_PUBLIC: z.string().default('sailent-public'),
    R2_BUCKET_PRIVATE: z.string().default('sailent-private'),
    /** The public hostname for the public bucket. No trailing slash. */
    R2_PUBLIC_BASE_URL: optional(z.string().url()),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== 'production') return;

    // Production hardening: things that are optional in development are
    // mandatory here, and a few defaults are outright unsafe.
    const requiredInProduction = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      // Without these the donation endpoints cannot create an order or trust a
      // webhook. Failing at boot is better than failing at the first donation.
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
      // Without it, rate limits are site-wide and reconciliation cannot run.
      'INTERNAL_API_SECRET',
      /*
        Without these an administrator can reach the upload form, choose a
        file, and have it fail after the validation has passed — or worse,
        write a media row pointing at an object that was never stored. Failing
        at boot is better than failing at the first upload.
      */
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_PUBLIC_BASE_URL',
    ] as const;
    for (const key of requiredInProduction) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when APP_ENV=production`,
        });
      }
    }

    /*
      LIVE RAZORPAY KEYS ONLY. A test key in production takes sandbox
      payments, and every one of them would be recorded as a real donation
      with a real receipt number. The message names the variable, never the
      value.
    */
    if (env.RAZORPAY_KEY_ID && !env.RAZORPAY_KEY_ID.startsWith('rzp_live_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RAZORPAY_KEY_ID'],
        message: 'RAZORPAY_KEY_ID must be a live key (rzp_live_…) in production',
      });
    }

    if (env.SWAGGER_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SWAGGER_ENABLED'],
        message: 'SWAGGER_ENABLED must be false in production',
      });
    }

    if (env.DATABASE_INSECURE_TLS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_INSECURE_TLS'],
        message:
          'DATABASE_INSECURE_TLS must be false in production. An unverified database connection carries password hashes and donor PII past an attacker who can reach the network path.',
      });
    }

    if (env.FEATURE_MOCK_DATA) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FEATURE_MOCK_DATA'],
        message: 'FEATURE_MOCK_DATA must be false in production',
      });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export const workerEnvSchema = baseSchema
  .extend({
    DATABASE_URL: postgresUrl,
    REDIS_URL: redisUrl,
    BREVO_API_KEY: optional(z.string().min(8)),
    BREVO_SENDER_EMAIL: optional(z.string().email()),
    BREVO_SENDER_NAME: z.string().default('Sailent Foundation'),
    APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),

    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
    WORKER_PORT: port.default(4001),
    SENTRY_DSN: optional(z.string()),
    SENTRY_ENVIRONMENT: z.string().default('development'),

    /*
      PAYMENT RECONCILIATION (Phase 11). The worker schedules it and calls the
      API's internal endpoint, which owns the capture logic, with the shared
      secret. Without both, the schedule is not registered and the worker says
      so at startup; production requires them, below.
    */
    API_INTERNAL_URL: optional(z.string().url()),
    INTERNAL_API_SECRET: optional(z.string().min(32)),
    /** How often reconciliation runs. Ten minutes by default. */
    PAYMENT_RECONCILE_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(3_600_000)
      .default(600_000),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== 'production') return;
    // Without these, no pending donation is ever reconciled or expired.
    for (const key of ['API_INTERNAL_URL', 'INTERNAL_API_SECRET'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when APP_ENV=production`,
        });
      }
    }
  });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

// ---------------------------------------------------------------------------
// Web (server-side). Anything the browser needs must be NEXT_PUBLIC_*.
// ---------------------------------------------------------------------------

export const webEnvSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Sailent Foundation'),
  /** Server-side only. The browser never calls the API directly (decision A1). */
  API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_SENTRY_DSN: optional(z.string()),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: optional(z.string()),
  FEATURE_MOCK_DATA: booleanFromString.default(true),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

// ---------------------------------------------------------------------------
// Database package (migrations, seeds, studio)
// ---------------------------------------------------------------------------

export const databaseEnvSchema = baseSchema.extend({
  DATABASE_URL: postgresUrl,
  DATABASE_MIGRATION_URL: optional(z.string()),
  DATABASE_INSECURE_TLS: booleanFromString.default(false),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export class EnvValidationError extends Error {
  constructor(
    readonly surface: string,
    readonly issues: z.ZodIssue[],
  ) {
    const lines = issues.map(
      (issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    super(
      `Invalid environment for "${surface}":\n${lines.join('\n')}\n\n` +
        `Check your .env against .env.example.`,
    );
    this.name = 'EnvValidationError';
  }
}

/**
 * Parse and freeze an environment object.
 *
 * Throws `EnvValidationError` with every problem listed at once — reporting one
 * missing variable at a time turns setup into a guessing game.
 */
export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  surface: string,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(surface, result.error.issues);
  }

  return Object.freeze(result.data);
}

export const isProduction = (env: { APP_ENV: AppEnv }): boolean => env.APP_ENV === 'production';
export const isDevelopment = (env: { APP_ENV: AppEnv }): boolean => env.APP_ENV === 'development';
export const isTest = (env: { APP_ENV: AppEnv }): boolean => env.APP_ENV === 'test';
