import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest for NestJS.
 *
 * Vitest transforms with esbuild by default, and esbuild does NOT implement
 * `emitDecoratorMetadata`. Without that metadata Nest cannot resolve a
 * constructor dependency from its type, so every DI-based unit test fails with
 * `Cannot read properties of undefined` — a failure that looks like a broken
 * test but is really a broken transform.
 *
 * unplugin-swc runs the same SWC transform Nest itself uses, which emits the
 * metadata. This is the reason for the `@swc/core` dependency.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,

    /*
      ══════════════════════════════════════════════════════════════════════
      THESE TIMEOUTS ARE FOR INTEGRATION TESTS, NOT UNIT TESTS.

      Vitest defaults to 5s, which suits a pure function and not a suite that
      boots a Nest application and talks to Postgres. With 24 spec files
      running in parallel, each booting its own app, the machine is the
      bottleneck: individual tests that take 400ms alone were crossing 5s
      under load, and a DIFFERENT random test failed on each run.

      It was NOT connection exhaustion, which is what it looks like. Peak
      usage measured across a full run is 24 of Postgres's 100, because each
      app pools 5 in development and the suites do not all run at once.

      So this is not masking a slow query. It is admitting that "how long may
      one test take" has a different answer when two dozen NestJS containers
      are starting at the same time.
      ══════════════════════════════════════════════════════════════════════
    */
    testTimeout: 20_000,
    hookTimeout: 60_000,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    root: './',

    /*
      Staff fixtures are created ONCE, here, before any spec file runs.
      Doing it per-app meant 25 parallel workers updating the same two rows
      and waiting on each other's locks — see test/global-setup.ts.
    */
    globalSetup: ['./test/global-setup.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
