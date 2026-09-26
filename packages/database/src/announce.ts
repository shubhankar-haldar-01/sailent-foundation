import type { DatabaseClient } from './client.js';

/**
 * Say what we connected to — and whether it actually answered.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `new pg.Pool()` DOES NOT CONNECT. It is lazy: the first connection is opened
 * when the first query runs.
 *
 * So a line logged straight after the pool is constructed is not a connection
 * report, it is a statement of intent — and it printed "Connected to
 * db.example.supabase.co" just as cheerfully with a wrong password, an
 * unreachable host or a rejected certificate. The failure then surfaced on the
 * first request, as a 500 with a stack trace, several seconds after a startup
 * log that said everything was fine.
 *
 * This prints two lines instead:
 *
 *   • one BEFORE, naming the target, so a hang has something attached to it
 *   • one AFTER the database has actually answered, or the reason it did not
 *
 * IT DOES NOT THROW, and that is deliberate. Every route needs the database, so
 * crashing at boot is tempting — but it takes the health endpoint down with it,
 * which is what the platform uses to decide whether to route traffic, and a
 * transient blip becomes a restart loop. Reporting honestly and letting
 * readiness fail is the better trade.
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface ConnectionLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

/** The line printed before the first query is attempted. */
export function describeTarget(client: DatabaseClient): string {
  const tls = client.connection.kind === 'local' ? 'no TLS (local)' : 'TLS verified';
  return `Connecting to ${client.connection.describe} — ${tls}`;
}

/**
 * Ping, then report. Returns whether the database answered, so a caller that
 * wants to act on it can, without having to catch anything.
 */
export async function announceConnection(
  client: DatabaseClient,
  logger: ConnectionLogger,
): Promise<boolean> {
  logger.info(describeTarget(client));

  const startedAt = Date.now();
  try {
    const alive = await client.ping();
    const elapsed = Date.now() - startedAt;

    if (!alive) {
      logger.error(`Database did not answer — ${client.connection.describe}`);
      return false;
    }

    logger.info(`Database ready — ${client.connection.describe} (${elapsed}ms)`);

    /*
      Latency is worth saying out loud once. A local socket answers in single
      digits; a pooler in another region takes hundreds of milliseconds, and
      every request pays it. Somebody wondering why the app "got slow" after a
      database move should be able to find the answer in the startup log rather
      than in a profiler.
    */
    if (elapsed > 250 && client.connection.kind !== 'local') {
      logger.warn(
        `That round trip took ${elapsed}ms. Every query pays this — expect the ` +
          `application to feel slower than it does against a local database.`,
      );
    }

    if (client.connection.kind === 'supabase-transaction-pooler') {
      logger.warn(
        'This is the TRANSACTION pooler (port 6543). It does not preserve session ' +
          'state between transactions, which breaks SELECT … FOR UPDATE and prepared ' +
          'statements. Use the session pooler on port 5432 (decision A12).',
      );
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Database UNREACHABLE — ${client.connection.describe}: ${message}`);

    /*
      The three failures that actually happen, each with the fix rather than
      the symptom. Every one of them has cost somebody an afternoon.
    */
    if (/SELF_SIGNED_CERT_IN_CHAIN|self-signed certificate/i.test(message)) {
      logger.error(
        'The provider signs with a CA this host does not trust. Set DATABASE_CA_CERT ' +
          'to their root certificate. Do NOT disable verification — see docs/supabase.md.',
      );
    } else if (/getaddrinfo|ENOTFOUND|could not translate host/i.test(message)) {
      logger.error(
        'The hostname did not resolve. If the password contains @ : / ? or #, ' +
          'percent-encode it — an unescaped @ makes the URL split at the wrong place.',
      );
    } else if (/password authentication failed|SASL/i.test(message)) {
      logger.error('Credentials were rejected. Check the user and password in DATABASE_URL.');
    }

    return false;
  }
}
