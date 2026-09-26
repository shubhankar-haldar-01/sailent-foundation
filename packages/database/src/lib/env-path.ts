import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the repository-root `.env`.
 *
 * Resolved from THIS FILE's location rather than `process.cwd()`. The cwd
 * differs depending on whether a script is run from the repo root, from the
 * package directory, or through a pnpm workspace filter — resolving against it
 * makes `pnpm db:generate` work in one place and fail in another.
 */
export const ROOT_ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env');

/** The repository root, discovered the same way and for the same reason. */
export const REPO_ROOT = dirname(ROOT_ENV_PATH);
