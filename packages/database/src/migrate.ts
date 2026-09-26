import { config as loadDotenv } from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDatabaseClient } from './client.js';
import { announceConnection } from './announce.js';
import { inspectConnection } from './connection-info.js';
import { ROOT_ENV_PATH } from './lib/env-path.js';
import {
  DatabaseTargetError,
  parseTargetFlags,
  resolveDatabaseTarget,
} from './lib/database-target.js';

loadDotenv({ path: ROOT_ENV_PATH });

/**
 * Migration runner.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHICH DATABASE, DECIDED BEFORE A CONNECTION IS OPENED.
 *
 * This read `DATABASE_MIGRATION_URL || DATABASE_URL` — the exact fallback chain
 * that let `db:rotate-admin-password` change a production credential during a
 * test run. `db:seed`, `db:harden`, `db:create-admin`,
 * `db:rotate-admin-password` and `db:prepare-e2e` were all given the shared
 * guard afterwards; the three drizzle-kit commands were not, and on a machine
 * whose `.env` `DATABASE_URL` points at production, `db:migrate` was one
 * mistyped command away from applying DDL to it.
 *
 * BOTH variables stay readable here, because migrations have a real reason to
 * use a separate DDL role (docs/security-architecture.md §12). What has gone is
 * the PREFERENCE between them: if both are set to different databases the guard
 * refuses and names both hosts, instead of silently picking one.
 * ══════════════════════════════════════════════════════════════════════════
 */
async function main(): Promise<void> {
  const flags = parseTargetFlags(process.argv.slice(2));
  const target = resolveDatabaseTarget(process.env, {
    command: 'db:migrate',
    declared: flags.declared,
    confirmedHost: flags.confirmedHost,
    variables: ['DATABASE_MIGRATION_URL', 'DATABASE_URL'],
  });
  const connectionString = target.connectionString;

  console.log(
    `[migrate] Target: ${target.host}/${target.database} (${target.kind}, from ${target.source}).`,
  );

  /**
   * Refuse to migrate over a transaction-mode pooler.
   *
   * PgBouncer in transaction mode hands the connection back to the pool between
   * transactions, so anything depending on session state — advisory locks, a
   * multi-statement DDL sequence, `SET` — does not behave as written. The
   * failure is not a clean error: it is a migration that applies part of itself
   * and leaves the schema in a state no test has ever seen.
   *
   * Supabase exposes this pooler on port 6543 and its session-mode pooler on
   * 5432. Both look identical in a connection string apart from that number,
   * which is exactly why this check exists.
   */
  const connection = inspectConnection(connectionString);

  if (!connection.safeForMigrations) {
    throw new Error(
      `Refusing to run migrations over ${connection.describe}.\n\n` +
        'This is a TRANSACTION-mode pooler (port 6543). It cannot hold the session\n' +
        'state that DDL needs, and a migration run through it can apply partially.\n\n' +
        'Use the direct connection or the SESSION pooler (port 5432) instead:\n' +
        '  DATABASE_MIGRATION_URL=postgresql://…@aws-0-<region>.pooler.supabase.com:5432/postgres\n\n' +
        'The application may keep using the transaction pooler; only migrations may not.',
    );
  }

  const client = createDatabaseClient({
    connectionString,
    maxConnections: 1,
    // Honoured so a developer who has had to set it for the app does not hit a
    // different failure here. It is still refused in production by the config.
    insecureTls: process.env.DATABASE_INSECURE_TLS === 'true',
  });

  try {
    /*
      Verified before any DDL runs, so an unreachable database fails with the
      reason — a CA it cannot trust, a password that needs percent-encoding —
      rather than with a stack trace from inside the migrator.
    */
    const alive = await announceConnection(client, {
      info: (message) => console.log(`[migrate] ${message}`),
      warn: (message) => console.warn(`[migrate] ${message}`),
      error: (message) => console.error(`[migrate] ${message}`),
    });
    if (!alive) throw new Error('Cannot reach the database — see above.');

    console.log('[migrate] applying migrations…');
    await migrate(client.db, { migrationsFolder: './drizzle' });
    console.log('[migrate] up to date');
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof DatabaseTargetError) {
    console.error(`\n[migrate] REFUSED\n${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  console.error('[migrate] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
