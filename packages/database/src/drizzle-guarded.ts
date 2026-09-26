import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import { ROOT_ENV_PATH } from './lib/env-path.js';
import {
  DatabaseTargetError,
  parseTargetFlags,
  resolveDatabaseTarget,
} from './lib/database-target.js';

loadDotenv({ path: ROOT_ENV_PATH });

/**
 * The guard in front of `drizzle-kit push` and `drizzle-kit studio`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THESE TWO NEEDED A WRAPPER RATHER THAN A FEW LINES IN THE CONFIG.
 *
 * `db:migrate` is our own script, so the guard goes straight into it.
 * `push` and `studio` are drizzle-kit's, and drizzle-kit resolves its own
 * connection from `drizzle.config.ts` before any code of ours runs. It also
 * rejects flags it does not recognise, so `--target=production` cannot simply
 * be passed through to it.
 *
 * So the order is inverted: THIS runs first, authorises a target, and only
 * then execs drizzle-kit — with the approved URL handed over in
 * `DRIZZLE_AUTHORISED_URL`, which is the single variable the config reads.
 *
 * WHAT THAT BUYS, beyond tidiness:
 *
 *   - The refusal happens BEFORE a socket is opened. `studio` in particular
 *     would otherwise have already connected and begun serving production
 *     rows over a local web UI by the time anybody noticed.
 *   - `DATABASE_URL` and `DATABASE_MIGRATION_URL` are DELETED from the child's
 *     environment. The config cannot fall back to them because it cannot see
 *     them — "no silent fallback" as a property of the process, not a rule
 *     somebody has to keep following.
 *
 * `db:generate` deliberately does NOT come through here. It never opens a
 * connection — it diffs the schema against the migration files — so demanding
 * that a developer declare an environment to generate SQL would be friction
 * that teaches people to reach for `drizzle-kit` directly, which is the one
 * habit this is trying to prevent.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Our own flags, removed before the rest is forwarded to drizzle-kit. */
const OWN_FLAGS = ['--target', '--confirm-host'];

export function forwardedArgs(argv: string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const owned = OWN_FLAGS.find((flag) => arg === flag || arg.startsWith(`${flag}=`));
    if (!owned) {
      out.push(arg);
      continue;
    }
    // `--target local` spends the following token too; `--target=local` does not.
    if (arg === owned && argv[index + 1] && !argv[index + 1]!.startsWith('--')) index += 1;
  }
  return out;
}

function main(): void {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (subcommand !== 'push' && subcommand !== 'studio') {
    throw new Error(
      `drizzle-guarded: expected "push" or "studio", got "${subcommand ?? '(nothing)'}".`,
    );
  }

  const command = `db:${subcommand}`;
  const flags = parseTargetFlags(rest);
  const target = resolveDatabaseTarget(process.env, {
    command,
    declared: flags.declared,
    confirmedHost: flags.confirmedHost,
    variables: ['DATABASE_MIGRATION_URL', 'DATABASE_URL'],
  });

  console.log(
    `[${command}] Target: ${target.host}/${target.database} (${target.kind}, from ${target.source}).`,
  );

  /*
    A COPY with the fallback variables removed, so the config has nothing to
    fall back TO. `DRIZZLE_AUTHORISED_URL` is the only target it can see.
  */
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DRIZZLE_AUTHORISED_URL: target.connectionString,
  };
  delete childEnv.DATABASE_URL;
  delete childEnv.DATABASE_MIGRATION_URL;

  const child = spawn('drizzle-kit', [subcommand, ...forwardedArgs(rest)], {
    stdio: 'inherit',
    env: childEnv,
  });

  // `studio` is long-running, so Ctrl-C has to reach it rather than orphan it.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => child.kill(signal));
  }

  child.on('error', (error: Error) => {
    console.error(`[${command}] could not start drizzle-kit: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 0);
  });
}

/**
 * Only run when EXECUTED, never when imported.
 *
 * Without this, importing the module to unit-test `forwardedArgs` ran the CLI:
 * it printed a failure about a missing subcommand and set `process.exitCode`
 * to 1 inside the test runner — a module whose import can fail the suite that
 * imports it.
 */
function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  try {
    main();
  } catch (error: unknown) {
    if (error instanceof DatabaseTargetError) {
      console.error(`\n[drizzle] REFUSED\n${error.message}\n`);
      process.exitCode = 1;
    } else {
      console.error('[drizzle] failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
