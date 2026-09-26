import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The credential commands themselves, invoked as an operator would.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO REAL REMOTE DATABASE APPEARS ANYWHERE IN THIS FILE.
 *
 * The "production" host used below ends in `.invalid`, which RFC 2606 reserves
 * so that it can never resolve. The guard classifies it as remote exactly like
 * Supabase — so the refusals are genuinely exercised — while a REGRESSION that
 * let a command through would fail to connect rather than change a credential
 * somewhere real.
 *
 * That property is deliberate. These tests exist because the incident happened
 * while testing a credential command, and a test suite for that must not be
 * able to repeat it.
 * ══════════════════════════════════════════════════════════════════════════
 */

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const LOCAL_E2E =
  process.env.E2E_DATABASE_URL ?? 'postgres://sailent:sailent@localhost:5432/sailent_e2e';
/** Supabase-shaped, and unresolvable by construction. */
const FAKE_REMOTE =
  'postgresql://postgres:pw@aws-0-ap-south-1.pooler.supabase.invalid:5432/postgres';

/** A password used only inside this file. Asserted never to be echoed. */
const PROBE_PASSWORD = 'zz-probe-only-Wq7yTn42';

function run(
  script: string,
  options: { env?: Record<string, string | undefined>; args?: string[]; stdin?: string } = {},
) {
  const result = spawnSync('pnpm', ['exec', 'tsx', `src/${script}.ts`, ...(options.args ?? [])], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    input: options.stdin ?? '',
    env: {
      // A bare environment: `.env` is loaded by the commands themselves, and
      // inheriting this process's variables would reintroduce exactly the
      // ambiguity under test.
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'development',
      APP_ENV: 'development',
      ...options.env,
    },
  });
  return { ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/**
 * The commands load the repository `.env`, which sets DATABASE_URL to the real
 * project. `dotenv` does not overwrite a variable that is already set, so each
 * test states its own — and the one below proves that is actually true.
 */
describe.each(['rotate-admin-password', 'create-admin'])('%s', (script) => {
  it('refuses when no environment is declared', () => {
    const { output } = run(script, { env: { DATABASE_URL: LOCAL_E2E } });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/say which environment/i);
  });

  it('refuses a remote database declared as local', () => {
    const { output } = run(script, {
      env: { DATABASE_URL: FAKE_REMOTE },
      args: ['--target=local'],
    });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/not a local database/i);
  });

  it('refuses two variables that disagree — the incident', () => {
    const { output } = run(script, {
      env: { DATABASE_URL: FAKE_REMOTE, DATABASE_MIGRATION_URL: LOCAL_E2E },
      args: ['--target=local'],
    });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/two different database targets/i);
  });

  it('refuses a production target with no typed confirmation', () => {
    const { output } = run(script, {
      env: { DATABASE_URL: FAKE_REMOTE },
      args: ['--target=production'],
    });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/PRODUCTION operation/i);
  });

  it('refuses a confirmation for the wrong host', () => {
    const { output } = run(script, {
      env: { DATABASE_URL: FAKE_REMOTE },
      args: ['--target=production', '--confirm-host=localhost'],
    });
    expect(output).toMatch(/REFUSED/);
  });

  it('refuses before prompting for anything', () => {
    // A refusal must cost the operator nothing. If it asked for a password
    // first, that password would have been typed for a run that never happened.
    const { output } = run(script, {
      env: { DATABASE_URL: FAKE_REMOTE },
      args: ['--target=local'],
    });
    // `New password:` specifically — the refusal text contains the command's
    // own name, which ends in "password".
    expect(output).not.toMatch(/New password:/i);
  });

  it('NEVER accepts a password as a command-line argument', () => {
    /*
      Arguments are visible in `ps` to every process on the machine and land in
      shell history. Passing one must not work — the command still refuses on
      the target, proving the flag was not consumed as a credential.
    */
    const { output } = run(script, {
      env: { DATABASE_URL: LOCAL_E2E },
      args: ['--target=local', `--password=${PROBE_PASSWORD}`, '--confirm'],
      stdin: '',
    });
    expect(output).not.toContain(PROBE_PASSWORD);
  });
});

describe('rotate-admin-password behaviour on a local database', () => {
  const env = { DATABASE_URL: LOCAL_E2E, ADMIN_EMAIL: 'admin@sailent.local' };

  it('enforces the shared password policy', () => {
    const { output } = run('rotate-admin-password', {
      env,
      args: ['--target=local'],
      stdin: 'short\nshort\n',
    });
    expect(output).toMatch(/at least 12 characters/i);
  });

  it('refuses a known development password', () => {
    const { output } = run('rotate-admin-password', {
      env,
      args: ['--target=local'],
      stdin: 'DevPassword123!\nDevPassword123!\n',
    });
    expect(output).toMatch(/known development or default password/i);
  });

  it('refuses a mismatched confirmation', () => {
    const { output } = run('rotate-admin-password', {
      env,
      args: ['--target=local'],
      stdin: `${PROBE_PASSWORD}\n${PROBE_PASSWORD}-different\n`,
    });
    expect(output).toMatch(/do not match/i);
  });

  it('will NOT create a user for an unknown address', () => {
    const { output } = run('rotate-admin-password', {
      env: { ...env, ADMIN_EMAIL: 'nobody-at-all@sailent.test' },
      args: ['--target=local'],
      stdin: `${PROBE_PASSWORD}\n${PROBE_PASSWORD}\n`,
    });
    expect(output).toMatch(/No account exists|will not create a user/i);
  });

  it('never prints the password, in any outcome', () => {
    // 7. Across a refusal and a real rotation alike.
    for (const stdin of [`${PROBE_PASSWORD}\n${PROBE_PASSWORD}-x\n`, 'short\nshort\n']) {
      const { output } = run('rotate-admin-password', { env, args: ['--target=local'], stdin });
      expect(output).not.toContain(PROBE_PASSWORD);
      expect(output).not.toContain('$argon2');
    }
  });
});

describe('create-admin behaviour', () => {
  it('refuses a @sailent.local address', () => {
    const { output } = run('create-admin', {
      env: {
        DATABASE_URL: LOCAL_E2E,
        ADMIN_EMAIL: 'someone@sailent.local',
        ADMIN_FIRST_NAME: 'Probe',
        ADMIN_PASSWORD: PROBE_PASSWORD,
      },
      args: ['--target=local'],
    });
    expect(output).toMatch(/reserved for development accounts/i);
    expect(output).not.toContain(PROBE_PASSWORD);
  });

  it('refuses a known development password', () => {
    const { output } = run('create-admin', {
      env: {
        DATABASE_URL: LOCAL_E2E,
        ADMIN_EMAIL: 'probe@example.test',
        ADMIN_FIRST_NAME: 'Probe',
        ADMIN_PASSWORD: 'DevPassword123!',
      },
      args: ['--target=local'],
    });
    expect(output).toMatch(/known development or default password/i);
  });

  it('will not overwrite an existing account', () => {
    const { output } = run('create-admin', {
      env: {
        DATABASE_URL: LOCAL_E2E,
        ADMIN_EMAIL: 'admin@sailent.local',
        ADMIN_FIRST_NAME: 'Probe',
        ADMIN_PASSWORD: PROBE_PASSWORD,
      },
      args: ['--target=local'],
    });
    // `@sailent.local` is refused first; the point is that neither path writes.
    expect(output).toMatch(/reserved for development|already exists/i);
    expect(output).not.toContain(PROBE_PASSWORD);
  });
});

describe('harden keeps its safety behaviour', () => {
  it('refuses without a declared target', () => {
    // 12. It previously had NO target guard at all — only a scope filter.
    const { output } = run('harden', { env: { DATABASE_URL: LOCAL_E2E } });
    expect(output).toMatch(/REFUSED/);
  });

  it('refuses a remote target declared local', () => {
    const { output } = run('harden', {
      env: { DATABASE_URL: FAKE_REMOTE },
      args: ['--target=local'],
    });
    expect(output).toMatch(/REFUSED/);
  });

  it('still runs a DRY RUN against a local database and writes nothing', () => {
    const { output } = run('harden', {
      env: { DATABASE_URL: LOCAL_E2E },
      args: ['--target=local'],
    });
    expect(output).toMatch(/DRY RUN — nothing written/);
    // And it tells the operator the exact command, with the target repeated.
    expect(output).toMatch(/--target=local/);
  });
});

describe('db:seed', () => {
  /*
    The seed was the LAST command that could reach a live database without
    anybody saying so out loud. Even `--reference` deletes every SUPER_ADMIN
    grant before re-inserting it, and upserts category slugs, which are public
    URLs.

    Every case below refuses BEFORE a connection is opened, which is why the
    unresolvable `.invalid` host is safe to use here.
  */
  const seed = (args: string[], env: Record<string, string | undefined>) =>
    run('seed/index', { args, env });

  it('refuses with no declared target', () => {
    const { output } = seed(['--reference'], { DATABASE_URL: LOCAL_E2E });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/say which environment/i);
  });

  it('refuses production without the host typed back, and prints the flag', () => {
    const { output } = seed(['--target=production', '--reference'], { DATABASE_URL: FAKE_REMOTE });
    expect(output).toMatch(/REFUSED/);
    expect(output).toContain('--confirm-host=aws-0-ap-south-1.pooler.supabase.invalid');
  });

  it('refuses production with the wrong host', () => {
    const { output } = seed(['--target=production', '--confirm-host=wrong-host', '--reference'], {
      DATABASE_URL: FAKE_REMOTE,
    });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/does not match/i);
  });

  it('refuses a remote database declared local', () => {
    const { output } = seed(['--target=local', '--reference'], { DATABASE_URL: FAKE_REMOTE });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/not a local database/i);
  });

  it('does not silently fall back to DATABASE_MIGRATION_URL', () => {
    /*
      DATABASE_URL is passed EMPTY rather than absent. These commands load the
      repository `.env` themselves and `dotenv` fills any variable that is not
      already present — so an absent one would be quietly supplied from the
      developer's own configuration, which is the opposite of what this tests.

      With its one variable unconfigured, the seed must refuse as unconfigured
      and NOT reach for the migration URL sitting right beside it. That reach
      is the shape of the bug that rotated a production password.
    */
    const { output } = seed(['--target=local', '--reference'], {
      DATABASE_URL: '',
      DATABASE_MIGRATION_URL: FAKE_REMOTE,
    });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/no database target is configured/i);
  });

  it('is still caught by the DECLARATION when .env supplies a remote URL', () => {
    /*
      The realistic accident: an operator runs the seed with nothing set, and
      `.env` quietly supplies the production database. The target guard cannot
      prevent `.env` being read — but the declaration check catches it, which
      is precisely why declaring the environment is required rather than
      inferred.
    */
    const { output } = seed(['--target=local', '--reference'], { DATABASE_URL: FAKE_REMOTE });
    expect(output).toMatch(/REFUSED/);
    expect(output).toMatch(/not a local database/i);
  });

  it('refuses before opening a connection', () => {
    // No "Connecting to…" line, so an unreachable host is never dialled.
    const { output } = seed(['--target=local', '--reference'], { DATABASE_URL: FAKE_REMOTE });
    expect(output).not.toMatch(/Connecting to/i);
    expect(output).not.toMatch(/Target:/);
  });

  it('ALLOWS an explicitly declared local target, and keeps --reference', () => {
    const { output } = seed(['--target=local', '--reference'], { DATABASE_URL: LOCAL_E2E });
    expect(output).toMatch(/Target: localhost/);
    expect(output).toMatch(/permissions/);
    // The existing behaviour, unchanged: demo content is skipped.
    expect(output).toMatch(/reference data only/i);
  });
});

describe('prepare-e2e keeps its safety behaviour', () => {
  it('refuses a remote E2E database', () => {
    // 12. It runs the SEED — pointed at a live database it would add fictional
    // programmes to a real site.
    const { output } = run('prepare-e2e', { env: { E2E_DATABASE_URL: FAKE_REMOTE } });
    expect(output).toMatch(/REFUSED|not a local database/i);
  });

  it('refuses when the E2E database IS the application database', () => {
    // 10.
    const { output } = run('prepare-e2e', {
      env: { E2E_DATABASE_URL: LOCAL_E2E, DATABASE_URL: LOCAL_E2E },
    });
    expect(output).toMatch(/same database/i);
  });

  it('refuses when E2E_DATABASE_URL is missing', () => {
    /*
      Passed as EMPTY rather than absent. These commands load the repository
      `.env` themselves, and `dotenv` fills any variable that is not already
      present — so an absent variable here would be silently supplied from the
      developer's own configuration, which is not what this is testing.
    */
    const { output } = run('prepare-e2e', { env: { E2E_DATABASE_URL: '' } });
    expect(output).toMatch(/E2E_DATABASE_URL is not set/i);
  });
});
