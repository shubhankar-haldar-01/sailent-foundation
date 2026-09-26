import { spawnSync } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';

import { ROOT_ENV_PATH } from './lib/env-path.js';
import {
  DatabaseTargetError,
  assertDistinctFromApplication,
  resolveDatabaseTarget,
} from './lib/database-target.js';

loadDotenv({ path: ROOT_ENV_PATH });

/**
 * Migrate and seed the end-to-end database.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SEPARATE DATABASE, ON PURPOSE.
 *
 * The Playwright suite creates a Super Admin, four donors, OTP rows and
 * sessions. For weeks it did that in the staging Supabase project, because its
 * setup simply read `DATABASE_URL` and nothing asked whether that was a
 * reasonable place to mint an administrator. Suspending the account it created
 * lasted until the next run recreated it.
 *
 * So the suite gets its own database and its own ports, and this prepares it.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Idempotent: safe to re-run whenever a migration lands or the fixtures drift.
 */
function run(script: string, databaseUrl: string, args: string[] = []): void {
  const result = spawnSync('pnpm', ['run', script, ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DATABASE_MIGRATION_URL: databaseUrl,
      // The seed refuses to create demo content when either of these says
      // production, and the E2E suite needs that content to have pages to open.
      NODE_ENV: 'development',
      APP_ENV: 'development',
    },
  });

  if (result.status !== 0) {
    throw new Error(`\`pnpm ${script}\` failed against the E2E database.`);
  }
}

const databaseUrl = process.env.E2E_DATABASE_URL;

if (!databaseUrl) {
  console.error(
    '[prepare-e2e] E2E_DATABASE_URL is not set.\n' +
      '  Add it to .env — see .env.example. It must be a LOCAL database that exists already:\n' +
      '    createdb -O sailent sailent_e2e\n',
  );
  process.exit(1);
}

/*
  THE SAME GUARD THE CREDENTIAL COMMANDS USE, not a second copy of it.

  This one matters more than most: it runs the SEED. Pointed at a live database
  it would not merely add test rows, it would add fictional programmes and
  campaigns to a real site.

  `--target=local` is implicit here rather than typed — this command has no
  legitimate production use at all, so declaring anything else would be
  meaningless. The resolver is given `local` and refuses if the URL disagrees.
*/
let target;
try {
  target = resolveDatabaseTarget(
    { DATABASE_URL: databaseUrl },
    { command: 'db:prepare-e2e', declared: 'local' },
  );
  assertDistinctFromApplication(databaseUrl, process.env, 'db:prepare-e2e');
} catch (error) {
  if (error instanceof DatabaseTargetError) {
    console.error(`\n[prepare-e2e] REFUSED\n${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

console.log(`[prepare-e2e] Target: ${target.host}/${target.database} (${target.kind}).`);

console.log('[prepare-e2e] migrating…');
/*
  `--target=local` is REQUIRED, exactly as it is for the seed below.

  It was missing, and `db:migrate` refused with "say which environment you are
  targeting" — so preparing the E2E database failed outright the first time a
  migration landed after the shared target guard was tightened. Setting
  `DATABASE_URL` in the child environment is not a declaration of intent; the
  whole point of the guard is that the two have to agree out loud.
*/
run('db:migrate', databaseUrl, ['--target=local']);
console.log('[prepare-e2e] seeding…');
/*
  `--target=local` is passed explicitly now that `db:seed` requires a declared
  environment. It is not ceremony here: this command has already proved the URL
  is local, and stating it again means the seed makes its own check rather than
  trusting a caller.
*/
run('db:seed', databaseUrl, ['--target=local']);
console.log('[prepare-e2e] ready. `pnpm test:e2e` will use this database.');
