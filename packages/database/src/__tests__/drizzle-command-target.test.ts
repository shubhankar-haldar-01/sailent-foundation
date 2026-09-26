import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DatabaseTargetError, resolveDatabaseTarget } from '../lib/database-target.js';
import { forwardedArgs } from '../drizzle-guarded.js';

/**
 * The three commands that could still reach production without saying so.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE OPENS A CONNECTION, and that is deliberate.
 *
 * `db:migrate`, `db:push` and `db:studio` kept the `DATABASE_MIGRATION_URL ||
 * DATABASE_URL` fallback after every other command had been given the guard.
 * On a machine whose `.env` `DATABASE_URL` points at production — which is the
 * normal state of this repository — that made `db:push` a schema change to
 * production and `db:studio` a browser onto real donor records.
 *
 * These tests drive the SAME resolver call each command makes, with the same
 * `variables` list, over a plain object. They cannot connect anywhere and
 * cannot be the thing that repeats the accident they are about.
 * ══════════════════════════════════════════════════════════════════════════
 */

const LOCAL = 'postgres://sailent:pw@localhost:5432/sailent_dev';
const PRODUCTION =
  'postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
const PRODUCTION_HOST = 'aws-0-ap-south-1.pooler.supabase.com';

/** Exactly what `migrate.ts` and `drizzle-guarded.ts` pass. */
const VARIABLES = ['DATABASE_MIGRATION_URL', 'DATABASE_URL'] as const;

const resolveFor = (
  command: string,
  env: Record<string, string | undefined>,
  declared: 'local' | 'production' | null,
  confirmedHost: string | null = null,
) => resolveDatabaseTarget(env, { command, declared, confirmedHost, variables: VARIABLES });

const COMMANDS = ['db:migrate', 'db:push', 'db:studio'] as const;

describe.each(COMMANDS)('%s target safety', (command) => {
  it('REFUSES when no environment was declared', () => {
    expect(() => resolveFor(command, { DATABASE_URL: LOCAL }, null)).toThrow(DatabaseTargetError);
    expect(() => resolveFor(command, { DATABASE_URL: LOCAL }, null)).toThrow(/--target=local/);
  });

  it('REFUSES when no target is configured at all', () => {
    expect(() => resolveFor(command, {}, 'local')).toThrow(/no database target is configured/);
  });

  it('REFUSES production without --confirm-host', () => {
    expect(() => resolveFor(command, { DATABASE_URL: PRODUCTION }, 'production')).toThrow(
      DatabaseTargetError,
    );
    expect(() => resolveFor(command, { DATABASE_URL: PRODUCTION }, 'production')).toThrow(
      /Confirm by repeating the host exactly/,
    );
  });

  it('REFUSES production when the confirmed host is wrong', () => {
    expect(() =>
      resolveFor(
        command,
        { DATABASE_URL: PRODUCTION },
        'production',
        'aws-0-ap-south-1.pooler.supabase.co',
      ),
    ).toThrow(/does not match/);
    // A near miss is not a near pass: one character out is still a refusal.
    expect(() =>
      resolveFor(command, { DATABASE_URL: PRODUCTION }, 'production', 'pooler.supabase.com'),
    ).toThrow(DatabaseTargetError);
  });

  it('REFUSES --target=local against a REMOTE database', () => {
    expect(() => resolveFor(command, { DATABASE_URL: PRODUCTION }, 'local')).toThrow(
      /which is not a local database/,
    );
  });

  it('REFUSES --target=production against a LOCAL database', () => {
    expect(() =>
      resolveFor(command, { DATABASE_URL: LOCAL }, 'production', PRODUCTION_HOST),
    ).toThrow(/which IS local/);
  });

  it('ALLOWS --target=local against a local database', () => {
    const target = resolveFor(command, { DATABASE_URL: LOCAL }, 'local');
    expect(target.kind).toBe('local');
    expect(target.host).toBe('localhost');
    expect(target.database).toBe('sailent_dev');
  });

  /*
    The resolver accepts it; nothing here executes anything. The command that
    would follow this resolution is never run against production in a test.
  */
  it('ACCEPTS --target=production with the exact host, without executing anything', () => {
    const target = resolveFor(command, { DATABASE_URL: PRODUCTION }, 'production', PRODUCTION_HOST);
    expect(target.kind).toBe('remote');
    expect(target.host).toBe(PRODUCTION_HOST);
  });

  // ---- the fallback that was the whole problem ---------------------------

  it('does NOT silently prefer DATABASE_MIGRATION_URL over DATABASE_URL', () => {
    // The old `DATABASE_MIGRATION_URL || DATABASE_URL` would have picked
    // production here and said nothing.
    expect(() =>
      resolveFor(command, { DATABASE_MIGRATION_URL: PRODUCTION, DATABASE_URL: LOCAL }, 'local'),
    ).toThrow(/will not choose between them/);
  });

  it('names BOTH hosts when the two variables disagree, and no password', () => {
    let message = '';
    try {
      resolveFor(command, { DATABASE_MIGRATION_URL: PRODUCTION, DATABASE_URL: LOCAL }, 'local');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(PRODUCTION_HOST);
    expect(message).toContain('localhost');
    // Hostnames are diagnostics; credentials are not.
    expect(message).not.toContain('hunter2');
  });

  it('does NOT fall back to DATABASE_URL when the declared target is incompatible', () => {
    // Only DATABASE_URL is set, and it is remote. `--target=local` must refuse
    // rather than quietly use the one target it can see.
    expect(() => resolveFor(command, { DATABASE_URL: PRODUCTION }, 'local')).toThrow(
      DatabaseTargetError,
    );
    // And the reverse: a local-only environment cannot satisfy --target=production.
    expect(() =>
      resolveFor(command, { DATABASE_MIGRATION_URL: LOCAL }, 'production', PRODUCTION_HOST),
    ).toThrow(DatabaseTargetError);
  });

  it('never puts a password in a refusal', () => {
    for (const attempt of [
      () => resolveFor(command, { DATABASE_URL: PRODUCTION }, null),
      () => resolveFor(command, { DATABASE_URL: PRODUCTION }, 'local'),
      () => resolveFor(command, { DATABASE_URL: PRODUCTION }, 'production'),
      () => resolveFor(command, { DATABASE_URL: PRODUCTION }, 'production', 'wrong.example.com'),
    ]) {
      expect(attempt).toThrow();
      try {
        attempt();
      } catch (error) {
        expect((error as Error).message).not.toContain('hunter2');
      }
    }
  });
});

/**
 * The wrapper strips its own flags before handing the rest to drizzle-kit,
 * which rejects options it does not recognise.
 */
describe('drizzle-kit argument forwarding', () => {
  it('removes --target and --confirm-host in both spellings', () => {
    expect(forwardedArgs(['--target=local'])).toEqual([]);
    expect(forwardedArgs(['--target', 'local'])).toEqual([]);
    expect(forwardedArgs(['--target=production', '--confirm-host=db.example.com'])).toEqual([]);
    expect(forwardedArgs(['--target', 'production', '--confirm-host', 'db.example.com'])).toEqual(
      [],
    );
  });

  it('keeps drizzle-kit’s own flags untouched', () => {
    expect(forwardedArgs(['--target=local', '--force'])).toEqual(['--force']);
    expect(forwardedArgs(['--verbose', '--target', 'local', '--port', '4983'])).toEqual([
      '--verbose',
      '--port',
      '4983',
    ]);
  });
});

/**
 * The same refusals, driven through the REAL command line.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONLY REFUSALS ARE EXERCISED HERE, deliberately.
 *
 * A passing target would mean `db:migrate` applying DDL, `db:push` rewriting a
 * schema and `db:studio` starting a server that does not exit — so the happy
 * path is asserted against the resolver above, where it costs nothing, and
 * this file only ever proves that the command STOPS.
 *
 * The remote URL is a `.invalid` hostname, which the DNS RFCs guarantee can
 * never resolve. The guard refuses on the hostname long before a socket is
 * opened; this is the second lock, so that even a regression in the first one
 * cannot land a test on somebody's real database.
 * ══════════════════════════════════════════════════════════════════════════
 */
describe('the commands themselves refuse, before connecting', () => {
  const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
  const FAKE_REMOTE =
    'postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.invalid:5432/postgres';
  const FAKE_REMOTE_HOST = 'aws-0-ap-south-1.pooler.supabase.invalid';
  const LOCAL_ONLY = 'postgres://sailent:pw@localhost:5432/sailent_nonexistent_probe';

  function run(args: string[], env: Record<string, string | undefined>) {
    const result = spawnSync('pnpm', ['exec', 'tsx', ...args], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      env: {
        // A bare environment: the commands load `.env` themselves, and
        // inheriting this process's variables would reintroduce the very
        // ambiguity under test.
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: 'development',
        APP_ENV: 'development',
        ...env,
      },
    });
    return `${result.stdout ?? ''}${result.stderr ?? ''}`;
  }

  const INVOCATIONS: Array<[string, string[]]> = [
    ['db:migrate', ['src/migrate.ts']],
    ['db:push', ['src/drizzle-guarded.ts', 'push']],
    ['db:studio', ['src/drizzle-guarded.ts', 'studio']],
  ];

  describe.each(INVOCATIONS)('%s', (_label, argv) => {
    it('refuses when no environment is declared', () => {
      const output = run(argv, { DATABASE_URL: FAKE_REMOTE });
      expect(output).toMatch(/REFUSED/);
      expect(output).toMatch(/say which environment/i);
    });

    it('refuses a remote database declared local', () => {
      const output = run([...argv, '--target=local'], { DATABASE_URL: FAKE_REMOTE });
      expect(output).toMatch(/REFUSED/);
      expect(output).toMatch(/not a local database/);
    });

    it('refuses production without the host typed back', () => {
      const output = run([...argv, '--target=production'], { DATABASE_URL: FAKE_REMOTE });
      expect(output).toMatch(/REFUSED/);
      expect(output).toContain(`--confirm-host=${FAKE_REMOTE_HOST}`);
    });

    it('refuses production when the host does not match', () => {
      const output = run([...argv, '--target=production', '--confirm-host=wrong.example.com'], {
        DATABASE_URL: FAKE_REMOTE,
      });
      expect(output).toMatch(/REFUSED/);
      expect(output).toMatch(/does not match/);
    });

    it('refuses rather than choosing between two disagreeing variables', () => {
      const output = run([...argv, '--target=local'], {
        DATABASE_URL: LOCAL_ONLY,
        DATABASE_MIGRATION_URL: FAKE_REMOTE,
      });
      expect(output).toMatch(/REFUSED/);
      expect(output).toMatch(/will not choose between them/);
    });

    it('never echoes the password from the connection string', () => {
      for (const extra of [[], ['--target=local'], ['--target=production']]) {
        expect(run([...argv, ...extra], { DATABASE_URL: FAKE_REMOTE })).not.toContain('hunter2');
      }
    });
  });
});

/**
 * The config cannot reach production even when drizzle-kit is run BY HAND.
 *
 * The wrapper is the front door, and a front door only helps people who use
 * it. Somebody who types `pnpm exec drizzle-kit studio` — or a script written
 * before this guard existed — bypasses it entirely, so the config itself must
 * not be able to resolve a real database on its own.
 */
describe('drizzle.config.ts reads only the authorised target', () => {
  const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
  const PRODUCTION_IN_ENV =
    'postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

  /*
    Run in a SEPARATE PROCESS rather than imported.

    The config is evaluated at import, so asserting on it twice with different
    environments needs two evaluations — and importing it from here would also
    drag a file outside `rootDir` into the package's own build.
  */
  const PROBE = [
    "import('./drizzle.config.ts').then((m) => {",
    '  const u = new URL(m.default.dbCredentials.url);',
    '  console.log(JSON.stringify({ hostname: u.hostname, port: u.port }));',
    '});',
  ].join('\n');

  function resolvedHost(env: Record<string, string | undefined>) {
    const result = spawnSync('pnpm', ['exec', 'tsx', '-e', PROBE], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    });
    return JSON.parse((result.stdout ?? '').trim()) as { hostname: string; port: string };
  }

  it('IGNORES DATABASE_URL and DATABASE_MIGRATION_URL entirely', () => {
    // Not the production host, and not reachable: nothing listens on port 1.
    expect(
      resolvedHost({
        DATABASE_URL: PRODUCTION_IN_ENV,
        DATABASE_MIGRATION_URL: PRODUCTION_IN_ENV,
      }),
    ).toEqual({ hostname: '127.0.0.1', port: '1' });
  });

  it('uses the target the wrapper authorised', () => {
    expect(
      resolvedHost({
        DATABASE_URL: PRODUCTION_IN_ENV,
        DRIZZLE_AUTHORISED_URL: 'postgres://sailent:pw@localhost:5432/sailent_dev',
      }),
    ).toEqual({ hostname: 'localhost', port: '5432' });
  });
});
