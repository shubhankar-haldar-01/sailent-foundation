import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { loadRootEnvFile } from '@sailent/config/dotenv';

loadRootEnvFile();

import { VersioningType, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';

import { API_PREFIX } from '@sailent/config';

import { inspectConnection } from '@sailent/database';

import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/app.config.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { TotpService } from '../src/modules/auth/totp.service.js';
import { RazorpayClient } from '../src/modules/donations/razorpay.client.js';
import { StorageService } from '../src/modules/storage/storage.service.js';

/**
 * Integration harness.
 *
 * Boots the REAL application against the REAL Postgres and Redis — no mocked
 * repository, no in-memory substitute. The bugs these tests are for live in the
 * seams: a constraint that does not fire, a guard that reads the wrong
 * metadata, a column that leaks through a serialiser. None of those are visible
 * to a suite that mocks the database away.
 *
 * The global pipes, filters, prefix and versioning are applied here exactly as
 * `main.ts` applies them, because an envelope that differs between test and
 * production tests nothing.
 */

export const PREFIX = `/${API_PREFIX}`;

/**
 * Refuse to run against a database that is not local.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THESE SUITES DELETE ROWS. FORTY-SIX TIMES, ACROSS EIGHT FILES.
 *
 * Teardown is how they stay repeatable — every suite removes what it created,
 * and two of them sweep by pattern rather than by id to catch rows whose
 * create succeeded and whose assertion did not. Against a local throwaway
 * database that is correct. Against a hosted one it is a data-loss incident.
 *
 * The trigger is ordinary and quiet: somebody points `DATABASE_URL` at
 * Supabase to see the app run with real infrastructure, then runs `pnpm test`
 * an hour later out of habit. Nothing warns them, and the deletes are
 * scattered through `afterAll` hooks nobody reads.
 *
 * So the check is here, once, where every integration suite has to pass
 * through it — and it fails BEFORE the app boots rather than after the first
 * teardown.
 *
 * `TEST_DATABASE_URL` is the way to keep both: the app on Supabase, the tests
 * on a local container. `ALLOW_REMOTE_TEST_DB=true` is the deliberate override,
 * for a disposable CI database that is meant to be written to.
 * ══════════════════════════════════════════════════════════════════════════
 */
function assertDisposableDatabase(): void {
  if (process.env.ALLOW_REMOTE_TEST_DB === 'true') return;

  const url = process.env.DATABASE_URL;
  if (!url) return; // Absent is its own, clearer failure further in.

  const connection = inspectConnection(url);
  if (connection.kind === 'local') return;

  throw new Error(
    `Integration tests delete rows and ${connection.describe} is not a local database.\n\n` +
      `  • Point the tests at a local one:  TEST_DATABASE_URL=postgres://…@localhost:5432/sailent\n` +
      `  • Start one:                       pnpm infra:up\n` +
      `  • Or, for a disposable CI database: ALLOW_REMOTE_TEST_DB=true\n`,
  );
}

/**
 * Tests prefer `TEST_DATABASE_URL` when it is set, so the application can stay
 * pointed at a hosted database while the suites run somewhere safe.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

/**
 * The same isolation for Redis, and it is not merely tidiness.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THESE SUITES ENQUEUE REAL JOBS, AND THEN DELETE THE ROWS THOSE JOBS REFER TO.
 *
 * A donation-capture test writes a donation, the capture enqueues a
 * confirmation email, and teardown removes the donation. The job stays in
 * Redis. Whenever a worker next starts it drains that backlog, finds nothing
 * at the other end, and logs an ERROR for each one:
 *
 *   ERROR: Confirmation job for a donation that does not exist
 *
 * Twenty-one of them in one burst, after an ordinary test run. Nothing is
 * broken — the processor's missing-row guard is doing exactly its job — but an
 * ERROR that fires routinely is worse than useless: it teaches whoever reads
 * the log that ERROR does not mean anything.
 *
 * Pointing the suites at a different Redis DATABASE INDEX keeps their jobs
 * where no worker is listening. `redis://localhost:6379/1` and
 * `redis://localhost:6379/0` are the same server and share nothing.
 * ══════════════════════════════════════════════════════════════════════════
 */
if (process.env.TEST_REDIS_URL) {
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
}

assertDisposableDatabase();

/**
 * TEST CREDENTIALS. NOT THE SEEDED DEVELOPMENT ACCOUNTS.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * These suites used to sign in as `admin@sailent.local` and
 * `staff@sailent.local` — the accounts the development seed creates, with the
 * password printed in `docs/database-development.md`.
 *
 * That coupling is why the credential cleanup could not proceed: hardening
 * those accounts, which is the whole point of `db:harden`, would have taken
 * the test suite down with them. A test suite that pins a deployment's
 * administrator accounts in place is a test suite holding a security fix
 * hostage.
 *
 * So the suites now provision their OWN accounts, on `@sailent.test`. `.test`
 * is reserved by RFC 6761 §6.2 and can never be delegated, so these addresses
 * cannot belong to anybody, cannot receive mail, and cannot be confused for a
 * real administrator. `ensureTestStaff()` creates them on first use.
 *
 * They are created in whatever database the suites target — which
 * `assertDisposableDatabase()` above has already refused to let be a remote
 * one. No production database is ever authenticated against.
 * ══════════════════════════════════════════════════════════════════════════
 */
export { TEST_PASSWORD, TEST_USERS } from './fixtures.js';
import { TEST_PASSWORD, TEST_USERS } from './fixtures.js';

/** Still exported: the TOTP suite tests the algorithm, not any account. */
export const DEV_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

/**
 * Two test accounts, both SUPER_ADMIN.
 *
 * Two rather than one because several suites need a second staff actor — a
 * session that has not re-authenticated, for instance, to prove a
 * `@Sensitive()` route refuses it.
 *
 * They no longer differ in second factor. They used to: `superAdmin` carried
 * TOTP and `staff` did not, which exercised both sign-in paths. Mandatory TOTP
 * for SUPER_ADMIN has been removed — there was no enrolment route, so it was a
 * deadlock rather than a control — and both accounts are now email + password.
 */

/**
 * Rate limiting is DISABLED by default in these suites.
 *
 * Not because it does not matter — it has its own suite, where the limits are
 * the subject. But login is capped at five attempts a minute, and a suite that
 * exercises authorization needs more sessions than that. Leaving the throttler
 * on everywhere means every new test case pushes an unrelated one over the
 * limit, and the suite starts failing for reasons that have nothing to do with
 * the code under test.
 */
export async function createTestApp(
  options: {
    throttling?: boolean;
    razorpay?: Partial<RazorpayClient>;
    /** Substitute object storage. See `fakeStorage()` below. */
    storage?: Partial<StorageService>;
  } = {},
): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  /**
   * The payment provider is the ONE thing these suites substitute.
   *
   * Everything else — Postgres, Redis, the guards, the constraints — is real,
   * because that is where the bugs are. Razorpay is replaced because the
   * alternative is a suite that cannot run without a sandbox account, network
   * access and a human to complete a checkout, which means a suite that does
   * not run.
   *
   * What is NOT faked is the signature verification: the tests compute real
   * HMACs with the fake's own secrets, so the verification path under test is
   * the production one. Only the HTTP calls are stubbed.
   */
  if (options.razorpay) {
    builder.overrideProvider(RazorpayClient).useValue(options.razorpay);
  }

  /*
    OBJECT STORAGE IS SUBSTITUTED THE SAME WAY RAZORPAY IS, AND FOR THE SAME
    REASON: the alternative is a suite that cannot run without credentials,
    network access and a bucket — which means a suite that does not run.

    What is NOT faked is the part where the bugs live: `inspectImage` reads
    real bytes in `image-inspection.spec.ts`, and every rule about keys,
    references, visibility and permissions runs against the real service. Only
    the two network calls are replaced.

    The real provider is exercised separately by the R2 round-trip described in
    docs/phase-10.6.md, which needs credentials and is run deliberately.
  */
  if (options.storage) {
    builder.overrideProvider(StorageService).useValue(options.storage);
  }

  if (!options.throttling) {
    /**
     * The STORAGE is replaced, not the guard.
     *
     * `overrideGuard(ThrottlerGuard)` looks like the obvious move and does
     * nothing here: the guard is bound through the `APP_GUARD` token, so the
     * override — which matches on the class token — never finds it. Replacing
     * the storage the guard injects works because that IS injected by its own
     * token, and it leaves the real guard, the real decorators and the real
     * limits in place everywhere else.
     */
    builder.overrideProvider(ThrottlerStorage).useValue({
      increment: async () => ({
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    });
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  const config = app.get(AppConfig);

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: false as never });
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(config.isProduction));

  await app.init();
  return app;
}

/** The current TOTP code for the seeded development secret. */
export function devTotpCode(): string {
  return new TotpService().generate(DEV_TOTP_SECRET);
}

/**
 * The response envelope, as the interceptor and filter produce it.
 * Every assertion in these suites goes through this, so a change to the
 * envelope breaks loudly in one place.
 */
export interface Envelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; requestId: string; details?: unknown[] };
  meta?: { requestId: string };
}

export function errorCode(body: Envelope): string {
  return body.success ? 'OK' : (body.error?.code ?? 'UNKNOWN');
}

/**
 * An in-memory stand-in for object storage.
 *
 * Keeps the objects it is given, so a test can assert that an upload actually
 * stored something, that a visibility change MOVED it between buckets, and
 * that a delete removed it — the consistency rules, without a network.
 */
export function fakeStorage(overrides: Partial<StorageService> = {}) {
  /*
    KEYED BY BUCKET **AND** KEY, because R2 buckets are separate namespaces.

    The first version of this fake used the key alone, and the copy-then-delete
    visibility move deleted the object it had just written — the `put` and the
    `delete` collided on the same Map entry. The tests caught it, which is the
    only reason this comment exists rather than a false green.

    A fake that models the wrong thing proves the wrong thing.
  */
  const objects = new Map<string, { bucket: string; body: Buffer; contentType: string }>();
  const at = (bucket: string, key: string) => `${bucket}:${key}`;
  let counter = 0;

  const fake = {
    isConfigured: true,
    objects,

    /** Which bucket holds this key, or undefined. For assertions. */
    bucketOf(key: string) {
      for (const [composite, value] of objects) {
        if (composite.endsWith(`:${key}`)) return value.bucket;
      }
      return undefined;
    },

    /** How many buckets hold this key. Must never exceed one after a move. */
    copiesOf(key: string) {
      return [...objects.keys()].filter((composite) => composite.endsWith(`:${key}`)).length;
    },

    /*
      A RANDOM SEGMENT, like the real `buildKey`.

      A per-process counter alone repeats `test1`, `test2` … on every run, so
      any row that outlived its suite's cleanup collided with the next run on
      the unique index — a failure in a suite that had done nothing wrong.
      Modelling the randomness is both more faithful and less trouble.
    */
    buildKey({ prefix, mimeType }: { prefix: string; mimeType: string }) {
      const extension = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        // Phase 10.10. Mirrors the real `buildKey`; a missing entry here would
        // mint keys ending `.undefined` and the tests would still pass.
        'application/pdf': 'pdf',
      }[mimeType];
      counter += 1;
      // Hex only, no separator: the real key is `<32 hex>.<ext>`, and a fake
      // whose shape differs lets a test assert a shape production never has.
      const unique = randomUUID().replace(/-/g, '').slice(0, 12);
      return `${prefix}/2026/09/test${counter}${unique}.${extension}`;
    },

    async put(bucket: string, key: string, body: Buffer, contentType: string) {
      objects.set(at(bucket, key), { bucket, body, contentType });
      return { key, size: body.byteLength, contentType };
    },

    async read(bucket: string, key: string) {
      const found = objects.get(at(bucket, key));
      if (!found) throw new Error(`No object at ${key} in ${bucket}`);
      return found.body;
    },

    async delete(bucket: string, key: string) {
      objects.delete(at(bucket, key));
    },

    async exists(bucket: string, key: string) {
      return objects.has(at(bucket, key));
    },

    publicUrl(key: string) {
      return `https://media.test.invalid/${key}`;
    },

    /*
      The EXPIRY is echoed back rather than hard-coded, so a test can assert
      that documents are signed for five minutes and media for fifteen. A fake
      that always says 900 cannot tell the two apart, and §6 of the security
      architecture makes the difference deliberate.
    */
    async signedUrl(key: string, expiresInSeconds = 900) {
      return `https://private.test.invalid/${key}?signature=fake&expires=${expiresInSeconds}`;
    },

    ...overrides,
  };

  return fake as unknown as Partial<StorageService> & {
    objects: typeof objects;
    bucketOf(key: string): string | undefined;
    copiesOf(key: string): number;
  };
}
