/**
 * What kind of Postgres connection is this?
 *
 * Supabase offers three, and they are NOT interchangeable. Choosing the wrong
 * one produces failures that look like application bugs:
 *
 *   • Direct        db.<ref>.supabase.co:5432
 *     A real Postgres connection. Full session semantics. IPv6-only on new
 *     projects unless the IPv4 add-on is enabled — which is why it is not the
 *     default recommendation here despite being the most capable.
 *
 *   • Session pooler  aws-N-<region>.pooler.supabase.com:5432
 *     PgBouncer in SESSION mode. Behaves like a direct connection — prepared
 *     statements, session state, advisory locks all work — while reachable over
 *     IPv4. The right default for a long-lived server process (decision A12).
 *
 *   • Transaction pooler  aws-N-<region>.pooler.supabase.com:6543
 *     PgBouncer in TRANSACTION mode, for serverless functions that open a
 *     connection per invocation. A connection is returned to the pool between
 *     transactions, so session state does not survive and advisory locks taken
 *     outside a transaction are silently lost. MIGRATIONS MUST NOT RUN HERE.
 *
 * This module exists so that the wrong choice is caught at startup with a
 * sentence explaining it, rather than at 2am as a migration that half-applied.
 */

export type ConnectionKind =
  'local' | 'supabase-direct' | 'supabase-session-pooler' | 'supabase-transaction-pooler' | 'other';

export interface ConnectionInfo {
  kind: ConnectionKind;
  host: string;
  port: number;
  /** Safe to log: user, password and database name removed. */
  describe: string;
  /** Whether running schema migrations over this connection is safe. */
  safeForMigrations: boolean;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

export function inspectConnection(connectionString: string): ConnectionInfo {
  let host = '';
  let port = 5432;

  try {
    const url = new URL(connectionString);
    host = url.hostname;
    port = url.port ? Number(url.port) : 5432;
  } catch {
    // An unparseable string is somebody else's error to report; do not guess.
    return {
      kind: 'other',
      host: '',
      port: 5432,
      describe: 'unparseable connection string',
      safeForMigrations: true,
    };
  }

  const kind = classify(host, port);

  return {
    kind,
    host,
    port,
    describe: `${host}:${port} (${kind})`,
    // Transaction pooling is the only one that is genuinely unsafe for DDL.
    safeForMigrations: kind !== 'supabase-transaction-pooler',
  };
}

function classify(host: string, port: number): ConnectionKind {
  if (LOCAL_HOSTS.has(host)) return 'local';

  if (host.endsWith('.pooler.supabase.com')) {
    return port === 6543 ? 'supabase-transaction-pooler' : 'supabase-session-pooler';
  }

  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.com')) {
    return 'supabase-direct';
  }

  return 'other';
}

/** True when the connection must be made over TLS. Every hosted provider requires it. */
export function requiresTls(info: ConnectionInfo): boolean {
  return info.kind !== 'local';
}
