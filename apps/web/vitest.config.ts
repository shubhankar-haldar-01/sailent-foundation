import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest for the web app.
 *
 * `jsx: 'automatic'` is required because the app's tsconfig sets
 * `jsx: "preserve"` — Next.js owns that transform in the real build, so vitest
 * has to be told explicitly or every .tsx test fails with "React is not defined".
 */
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      /*
        `server-only` is a build-time guard, not a runtime module: Next resolves
        it to something that throws if a client bundle imports it. Vitest has no
        such resolution, so a server module that declares the guard cannot be
        unit-tested at all — which would mean the sitemap builders, the thing
        most worth testing, could only be checked through a browser.

        Aliased to an empty module HERE ONLY. Production resolution is
        untouched, so the guard still does its job where it matters.
      */
      'server-only': path.resolve(import.meta.dirname, './src/lib/testing/server-only-stub.ts'),
    },
  },
});
