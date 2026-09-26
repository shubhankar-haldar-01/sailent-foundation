import { describe, expect, it } from 'vitest';

import { announceConnection, describeTarget, type ConnectionLogger } from '../announce.js';
import type { DatabaseClient } from '../client.js';
import type { ConnectionInfo } from '../connection-info.js';

/**
 * The startup message.
 *
 * These tests exist because the line this replaced was WRONG in the one case
 * that mattered: it printed "Connected to …" before anything had been dialled,
 * so an unreachable database produced a cheerful startup log and a 500 on the
 * first request. The assertions below are mostly about failure.
 */

function fakeClient(kind: ConnectionInfo['kind'], ping: () => Promise<boolean>): DatabaseClient {
  return {
    connection: {
      kind,
      host: 'example.test',
      port: kind === 'supabase-transaction-pooler' ? 6543 : 5432,
      describe: `example.test (${kind})`,
      safeForMigrations: kind !== 'supabase-transaction-pooler',
    } as ConnectionInfo,
    ping,
  } as unknown as DatabaseClient;
}

function recorder() {
  const lines: { level: keyof ConnectionLogger; message: string }[] = [];
  const logger: ConnectionLogger = {
    info: (message) => lines.push({ level: 'info', message }),
    warn: (message) => lines.push({ level: 'warn', message }),
    error: (message) => lines.push({ level: 'error', message }),
  };
  return {
    logger,
    lines,
    text: () => lines.map((line) => line.message).join('\n'),
    levels: (level: keyof ConnectionLogger) =>
      lines.filter((line) => line.level === level).map((line) => line.message),
  };
}

describe('describeTarget', () => {
  it('names the target before anything is dialled', () => {
    const message = describeTarget(fakeClient('supabase-session-pooler', async () => true));
    expect(message).toContain('Connecting to');
    expect(message).toContain('TLS verified');
  });

  it('does not claim TLS on a local socket', () => {
    expect(describeTarget(fakeClient('local', async () => true))).toContain('no TLS (local)');
  });
});

describe('announceConnection', () => {
  it('reports ready only after the database answers', async () => {
    const log = recorder();
    const ok = await announceConnection(
      fakeClient('local', async () => true),
      log.logger,
    );

    expect(ok).toBe(true);
    expect(log.text()).toContain('Connecting to');
    expect(log.text()).toContain('Database ready');
    expect(log.levels('error')).toEqual([]);
  });

  it('does not say ready when the ping returns false', async () => {
    const log = recorder();
    const ok = await announceConnection(
      fakeClient('local', async () => false),
      log.logger,
    );

    expect(ok).toBe(false);
    expect(log.text()).not.toContain('Database ready');
    expect(log.levels('error').join()).toContain('did not answer');
  });

  it('NEVER THROWS, so a boot sequence is not taken down by an outage', async () => {
    const log = recorder();
    const ok = await announceConnection(
      fakeClient('supabase-session-pooler', async () => {
        throw new Error('connect ETIMEDOUT');
      }),
      log.logger,
    );

    // Crashing here would take the health endpoint with it — and that is what
    // the platform reads to decide whether to send traffic.
    expect(ok).toBe(false);
    expect(log.levels('error').join()).toContain('UNREACHABLE');
  });

  describe('the diagnostics, which are the point', () => {
    const cases: [string, string, RegExp][] = [
      [
        'an untrusted CA points at DATABASE_CA_CERT, not at disabling checks',
        'self-signed certificate in certificate chain',
        /DATABASE_CA_CERT[\s\S]*Do NOT disable verification/,
      ],
      [
        'a DNS failure names the unescaped-password trap',
        'getaddrinfo ENOTFOUND 6@aws-0-ap-south-1.pooler.supabase.com',
        /percent-encode/,
      ],
      [
        'a rejected credential says so plainly',
        'password authentication failed for user "postgres"',
        /Credentials were rejected/,
      ],
    ];

    for (const [name, failure, expected] of cases) {
      it(name, async () => {
        const log = recorder();
        await announceConnection(
          fakeClient('supabase-session-pooler', async () => {
            throw new Error(failure);
          }),
          log.logger,
        );
        expect(log.levels('error').join('\n')).toMatch(expected);
      });
    }

    it('says nothing speculative about a failure it does not recognise', async () => {
      const log = recorder();
      await announceConnection(
        fakeClient('supabase-session-pooler', async () => {
          throw new Error('something nobody predicted');
        }),
        log.logger,
      );
      // One line: the failure itself. Guessing at a cause sends people the
      // wrong way more expensively than saying nothing.
      expect(log.levels('error')).toHaveLength(1);
    });
  });

  it('warns about the transaction pooler, which breaks row locks', async () => {
    const log = recorder();
    await announceConnection(
      fakeClient('supabase-transaction-pooler', async () => true),
      log.logger,
    );
    expect(log.levels('warn').join()).toContain('TRANSACTION pooler');
  });

  it('does not warn about latency on a local database', async () => {
    const log = recorder();
    await announceConnection(
      fakeClient('local', async () => true),
      log.logger,
    );
    expect(log.levels('warn').join()).not.toContain('round trip');
  });
});
