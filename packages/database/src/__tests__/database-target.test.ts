import { describe, expect, it } from 'vitest';

import {
  DatabaseTargetError,
  assertDistinctFromApplication,
  parseTargetFlags,
  resolveDatabaseTarget,
} from '../lib/database-target.js';

/**
 * The guard written after a test rotated the production admin's password.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO DATABASE IS INVOLVED IN ANY OF THIS, and that is the point.
 *
 * The incident happened while testing a credential command against what was
 * believed to be a local database. So the safety behaviour is tested as a pure
 * function over an environment object: these tests cannot connect anywhere,
 * cannot change a password, and cannot be the thing that repeats the accident.
 * ══════════════════════════════════════════════════════════════════════════
 */

const LOCAL = 'postgres://sailent:pw@localhost:5432/sailent_dev';
const E2E = 'postgres://sailent:pw@localhost:5432/sailent_e2e';
const SUPABASE = 'postgresql://postgres:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
const UNKNOWN_REMOTE = 'postgres://user:pw@db.some-other-host.example.com:5432/app';

const resolve = (
  env: Record<string, string | undefined>,
  declared: 'local' | 'production' | null = 'local',
  confirmedHost?: string,
) => resolveDatabaseTarget(env, { command: 'db:test', declared, confirmedHost });

describe('the target must be declared', () => {
  it('refuses when nothing says which environment is meant', () => {
    // 5. Missing declaration is refused even though a URL is present.
    expect(() => resolve({ DATABASE_URL: LOCAL }, null)).toThrow(/say which environment/i);
  });

  it('refuses when no target is configured at all', () => {
    // 5. Missing database target.
    expect(() => resolve({}, 'local')).toThrow(/no database target is configured/i);
  });

  it('treats a blank variable as absent rather than as a target', () => {
    expect(() => resolve({ DATABASE_URL: '   ' }, 'local')).toThrow(
      /no database target is configured/i,
    );
  });
});

describe('no silent fallback between variables', () => {
  it('REFUSES when the two variables disagree', () => {
    /*
      4 and 11. THE ACTUAL INCIDENT.

      `DATABASE_MIGRATION_URL || DATABASE_URL` silently preferred one of these.
      A test set the local one and left the Supabase one in place from `.env`,
      and the command connected to production.
    */
    expect(() =>
      resolve({ DATABASE_URL: SUPABASE, DATABASE_MIGRATION_URL: LOCAL }, 'local'),
    ).toThrow(/two different database targets/i);
  });

  it('names both hosts in the refusal, so the mistake is visible', () => {
    try {
      resolve({ DATABASE_URL: SUPABASE, DATABASE_MIGRATION_URL: LOCAL }, 'local');
      expect.unreachable('should have refused');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('aws-0-ap-south-1.pooler.supabase.com');
      expect(message).toContain('localhost');
    }
  });

  it('accepts two variables that agree', () => {
    // Not ambiguous — the same database named twice.
    expect(resolve({ DATABASE_URL: LOCAL, DATABASE_MIGRATION_URL: LOCAL }, 'local').kind).toBe(
      'local',
    );
  });

  it('setting only one variable cannot reach Supabase while claiming local', () => {
    // 11. The single-variable case must still be checked, not trusted.
    expect(() => resolve({ DATABASE_MIGRATION_URL: SUPABASE }, 'local')).toThrow(
      /not a local database/i,
    );
  });
});

describe('a command can narrow which variables it reads', () => {
  /*
    `db:seed` passes `variables: ['DATABASE_URL']`. The strongest form of
    "never silently fall back" is being unable to read the alternative at all —
    a rule the code cannot break rather than one somebody has to remember.
  */
  const seedResolve = (
    env: Record<string, string | undefined>,
    declared: 'local' | 'production' | null = 'local',
    confirmedHost?: string,
  ) =>
    resolveDatabaseTarget(env, {
      command: 'db:seed',
      declared,
      confirmedHost,
      variables: ['DATABASE_URL'],
    });

  it('IGNORES DATABASE_MIGRATION_URL entirely', () => {
    // Not "prefers DATABASE_URL" — cannot see the other one.
    const target = seedResolve({ DATABASE_URL: LOCAL, DATABASE_MIGRATION_URL: SUPABASE });
    expect(target.host).toBe('localhost');
    expect(target.source).toBe('DATABASE_URL');
  });

  it('ignores TEST_DATABASE_URL and E2E_DATABASE_URL', () => {
    /*
      Both are set, to different databases, in every developer's `.env` by
      design. A resolver that treated them as candidates would refuse as
      ambiguous on a correctly configured machine, which teaches people to work
      around the guard.
    */
    const target = seedResolve({
      DATABASE_URL: LOCAL,
      TEST_DATABASE_URL: E2E,
      E2E_DATABASE_URL: E2E,
    });
    expect(target.database).toBe('sailent_dev');
  });

  it('still refuses when its one variable is missing', () => {
    expect(() => seedResolve({ DATABASE_MIGRATION_URL: LOCAL })).toThrow(
      /no database target is configured/i,
    );
  });

  it('names only the variable it actually reads in that refusal', () => {
    try {
      seedResolve({});
      expect.unreachable('should have refused');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).not.toContain('DATABASE_MIGRATION_URL');
    }
  });

  it('still requires a declared environment', () => {
    expect(() => seedResolve({ DATABASE_URL: LOCAL }, null)).toThrow(/say which environment/i);
  });

  it('still requires the host typed back for production', () => {
    expect(() => seedResolve({ DATABASE_URL: SUPABASE }, 'production')).toThrow(
      /PRODUCTION operation/i,
    );
    expect(
      seedResolve({ DATABASE_URL: SUPABASE }, 'production', 'aws-0-ap-south-1.pooler.supabase.com')
        .kind,
    ).toBe('remote');
  });
});

describe('the declaration is checked against reality', () => {
  it('allows a local database when declared local', () => {
    // 3.
    const target = resolve({ DATABASE_URL: LOCAL }, 'local');
    expect(target.kind).toBe('local');
    expect(target.host).toBe('localhost');
    expect(target.database).toBe('sailent_dev');
  });

  it('refuses Supabase when declared local', () => {
    // 1.
    expect(() => resolve({ DATABASE_URL: SUPABASE }, 'local')).toThrow(/not a local database/i);
  });

  it('refuses an unrecognised remote database when declared local', () => {
    // 2.
    expect(() => resolve({ DATABASE_URL: UNKNOWN_REMOTE }, 'local')).toThrow(
      /not a local database/i,
    );
  });

  it('refuses a LOCAL database when declared production', () => {
    // One of the two is wrong, and guessing which defeats the point.
    expect(() => resolve({ DATABASE_URL: LOCAL }, 'production', 'localhost')).toThrow(
      /which IS local/i,
    );
  });
});

describe('production needs the host typed back', () => {
  it('refuses production with no confirmation', () => {
    // 6.
    expect(() => resolve({ DATABASE_URL: SUPABASE }, 'production')).toThrow(
      /PRODUCTION operation/i,
    );
  });

  it('refuses a confirmation that does not match the host', () => {
    expect(() => resolve({ DATABASE_URL: SUPABASE }, 'production', 'localhost')).toThrow(
      /does not match/i,
    );
  });

  it('ALLOWS production when the host is typed exactly', () => {
    // 6. Deliberate production operations remain possible.
    const target = resolve(
      { DATABASE_URL: SUPABASE },
      'production',
      'aws-0-ap-south-1.pooler.supabase.com',
    );
    expect(target.kind).toBe('remote');
    expect(target.host).toBe('aws-0-ap-south-1.pooler.supabase.com');
  });

  it('prints the exact flag needed, so it cannot be guessed wrong', () => {
    try {
      resolve({ DATABASE_URL: SUPABASE }, 'production');
      expect.unreachable('should have refused');
    } catch (error) {
      expect((error as Error).message).toContain(
        '--confirm-host=aws-0-ap-south-1.pooler.supabase.com',
      );
    }
  });
});

describe('hostname matching is exact, not a substring', () => {
  it('does not accept a remote host that merely contains "localhost"', () => {
    /*
      The previous guards tested the connection STRING with a regex, which this
      satisfies. A database at `localhost.attacker.example.com` is remote.
    */
    expect(() =>
      resolve({ DATABASE_URL: 'postgres://u:p@localhost.attacker.example.com:5432/db' }, 'local'),
    ).toThrow(/not a local database/i);
  });

  it('accepts the genuine local forms', () => {
    for (const host of ['localhost', '127.0.0.1', 'host.docker.internal']) {
      expect(resolve({ DATABASE_URL: `postgres://u:p@${host}:5432/db` }, 'local').kind).toBe(
        'local',
      );
    }
  });

  it('refuses a malformed connection string rather than guessing', () => {
    expect(() => resolve({ DATABASE_URL: 'not-a-url' }, 'local')).toThrow(/not a valid/i);
  });
});

describe('the E2E database cannot become the application database', () => {
  it('refuses when they are the same string', () => {
    // 10.
    expect(() =>
      assertDistinctFromApplication(LOCAL, { DATABASE_URL: LOCAL }, 'db:prepare-e2e'),
    ).toThrow(/same database/i);
  });

  it('allows two different local databases', () => {
    expect(() =>
      assertDistinctFromApplication(E2E, { DATABASE_URL: LOCAL }, 'db:prepare-e2e'),
    ).not.toThrow();
  });
});

describe('flag parsing', () => {
  it('reads --target= and --confirm-host=', () => {
    expect(parseTargetFlags(['--target=production', '--confirm-host=db.example.com'])).toEqual({
      declared: 'production',
      confirmedHost: 'db.example.com',
    });
  });

  it('reads the space-separated form too', () => {
    expect(parseTargetFlags(['--target', 'local'])).toEqual({
      declared: 'local',
      confirmedHost: null,
    });
  });

  it('returns null when nothing was declared, rather than defaulting', () => {
    // A default here would reintroduce the whole problem.
    expect(parseTargetFlags(['--confirm'])).toEqual({ declared: null, confirmedHost: null });
  });

  it('refuses an environment name it does not know', () => {
    expect(() => parseTargetFlags(['--target=staging'])).toThrow(DatabaseTargetError);
  });
});
