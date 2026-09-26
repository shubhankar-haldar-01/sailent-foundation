import { chromium, request } from '@playwright/test';
import { createHash, createHmac } from 'node:crypto';
import pg from 'pg';
import Redis from 'ioredis';
import * as argon2 from 'argon2';

import playwrightConfig, { e2eStack } from '../playwright.config.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const STAFF_STATE = 'e2e/.auth/staff.json';
/**
 * ONE DONOR PER VIEWPORT PROJECT, NOT ONE SHARED BETWEEN THEM.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * The four projects run CONCURRENTLY. Sharing a donor meant they shared
 * mutable state — the profile the "saves a change" test edits, the preferences
 * the settings test toggles, the bookmarks the saved test adds and removes —
 * and worse, they shared one server-side SESSION, which signing out revokes for
 * everybody. It surfaced as three different tests failing in three different
 * projects on each run, which looks like flakiness and is actually a race.
 *
 * `test.describe.configure({ mode: 'serial' })` does not fix it: that orders
 * tests within a project, and the projects run alongside each other.
 *
 * FOUR SIGN-INS IS ALSO WITHIN THE RATE LIMIT, which matters — donor OTP
 * verification is capped at 10 per window, and the first attempt at isolating
 * these tests signed in per test and exhausted it. That cap is a real control
 * protecting a sign-in endpoint, so the suite works within it rather than
 * asking for it to be raised.
 *
 * THE SAME GOES FOR THE GENERAL LIMIT, which is 100 requests a minute per
 * address. All four projects reach the API from one address through the BFF,
 * and every signed-in page view costs at least one `/me` for the header badge
 * — a dashboard page costs two, because the layout fetches it as well.
 *
 * So the number of SIGNED-IN page views in this suite is a shared budget, not
 * a free choice. Phase 9's registration tests were written as three and are
 * now one for that reason: split up, they pushed the suite past the limit and
 * what failed was an unrelated profile test in another file, which is an
 * expensive way to learn where the budget went. Anything added here that signs
 * in should earn its page loads.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function donorStateFor(project: string): string {
  return `e2e/.auth/donor-${project}.json`;
}

/** Stable per project, so a re-run reuses the donor rather than making a new one. */
export function donorFor(project: string) {
  const index = ['desktop', 'tablet', 'mobile', 'mobile-xs'].indexOf(project) + 1;
  const suffix = String(index || 9).padStart(2, '0');
  return {
    phone: `98111990${suffix}`,
    email: `e2e-donor-${project}@example.test`,
    firstName: 'Priya',
    lastName: 'Sharma',
    donorCode: `DNR-E2E-${suffix}`,
    reference: `DON-E2E-${suffix}`,
  } as const;
}

/**
 * Sign in ONCE for the whole run, and save the storage state.
 *
 * Staff sign-in is rate-limited to five attempts a minute — correctly, and it
 * has its own test. Four viewport projects across several workers each signing
 * in per test blows through that instantly, and the suite then fails for a
 * reason that has nothing to do with what it is testing.
 *
 * A non-privileged account is used deliberately: the Campaign Manager needs no
 * TOTP, so this does not have to reimplement RFC 6238 to get a session. The
 * privileged sign-in path is covered by the API's own auth suite.
 *
 * Signing in once is still not enough on its own: run the suite twice inside a
 * minute — which happens constantly while working on it — and this one attempt
 * lands inside the previous run's window and the whole suite fails with
 * RATE_LIMITED. That is the limiter doing its job, so the answer is to WAIT it
 * out here rather than to raise the limit and weaken a real control for the
 * convenience of the tests.
 */
/**
 * The end-to-end suite's own staff account.
 *
 * `.test` is reserved by RFC 6761 §6.2 and can never be delegated, so this
 * address cannot belong to anybody and cannot be mistaken for a real
 * administrator. It is created here rather than seeded, so that suspending the
 * development `@sailent.local` accounts does not take this suite with them.
 */
/**
 * REFUSE to touch anything but the E2E database.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * This file writes users, donors, OTP rows and sessions. It ran against the
 * staging Supabase project for weeks because it simply read `DATABASE_URL`,
 * and nothing anywhere asked whether that was an appropriate place to create a
 * Super Admin. It was not.
 *
 * The configuration now starts its own stack against `E2E_DATABASE_URL`, so
 * this should never be reachable. It exists anyway: a config is one edit away
 * from being wrong, and the failure mode being prevented is silent test data
 * in a live database — which nobody notices until somebody audits the admin
 * list and finds an account they did not create.
 *
 * Two independent conditions, both of which must hold:
 *   - the target is a LOCAL host, and
 *   - it is not the application's own `DATABASE_URL`.
 *
 * The second matters on its own: pointing `DATABASE_URL` at a local database
 * for a debugging session should not quietly re-authorise this file to seed it.
 * ══════════════════════════════════════════════════════════════════════════
 */
function assertIsolatedDatabase(databaseUrl: string): void {
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(databaseUrl);

  if (!isLocal) {
    throw new Error(
      'Refusing to run E2E global setup against a non-local database.\n' +
        '  It creates staff, donor and session records, which must never reach staging or production.\n' +
        '  Set E2E_DATABASE_URL to a local database and run `pnpm db:prepare-e2e`.',
    );
  }

  if (process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      'Refusing to run E2E global setup against the application database.\n' +
        '  E2E_DATABASE_URL and DATABASE_URL are the same. The suite needs its own database\n' +
        '  so that its fixtures cannot be mistaken for real accounts.',
    );
  }
}

/**
 * Clear the E2E stack's OWN rate-limit counters before a run.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOT A WEAKENING OF THE LIMITER, AND THE SCOPE IS THE ARGUMENT.
 *
 * Donor sign-in is capped at ten per fifteen minutes and this setup spends four
 * — one per viewport project. Three runs inside a window therefore exhausts it,
 * and the suite fails on the limiter rather than on anything under test. It
 * used to self-heal because counters lived in the API process and every run
 * restarted it; since they moved to Redis they survive, correctly.
 *
 * So the counters are cleared, and ONLY these:
 *   - only in `E2E_REDIS_URL`, which is Redis DB 2 — the application uses DB 0
 *     and the API integration suites DB 1, and they are not touched;
 *   - only keys under the `throttle:` prefix, so queues and everything else in
 *     that database survive;
 *   - and refused outright if the URL is the application's own.
 *
 * The limits themselves are unchanged and still enforced everywhere. What
 * actually PROVES them is `apps/api/test/rate-limit.spec.ts`, which runs the
 * real limiter deliberately; this suite is not the place that tests them, and
 * letting it fail on them tests nothing.
 * ══════════════════════════════════════════════════════════════════════════
 */
async function clearRateLimits(): Promise<void> {
  const redisUrl = process.env.E2E_REDIS_URL;
  if (!redisUrl) return;

  if (process.env.REDIS_URL && redisUrl === process.env.REDIS_URL) {
    throw new Error(
      'Refusing to clear rate limits: E2E_REDIS_URL is the application Redis. ' +
        'The E2E stack needs its own database index.',
    );
  }

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  redis.on('error', () => undefined);

  try {
    await redis.connect();
    const keys = await redis.keys('throttle:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Redis is optional here: without it the run simply keeps whatever
    // counters exist, which is how this behaved before.
  } finally {
    redis.disconnect();
  }
}

export const E2E_STAFF = {
  email: 'e2e-staff@sailent.test',
  password: 'e2e-only-Tq4$wZ8pRn3f',
} as const;

/**
 * A SECOND staff account, for specs that sign in through the form.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Two specs now mint their own session rather than sharing `STAFF_STATE` —
 * they re-authenticate in order to publish, and a re-auth opens a five-minute
 * window on the SESSION, which would otherwise leak into every other spec.
 *
 * But signing in is itself rate-limited PER ADDRESS (five attempts a minute),
 * and two specs logging in as one account at the same time exhausted it: the
 * form silently failed and both timed out waiting for a redirect.
 *
 * So they get an account each. Same role, same password policy, separate
 * rate-limit buckets and separate sessions.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const E2E_STAFF_SECOND = {
  email: 'e2e-staff-2@sailent.test',
  password: 'e2e-only-Tq4$wZ8pRn3f',
  state: 'e2e/.auth/staff-2.json',
} as const;

/** A third, for the same reason: two specs cannot share a re-auth window. */
export const E2E_STAFF_THIRD = {
  email: 'e2e-staff-3@sailent.test',
  password: 'e2e-only-Tq4$wZ8pRn3f',
  state: 'e2e/.auth/staff-3.json',
} as const;

/**
 * A fourth, for `admin-documents.spec.ts` (Phase 10.10).
 *
 * Changing a document's visibility is `@Sensitive()`, and a re-authentication
 * opens a five-minute window on the SESSION. Sharing one with `admin-blog`,
 * `admin-stories` or `admin-pages` would open that window for specs that
 * assert the opposite — that the same action is REFUSED without one. Four
 * specs each needing a window need four accounts.
 */
export const E2E_STAFF_FOURTH = {
  email: 'e2e-staff-4@sailent.test',
  password: 'e2e-only-Tq4$wZ8pRn3f',
  state: 'e2e/.auth/staff-4.json',
} as const;

/**
 * Create it if it is not there, and repair it if it is.
 *
 * The password is re-applied on every run, and the lockout counters cleared,
 * because a suite that deliberately sprays wrong passwords can leave this
 * account locked — and the next run would then fail on a sign-in that looks
 * like a broken login form.
 *
 * Argon2id via the same `argon2` package and parameters the API uses, so the
 * hash this writes is one the application can verify.
 */
async function ensureStaffFixture(
  databaseUrl: string,
  account: { email: string; password: string } = E2E_STAFF,
): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const passwordHash = await argon2.hash(account.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      raw: false,
    });

    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name,
                          status, email_verified_at, totp_enabled)
            VALUES ($1, $2, 'End-to-end', 'Staff', 'active', now(), false)
       ON CONFLICT DO NOTHING`,
      [account.email, passwordHash],
    );

    await client.query(
      `UPDATE users
          SET password_hash = $2, status = 'active', totp_enabled = false,
              totp_secret = NULL, failed_login_count = 0, locked_until = NULL
        WHERE lower(btrim(email)) = $1`,
      [account.email, passwordHash],
    );

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
            SELECT u.id, r.id FROM users u, roles r
             WHERE lower(btrim(u.email)) = $1 AND r.key = 'SUPER_ADMIN'
               AND NOT EXISTS (SELECT 1 FROM user_roles ur
                                WHERE ur.user_id = u.id AND ur.role_id = r.id)`,
      [account.email],
    );
  } finally {
    await client.end();
  }
}

/**
 * One published blog post, so the public article page can be journeyed over.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A TEST FIXTURE IN THE ISOLATED E2E DATABASE, not content in the product.
 *
 * Phase 10.7 deleted `lib/mock/blog.ts` and its eight invented articles, which
 * is exactly why `/blog` may now be indexed. Nothing replaces them in the
 * application — an empty blog renders an honest empty state.
 *
 * But the cross-viewport journey that checks an article renders with a byline
 * and semantic markup needs an article to open, and it must not create one:
 * it runs on four viewports in parallel and is otherwise read-only. So one
 * post is seeded here, beside the staff and donor fixtures, in the database
 * `playwright.config.ts` fences off from every other environment.
 *
 * Authored by the E2E staff user, so the byline is a real row rather than a
 * string — the journey asserts the author is a person, which was the point of
 * the assertion it replaces.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const E2E_POST = {
  title: 'What a school kit actually costs',
  slug: 'e2e-what-a-school-kit-actually-costs',
} as const;

async function ensureBlogFixture(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(
      `INSERT INTO blog_posts (title, slug, excerpt, content, status, published_at, author_id)
            SELECT $1, $2,
                   'What we pay for a school kit, line by line, and what we got wrong the first time.',
                   $3,
                   'published', now(), u.id
              FROM users u
             WHERE lower(btrim(u.email)) = $4
       ON CONFLICT (slug) DO NOTHING`,
      [
        E2E_POST.title,
        E2E_POST.slug,
        [
          '## What is in a kit',
          '',
          'A kit holds notebooks, a slate, pencils and a bag. We buy them in one order',
          'so the unit price is what a school pays, not what a family pays.',
          '',
          '- Notebooks and a slate',
          '- Pencils, sharpener and eraser',
          '- A bag that survives a monsoon',
          '',
          '> The first year we bought bags that did not, and replaced them in March.',
        ].join('\n'),
        E2E_STAFF.email,
      ],
    );
  } finally {
    await client.end();
  }
}

export default async function globalSetup() {
  /*
    From the config that STARTED these servers, not from the ambient
    environment. Reading `process.env.API_URL` here is how this file ended up
    talking to whichever API happened to be running.
  */
  const apiBase = e2eStack.apiUrl;
  const appBase = process.env.PLAYWRIGHT_BASE_URL ?? e2eStack.webUrl;

  assertIsolatedDatabase(e2eStack.databaseUrl);

  const context = await request.newContext();

  type LoginBody = {
    data?: { accessToken: string; refreshToken: string; expiresIn: number; actor: unknown };
    error?: { code?: string };
  };

  /**
   * Sign in as the E2E's OWN staff account.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * It used to sign in as `staff@sailent.local` with the published development
   * password and a TOTP code computed from the RFC 6238 test vector.
   *
   * Both halves of that are gone. The suite no longer authenticates as a
   * seeded deployment account — those are being suspended, and a test suite
   * that pins them in place would hold that fix hostage — and SUPER_ADMIN no
   * longer requires a second factor, because there was no route to enrol one.
   *
   * `ensureStaffFixture()` below creates `e2e-staff@sailent.test` directly in
   * the database, the same way this file already creates its donor fixtures.
   * `.test` is reserved by RFC 6761 and can never be delegated.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const signIn = async (): Promise<LoginBody> => {
    const response = await context.post(`${apiBase}/api/v1/auth/staff/login`, {
      data: { email: E2E_STAFF.email, password: E2E_STAFF.password },
    });
    return (await response.json()) as LoginBody;
  };

  // The window is a minute, so three waits of 20 seconds clear it. Only
  // RATE_LIMITED is retried — a wrong password or an unreachable API should
  // fail immediately and say so, not sit here for a minute first.
  await clearRateLimits();
  await ensureStaffFixture(e2eStack.databaseUrl);
  await ensureStaffFixture(e2eStack.databaseUrl, E2E_STAFF_SECOND);
  await ensureStaffFixture(e2eStack.databaseUrl, E2E_STAFF_THIRD);
  await ensureStaffFixture(e2eStack.databaseUrl, E2E_STAFF_FOURTH);
  await ensureBlogFixture(e2eStack.databaseUrl);

  let body = await signIn();
  for (let attempt = 0; attempt < 3 && body.error?.code === 'RATE_LIMITED'; attempt += 1) {
    console.log('[e2e] sign-in rate limited; waiting 20s for the window to clear…');
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    body = await signIn();
  }

  if (!body.data) {
    throw new Error(
      `Playwright global setup could not sign in: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }

  const session = JSON.stringify({
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    expiresAt: Date.now() + body.data.expiresIn * 1000,
    actor: body.data.actor,
  });

  const { hostname } = new URL(appBase);

  await mkdir(dirname(STAFF_STATE), { recursive: true });
  await writeFile(
    STAFF_STATE,
    JSON.stringify({
      cookies: [
        {
          name: 'sailent_staff_session',
          value: session,
          domain: hostname,
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );

  /*
    ══════════════════════════════════════════════════════════════════════════
    A PRE-MINTED SESSION FOR EACH EXTRA STAFF ACCOUNT.

    `admin-blog` and `admin-pages` need sessions OF THEIR OWN: both
    re-authenticate in order to publish, a re-auth opens a five-minute window on
    the session, and `admin-stories` asserts that publishing without one is
    refused. Sharing `STAFF_STATE` made whichever ran second fail.

    They signed in through the form instead, and that failed differently — under
    the full suite the login is rate limited alongside everything else hitting
    the API from one address, and a throttled login just never redirects.

    So each gets a session minted here, exactly as `STAFF_STATE` is: no form
    login at test time, no shared window, and one sign-in per account instead
    of one per test.
    ══════════════════════════════════════════════════════════════════════════
  */
  for (const account of [E2E_STAFF_SECOND, E2E_STAFF_THIRD, E2E_STAFF_FOURTH]) {
    const response = await context.post(`${apiBase}/api/v1/auth/staff/login`, {
      data: { email: account.email, password: account.password },
    });
    const minted = (await response.json()) as LoginBody;

    if (!minted.data) {
      throw new Error(
        `Playwright global setup could not sign in ${account.email}: ` +
          JSON.stringify(minted).slice(0, 200),
      );
    }

    await writeFile(
      account.state,
      JSON.stringify({
        cookies: [
          {
            name: 'sailent_staff_session',
            value: JSON.stringify({
              accessToken: minted.data.accessToken,
              refreshToken: minted.data.refreshToken,
              expiresAt: Date.now() + minted.data.expiresIn * 1000,
              actor: minted.data.actor,
            }),
            domain: hostname,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 3600,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      }),
    );
  }

  /*
    ══════════════════════════════════════════════════════════════════════════
    CLEARED AGAIN, NOW THAT SETUP HAS FINISHED SPENDING THE BUDGET.

    Staff login is capped at five attempts a minute PER ADDRESS, and every
    login in this file comes from one. Setup itself now spends four — one per
    pre-minted session — which left `admin-auth.spec.ts` a budget of one for a
    test whose entire job is to submit a wrong password and read the message.
    It got RATE_LIMITED instead and failed on an assertion about wording.

    The first clear at the top of this function deals with counters left by a
    PREVIOUS run. This one deals with the ones setup just created, so the suite
    starts from zero rather than from wherever provisioning happened to leave
    it — and so adding a fifth account later does not silently break an
    unrelated spec again.

    The limits are unchanged and still enforced. `apps/api/test/rate-limit.spec.ts`
    is what proves them, deliberately.
    ══════════════════════════════════════════════════════════════════════════
  */
  await clearRateLimits();

  // Sequentially, not in parallel: the OTP verify endpoint is rate limited and
  // four simultaneous sign-ins is exactly the burst it exists to refuse.
  for (const project of playwrightConfig.projects ?? []) {
    if (project.name) await createDonorSession(apiBase, appBase, project.name);
  }

  // And once more, because the donor sign-ins above spend the OTP budget the
  // same way — `dashboard.spec.ts` signs in a donor of its own.
  await clearRateLimits();

  await context.dispose();
  await warmImageCache(appBase);
}

/**
 * Sign in as a donor, and save that storage state too.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE OTP ROW IS WRITTEN DIRECTLY, AND THAT IS THE ONLY SHORTCUT.
 *
 * A donor signs in with a one-time code that is stored as a SHA-256 hash and
 * delivered out of band. There is no way to read one back — which is the point
 * of hashing it — so the code has to be planted. Everything downstream of that
 * row is production code: `/auth/donor/otp/verify`, the token issue, the
 * session row, the cookie shape.
 *
 * WHAT IS NOT DONE: no test-only endpoint, no "skip OTP in test mode" flag, no
 * environment branch inside the auth service. A backdoor added for a test suite
 * is a backdoor, and the fact that it is only meant to open in development is
 * exactly what everyone says about the one that shipped.
 *
 * The donor and one confirmed donation are created here rather than in the
 * seed, so the suite owns its own fixture and a reseed cannot silently change
 * what the dashboard tests are asserting against.
 *
 * The upsert conflicts on `lower(btrim(email))`, which is the unique index that
 * makes an address identify exactly one donor — the same guarantee sign-in
 * depends on. It conflicted on `phone` until email became the identity.
 * ══════════════════════════════════════════════════════════════════════════
 */
async function createDonorSession(
  apiBase: string,
  appBase: string,
  project: string,
): Promise<void> {
  const donorFixture = donorFor(project);
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();

  const code = '424242';

  try {
    // Idempotent: re-running the suite reuses the same donor rather than
    // accumulating one per run.
    const donor = await client.query<{ id: string }>(
      `INSERT INTO donors (donor_code, first_name, last_name, email, phone, email_opt_in)
            VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (lower(btrim(email))) DO UPDATE
              SET phone = EXCLUDED.phone,
                  donor_code = EXCLUDED.donor_code,
                  first_name = EXCLUDED.first_name,
                  last_name = EXCLUDED.last_name
         RETURNING id`,
      [
        donorFixture.donorCode,
        donorFixture.firstName,
        donorFixture.lastName,
        donorFixture.email,
        donorFixture.phone,
      ],
    );
    const donorId = donor.rows[0]!.id;

    const campaign = await client.query<{
      campaign_id: string;
      campaign_product_id: string;
      product_id: string;
    }>(
      `SELECT DISTINCT ON (cp.campaign_id)
              cp.campaign_id, cp.id AS campaign_product_id, cp.product_id
         FROM campaign_products cp
        ORDER BY cp.campaign_id, cp.sort_order
        LIMIT 1`,
    );
    const target = campaign.rows[0];

    if (target) {
      const donation = await client.query<{ id: string }>(
        `INSERT INTO donations (reference, donor_id, campaign_id, amount, status, donation_type, completed_at)
              VALUES ($1, $2, $3, 180000, 'successful', 'product', now())
         ON CONFLICT (reference) DO UPDATE SET amount = EXCLUDED.amount
           RETURNING id`,
        [donorFixture.reference, donorId, target.campaign_id],
      );
      const donationId = donation.rows[0]!.id;

      // The line must cite a real catalogue row — `donation_items_type_consistent`
      // requires a product line to name both the junction row and the product.
      await client.query(`DELETE FROM donation_items WHERE donation_id = $1`, [donationId]);
      await client.query(
        `INSERT INTO donation_items
           (donation_id, campaign_product_id, product_id, item_type, item_name, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, 'product', 'School kit', 2, 90000, 180000)`,
        [donationId, target.campaign_product_id, target.product_id],
      );
    }

    // The identifier is the address, normalised the way the service normalises.
    await client.query(`DELETE FROM otp_codes WHERE identifier = $1`, [donorFixture.email]);
    await client.query(
      `INSERT INTO otp_codes (identifier, purpose, code_hash, expires_at)
            VALUES ($1, 'donor_login', $2, now() + interval '30 minutes')`,
      [donorFixture.email, createHash('sha256').update(code).digest('hex')],
    );
  } finally {
    await client.end();
  }

  const context = await request.newContext();

  /**
   * REUSE A SESSION THAT STILL WORKS, RATHER THAN SIGNING IN AGAIN.
   *
   * Donor OTP verification is capped at 10 per fifteen minutes. That cap is a
   * real control on a sign-in endpoint and the suite works within it rather
   * than asking for it to be raised — but four sign-ins per run means two runs
   * per window, which is nothing like enough while iterating on these tests.
   *
   * So a saved state is PROBED against the API first. A session that still
   * answers is reused and costs nothing; one that does not — expired, or
   * revoked by the sign-out test on the previous run — is replaced.
   *
   * The OTP exchange itself is covered directly by the API's own suite
   * (`me.spec.ts`), so reusing a session here loses no coverage.
   */
  if (await reuseSession(context, apiBase, project)) {
    await context.dispose();
    return;
  }

  let response = await context.post(`${apiBase}/api/v1/auth/donor/otp/verify`, {
    data: { email: donorFixture.email, code },
  });

  // The window is fifteen minutes, so waiting it out is not an option. One
  // retry after a short pause covers a burst from a previous run finishing;
  // beyond that the message says plainly what to do.
  if (response.status() === 429) {
    console.log('[e2e] donor sign-in rate limited; waiting 30s…');
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    response = await context.post(`${apiBase}/api/v1/auth/donor/otp/verify`, {
      data: { email: donorFixture.email, code },
    });
  }

  const body = (await response.json()) as {
    data?: { accessToken: string; refreshToken: string; expiresIn: number; actor: unknown };
  };

  if (!body.data) {
    const hint =
      response.status() === 429
        ? ' Donor sign-in is capped at 10 per 15 minutes and the window is exhausted — wait it out. ' +
          'This is the limiter doing its job, not a bug.'
        : '';
    throw new Error(
      `Playwright global setup could not sign in a donor:` +
        ` ${JSON.stringify(body).slice(0, 300)}.${hint}`,
    );
  }

  const session = JSON.stringify({
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    expiresAt: Date.now() + body.data.expiresIn * 1000,
    actor: body.data.actor,
  });

  const { hostname } = new URL(appBase);

  const statePath = donorStateFor(project);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify({
      cookies: [
        {
          name: 'sailent_donor_session',
          value: session,
          domain: hostname,
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );

  await context.dispose();
}

/**
 * Load the homepage once, in a real browser, before any test runs.
 *
 * Next optimises images ON FIRST REQUEST, not at build time. A cold server with
 * an empty cache therefore spends a long time on its first page view — this
 * homepage carries about twenty photographs, and converting them all at once
 * took over THIRTY SECONDS here, which is the entire Playwright timeout.
 * Whichever test happened to go first failed, and passed on a re-run: exactly
 * the shape of a flake, and exactly what it was mistaken for.
 *
 * `curl` does not warm it. The optimiser keys its cache on the `Accept` header,
 * so a browser asking for AVIF gets a different entry from a plain request. It
 * has to be a browser.
 *
 * And it has to be SEVERAL WIDTHS. Each viewport picks a different entry from
 * the `srcset`, so warming at desktop leaves the tablet and phone projects to
 * generate their own — which is what went on failing after the first fix, on
 * the tablet project only.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AND THE WIDTH IS NOT THE VIEWPORT. It is the viewport times the DEVICE PIXEL
 * RATIO, because that is what the browser puts in the `srcset` request.
 *
 * The second fix warmed 320 / 393 / 768 / 1440 at a ratio of 1 and still failed
 * on tablet. iPad Mini is 768 CSS pixels at a ratio of 2, so it asks the
 * optimiser for 1536 — an entry nothing had warmed. Pixel 5 is 393 at 2.75 and
 * asks for about 1080. The two projects that passed, desktop and mobile-xs, are
 * the two whose ratio is 1.
 *
 * So the warm-up now runs the PROJECTS' OWN DESCRIPTORS, read from the config
 * rather than restated here. A viewport added to `playwright.config.ts` is
 * warmed automatically, and the list cannot drift out of step with the suite —
 * which is how this bug survived two attempts at fixing it.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Worth knowing beyond the tests: the first real visitor after a deploy pays
 * this same cost. Pre-sized images, or a CDN in front, is the production answer.
 */
async function warmImageCache(appBase: string): Promise<void> {
  const projects = playwrightConfig.projects ?? [];
  const browser = await chromium.launch();

  try {
    await Promise.all(
      projects.map(async (project) => {
        const use = project.use ?? {};
        const viewport = use.viewport ?? { width: 1280, height: 800 };
        if (!viewport) return;

        const page = await browser.newPage({
          viewport,
          // The half of the request the previous two fixes left out.
          deviceScaleFactor: use.deviceScaleFactor ?? 1,
          isMobile: use.isMobile,
          hasTouch: use.hasTouch,
          userAgent: use.userAgent,
        });

        try {
          await page.goto(appBase, { waitUntil: 'networkidle', timeout: 120_000 });
        } finally {
          await page.close();
        }
      }),
    );
  } catch {
    // A warm-up that fails is no reason to fail the run — the suite simply
    // pays the cost itself, as it did before.
  } finally {
    await browser.close();
  }
}

/**
 * Is the saved session for this project still usable?
 *
 * Probes `GET /me` with the stored access token. A 200 means the session is
 * live and the state file can be reused as it is. Anything else — expired,
 * revoked, missing, malformed — means sign in again.
 *
 * Deliberately does NOT try to refresh: a refresh rotates the token and would
 * have to rewrite the file, and the point of this function is to be a cheap
 * read-only check. The BFF refreshes during the run anyway.
 */
async function reuseSession(
  context: Awaited<ReturnType<typeof request.newContext>>,
  apiBase: string,
  project: string,
): Promise<boolean> {
  try {
    const raw = await readFile(donorStateFor(project), 'utf8');
    const state = JSON.parse(raw) as { cookies?: { name: string; value: string }[] };
    const cookie = state.cookies?.find((entry) => entry.name === 'sailent_donor_session');
    if (!cookie) return false;

    const session = JSON.parse(cookie.value) as { accessToken?: string };
    if (!session.accessToken) return false;

    const probe = await context.get(`${apiBase}/api/v1/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    return probe.status() === 200;
  } catch {
    return false;
  }
}

/**
 * The current TOTP code for the seeded development secret.
 *
 * RFC 6238, implemented here rather than imported: this file runs under
 * Playwright's own loader, outside the API's module graph, so pulling in
 * `TotpService` would drag a Nest dependency tree into global setup.
 */
function devTotpCode(secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
