import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema/index.js';
import { inspectConnection, requiresTls, type ConnectionInfo } from './connection-info.js';
import { REPO_ROOT } from './lib/env-path.js';

/**
 * Database client (decision A12).
 *
 * This uses the POOLED node-postgres driver, not Neon's HTTP serverless driver.
 * That is deliberate: the API is a long-lived process, and the donation-capture
 * path needs `SELECT … FOR UPDATE` across several rows inside one transaction.
 * The HTTP driver cannot run multi-statement transactions, so choosing it would
 * have made the correct concurrency design impossible (docs/phase-0-decisions.md).
 *
 * Do not swap this for `@neondatabase/serverless` HTTP mode without revisiting
 * decision A6 first. The same reasoning rules out Supabase's transaction-mode
 * pooler for anything that needs session state — see `connection-info.ts`.
 */

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseClientOptions {
  connectionString: string;
  /** Max pooled connections. Keep below the provider's ceiling. */
  maxConnections?: number;
  /** Close idle connections after this many ms. */
  idleTimeoutMs?: number;
  /** Fail a connection attempt after this many ms rather than hanging. */
  connectionTimeoutMs?: number;
  /** Log every statement. Development only — statements can contain PII. */
  logger?: boolean;
  /**
   * Skip TLS certificate verification.
   *
   * Defaults to false, and should stay there. An unverified TLS connection is
   * encrypted against a passive listener and wide open to an active one, which
   * for a connection carrying donor PII and password hashes is not a trade
   * worth making. The escape hatch exists only for a provider presenting a
   * certificate chain the host cannot verify; the fix is to install their CA,
   * not to stop checking.
   */
  insecureTls?: boolean;
  /**
   * A PEM certificate authority to trust, in addition to Node's built-in roots.
   *
   * This is the answer to the sentence above. Supabase issues its database
   * certificates from its OWN root — "Supabase Root 2021 CA" — which Node does
   * not ship and therefore rejects with `SELF_SIGNED_CERT_IN_CHAIN`. That looks
   * like a broken connection and is usually "fixed" by turning verification
   * off, which trades a loud failure for a silent exposure.
   *
   * Supplying their root instead keeps full verification: the chain is checked,
   * the hostname is checked, and an attacker presenting any other certificate
   * is still refused.
   *
   * Defaults to `DATABASE_CA_CERT`, a path resolved against the REPOSITORY
   * ROOT rather than the working directory — the API runs from `apps/api`, the
   * worker from `apps/worker` and migrations from `packages/database`, so a
   * cwd-relative path would work in one and fail in the others. Every caller
   * goes through this function, so one setting covers all four.
   */
  caCert?: string;
  caCertPath?: string;
}

/**
 * Load the CA to trust, if one is configured.
 *
 * A configured path that cannot be read THROWS rather than falling back to the
 * default roots. Silently continuing would mean a deployment that believes it
 * pinned a CA and did not, which is the failure mode this whole option exists
 * to avoid.
 */
function loadCaCert(options: DatabaseClientOptions): string | undefined {
  if (options.caCert) return options.caCert;

  const path = options.caCertPath ?? process.env.DATABASE_CA_CERT;
  if (!path) return undefined;

  const absolute = isAbsolute(path) ? path : resolve(REPO_ROOT, path);
  try {
    return readFileSync(absolute, 'utf8');
  } catch (error) {
    throw new Error(
      `DATABASE_CA_CERT points at ${absolute}, which could not be read: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export interface DatabaseClient {
  db: Database;
  pool: pg.Pool;
  /** What we connected to. Safe to log — no credentials. */
  connection: ConnectionInfo;
  /** `SELECT 1` — used by the API health check. */
  ping: () => Promise<boolean>;
  close: () => Promise<void>;
}

export function createDatabaseClient(options: DatabaseClientOptions): DatabaseClient {
  const connection = inspectConnection(options.connectionString);

  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 10,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 10_000,
    /**
     * TLS for every hosted provider; off for a local socket, where there is no
     * network to intercept and no certificate to verify.
     *
     * Passing an `ssl` object overrides any `sslmode` in the connection string,
     * which is deliberate: Supabase's dashboard hands out URLs ending in
     * `?sslmode=require`, and `require` encrypts WITHOUT verifying the
     * certificate. That is the setting that looks secure and is not.
     */
    ssl: requiresTls(connection)
      ? {
          rejectUnauthorized: options.insecureTls !== true,
          // `undefined` leaves Node's built-in roots in place, which is right
          // for a provider with a publicly-trusted certificate.
          ca: loadCaCert(options),
        }
      : false,
  });

  // An idle-client error is otherwise an unhandled rejection that kills the process.
  pool.on('error', (error) => {
    console.error('[database] idle client error', error.message);
  });

  const db = drizzle(pool, { schema, logger: options.logger ?? false });

  return {
    db,
    pool,
    connection,
    async ping() {
      const result = await pool.query('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    },
    async close() {
      await pool.end();
    },
  };
}

export { schema };
