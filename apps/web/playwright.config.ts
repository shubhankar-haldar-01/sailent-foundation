import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Read the repo-root `.env` by hand.
 *
 * Playwright loads this config as COMMONJS, and `@sailent/config/dotenv` is an
 * ES module — importing it fails with "Cannot use 'import.meta' outside a
 * module". Rather than reshape a shared package to suit one consumer, this
 * reads the handful of `E2E_*` keys it needs directly. No dependency, no
 * module-format coupling, and it cannot drift with the loader.
 *
 * Existing environment variables win, so CI can override without a file.
 */
function loadEnvFile(): void {
  try {
    const contents = readFileSync(resolve(__dirname, '../../.env'), 'utf8');
    for (const line of contents.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key!] !== undefined) continue;
      process.env[key!] = rawValue!.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env is fine: the defaults below are the local development values.
  }
}

loadEnvFile();

/**
 * E2E configuration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SUITE RUNS ITS OWN STACK, ON ITS OWN PORTS, AGAINST ITS OWN DATABASE.
 *
 * It used to start only the web app with `reuseExistingServer`, and assume an
 * API was already listening on 4000. Both of those pointed at whatever
 * `DATABASE_URL` said — which was the staging Supabase project. So every run
 * created a staff account there, signed four donors in, and left sessions
 * behind. Suspending that account by hand lasted exactly until the next run.
 *
 * Three things fix it, and all three are needed:
 *
 *   1. BOTH processes are started here, so neither can be inherited from a
 *      developer's shell with the wrong database behind it.
 *   2. They listen on 4100/3100, not 4000/3000, so the suite cannot collide
 *      with — or silently adopt — a dev server someone already has running.
 *   3. `reuseExistingServer: false` ALWAYS, including locally. Reuse is the
 *      exact mechanism that made this a staging problem: a server that was
 *      already up got used, and nothing checked what it was connected to.
 *
 * `global-setup.ts` additionally refuses to run if the database it is about to
 * write to is not local, or is the application's own. Belt and braces, because
 * the cost of being wrong is test fixtures in a live database.
 * ══════════════════════════════════════════════════════════════════════════
 */

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://sailent:sailent@localhost:5432/sailent_e2e';
const E2E_REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/2';
const API_PORT = process.env.E2E_API_PORT ?? '4100';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '3100';

const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

/** The header each project's browser sends its own client address in (see `stackEnv`). */
const E2E_CLIENT_IP_HEADER = 'x-e2e-client-ip';
const clientAddress = (last: number) => ({
  extraHTTPHeaders: { [E2E_CLIENT_IP_HEADER]: `198.51.100.${last}` },
});

/** Handed to both processes, so neither can reach the application database. */
const stackEnv = {
  NODE_ENV: 'development',
  APP_ENV: 'development',
  DATABASE_URL: E2E_DATABASE_URL,
  // The migration URL is read in preference to DATABASE_URL by some tooling;
  // leaving it pointed elsewhere would be a hole in exactly this fence.
  DATABASE_MIGRATION_URL: E2E_DATABASE_URL,
  REDIS_URL: E2E_REDIS_URL,
  API_URL,
  API_PORT,
  CORS_ORIGINS: WEB_URL,
  NEXT_PUBLIC_APP_URL: WEB_URL,

  /*
    EACH PROJECT IS ITS OWN CLIENT, as each visitor is in production.

    The API limits every client to 100 requests a minute per route, and it
    tells clients apart only by the address the web server vouches for
    (`x-sailent-client-ip` with `INTERNAL_API_SECRET`, Phase 11). Without these
    two lines all four projects were one client, and the signed-in dashboard
    tests ran into each other's 429s. The limits themselves are untouched; the
    API's own suite proves them (`apps/api/test/rate-limit.spec.ts`).

    Test-only values: the secret exists nowhere else, and each project sends
    its documentation-range address (RFC 5737) in `extraHTTPHeaders` below.
  */
  INTERNAL_API_SECRET: 'e2e-only-internal-api-secret-not-used-anywhere-else',
  CLIENT_IP_HEADER: E2E_CLIENT_IP_HEADER,

  /*
    AND FENCED AWAY FROM REAL OBJECT STORAGE, for the same reason.

    Playwright MERGES this into the parent environment, and the API loads the
    repo-root `.env` — so without these four lines an E2E run would pick up the
    real Cloudflare R2 credentials and write test images into `sailent-public`,
    the bucket the live site serves from. Every run, from every worker, with
    nothing to remove them afterwards.

    Blanked rather than pointed somewhere else because R2 has no local
    emulator: `optional()` in `@sailent/config` maps '' to undefined, so
    `StorageService.isConfigured` is false and an upload is refused with a 503
    that names the cause. That refusal is a real deployment state and is worth
    a browser test, which is what `admin-media.spec.ts` asserts.

    The REAL round-trip against the real buckets is covered instead by
    `apps/api/test/r2-round-trip.spec.ts`, which runs against the live service
    and deletes every object it creates. See docs/phase-10.6.md §E.
  */
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  R2_PUBLIC_BASE_URL: '',
};

// Exported so `global-setup.ts` targets the same database and API this config
// starts, rather than re-deriving them and drifting.
export const e2eStack = { databaseUrl: E2E_DATABASE_URL, apiUrl: API_URL, webUrl: WEB_URL };
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        ...clientAddress(11),
      },
    },
    { name: 'tablet', use: { ...devices['iPad Mini'], ...clientAddress(12) } },
    { name: 'mobile', use: { ...devices['Pixel 5'], ...clientAddress(13) } },
    // 320px: the narrowest width WCAG reflow requires support for.
    {
      name: 'mobile-xs',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
        ...clientAddress(14),
      },
    },
  ],
  /*
    TWO servers, both started here, both fenced to the E2E database.

    `reuseExistingServer: false` everywhere — not just in CI. Reuse is what let
    a Supabase-connected process serve the suite, and a slower start is a cheap
    price for knowing what the tests are talking to.
  */
  webServer: [
    {
      command: 'pnpm --filter @sailent/api start',
      cwd: '../..',
      url: `${API_URL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: stackEnv,
    },
    {
      // `next start` directly, not `pnpm start`: that script hardcodes
      // `--port 3000` and ignores PORT, so the suite waited on 3100 while the
      // server it had just launched sat on 3000 — beside a developer's own.
      command: `pnpm exec next start --port ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { ...stackEnv, PORT: WEB_PORT },
    },
  ],
});
