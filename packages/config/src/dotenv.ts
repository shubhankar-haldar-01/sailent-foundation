import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// Type-only: erased at compile time, so this does NOT pull dotenv into a bundle.
import type { config as DotenvConfig } from 'dotenv';

/**
 * Load the repository-root `.env` into `process.env`.
 *
 * WHY THIS EXISTS
 * Applications in this monorepo run from their own directory (`apps/api`,
 * `apps/worker`), but there is ONE `.env` at the repository root. Keeping a
 * separate `.env` per app would mean the same database URL copied three times
 * and drifting out of sync — a class of bug that is tedious to diagnose.
 *
 * WHY IT WALKS UP
 * Neither `process.cwd()` nor `import.meta.url` is reliable across the ways
 * these processes start: `pnpm dev` from the root, a workspace filter, `node
 * dist/main.js` from the app directory, or a test runner. Walking up from the
 * cwd until it finds the directory containing `pnpm-workspace.yaml` works from
 * all of them.
 *
 * IN PRODUCTION this is a no-op: Vercel, Render and Railway inject environment
 * variables into the process directly, there is no `.env` on disk, and the
 * function simply finds nothing and returns. Existing variables are never
 * overwritten, so a platform-provided value always wins over a stray file.
 */
export function loadRootEnvFile(): string | null {
  // A real deployment sets its variables directly; do not go looking for files.
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return null;
  }

  let current = resolve(process.cwd());

  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) {
      const envPath = resolve(current, '.env');
      if (!existsSync(envPath)) return null;

      // Loaded lazily via createRequire so `@sailent/config` never pulls dotenv
      // into a consumer that does not read files — notably the browser bundle,
      // which imports constants from this package. A bare `require` is not
      // available here because this package compiles to ESM.
      const { config } = createRequire(import.meta.url)('dotenv') as {
        config: typeof DotenvConfig;
      };
      // `override` is deliberately NOT set: a variable already present in the
      // environment wins over the file.
      config({ path: envPath });
      return envPath;
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}
