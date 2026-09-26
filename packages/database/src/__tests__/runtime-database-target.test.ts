import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  DatabaseTargetError,
  LOCAL_DATABASES,
  PRODUCTION_DATABASE_HOST,
  assertRuntimeDatabaseTarget,
  describeRuntimeTarget,
} from '../lib/database-target.js';

/**
 * Does `APP_ENV` agree with the database it is about to open?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO DATABASE IS INVOLVED IN ANY OF THIS, as with the command guard beside it.
 * The check is a pure function over a connection string and an environment
 * name, so the production cases can be tested without a production database
 * anywhere near them — which is the only honest way to test a rule whose whole
 * purpose is to keep processes away from production.
 *
 * WHAT HAPPENED. A local `.env` held the production Supabase URL while
 * `APP_ENV=development`. Neither value was wrong on its own; nothing looked
 * wrong at boot. The API started, served, and wrote to production — a draft
 * written in a local admin UI landed in the live database. Only the PAIRING
 * was the fault, and only something that sees both values can catch it.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** A password that must never appear in any message these tests provoke. */
const PASSWORD = 'sup3r-s3cret-pa55word';

const LOCAL_DEV = `postgresql://sailent@localhost:5432/sailent_dev`;
const LOCAL_E2E = `postgres://sailent:${PASSWORD}@localhost:5432/sailent_e2e`;
const LOCAL_TEST = `postgres://sailent:${PASSWORD}@127.0.0.1:5432/sailent_test`;
const PRODUCTION = `postgresql://postgres.ygylzcak:${PASSWORD}@${PRODUCTION_DATABASE_HOST}:5432/postgres`;
const OTHER_REMOTE = `postgres://user:${PASSWORD}@db.some-other-host.example.com:5432/app`;
const PRODUCTION_HOST_DEV_DB = `postgres://postgres:${PASSWORD}@${PRODUCTION_DATABASE_HOST}:5432/sailent_dev`;

const check = (appEnv: string, connectionString: string) =>
  assertRuntimeDatabaseTarget({ appEnv, connectionString });

describe('runtime database target — what each environment may open', () => {
  // ---- 1, 8: the allowed local pairings ---------------------------------
  it('ALLOWS development against localhost/sailent_dev', () => {
    const target = check('development', LOCAL_DEV);
    expect(target.kind).toBe('local');
    expect(target.host).toBe('localhost');
    expect(target.database).toBe('sailent_dev');
  });

  it('ALLOWS the E2E database under development, because that IS the isolation', () => {
    /*
      `playwright.config.ts` starts the API with `APP_ENV=development` pointed
      at `sailent_e2e`. A rule that admitted only `sailent_dev` would be
      "stricter" and would break the entire browser suite.
    */
    expect(check('development', LOCAL_E2E).database).toBe('sailent_e2e');
  });

  it('ALLOWS the test environment against a local test database', () => {
    expect(check('test', LOCAL_TEST).database).toBe('sailent_test');
  });

  // ---- 2, 3, 7: non-production may not leave the machine ------------------
  it('REFUSES development against the production database', () => {
    expect(() => check('development', PRODUCTION)).toThrow(DatabaseTargetError);
    expect(() => check('development', PRODUCTION)).toThrow(/cannot connect to a remote database/);
  });

  it('REFUSES development against an arbitrary remote host', () => {
    // Not a production allowlist — anything off the machine is refused, so a
    // staging or a colleague's database cannot be reached by accident either.
    expect(() => check('development', OTHER_REMOTE)).toThrow(/cannot connect to a remote database/);
  });

  it('REFUSES the test environment against production', () => {
    expect(() => check('test', PRODUCTION)).toThrow(DatabaseTargetError);
  });

  it('REFUSES a local database this project does not use', () => {
    expect(() => check('development', 'postgres://sailent@localhost:5432/postgres')).toThrow(
      /not one of this project's local databases/,
    );
  });

  // ---- 4, 5, 6: production ----------------------------------------------
  it('ALLOWS production against the approved production host', () => {
    const target = check('production', PRODUCTION);
    expect(target.kind).toBe('remote');
    expect(target.host).toBe(PRODUCTION_DATABASE_HOST);
  });

  it('REFUSES production against localhost', () => {
    expect(() => check('production', LOCAL_DEV)).toThrow(/cannot connect to a local database/);
  });

  it('REFUSES production against a development database, even on the right host', () => {
    expect(() => check('production', PRODUCTION_HOST_DEV_DB)).toThrow(
      /is a development database and cannot be used in production/,
    );
  });

  it('REFUSES production against a host that is not the approved one', () => {
    expect(() => check('production', OTHER_REMOTE)).toThrow(
      /is not the approved production database host/,
    );
  });

  // ---- staging -----------------------------------------------------------
  it('REFUSES staging against the production database', () => {
    // The same mistake wearing a different label.
    expect(() => check('staging', PRODUCTION)).toThrow(/cannot connect to the production database/);
  });

  it('REFUSES staging against localhost', () => {
    expect(() => check('staging', LOCAL_DEV)).toThrow(/cannot connect to a local database/);
  });

  it('REFUSES an environment name it does not recognise', () => {
    // Fail closed: a typo in APP_ENV must not fall through to "allow".
    expect(() => check('prod', PRODUCTION)).toThrow(/is not a recognised environment/);
    expect(() => check('', LOCAL_DEV)).toThrow(/is not a recognised environment/);
  });
});

// ---- 9, 10: secrets never reach a message ---------------------------------
describe('runtime database target — what the messages may contain', () => {
  const refusals: [string, string][] = [
    ['development', PRODUCTION],
    ['development', OTHER_REMOTE],
    ['test', PRODUCTION],
    ['production', LOCAL_DEV],
    ['production', OTHER_REMOTE],
    ['production', PRODUCTION_HOST_DEV_DB],
    ['staging', PRODUCTION],
  ];

  it.each(refusals)('never prints the password (%s)', (appEnv, connectionString) => {
    let message = '';
    try {
      check(appEnv, connectionString);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain(PASSWORD);
  });

  it.each(refusals)('never prints the connection string (%s)', (appEnv, connectionString) => {
    let message = '';
    try {
      check(appEnv, connectionString);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toContain(connectionString);
    // Nor the user-info half of it, which is where a password would hide.
    expect(message).not.toContain('@');
    expect(message).not.toContain('postgres://');
    expect(message).not.toContain('postgresql://');
  });

  it('says enough to act on: host, database and environment', () => {
    let message = '';
    try {
      check('development', PRODUCTION);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(PRODUCTION_DATABASE_HOST);
    expect(message).toContain('postgres');
    expect(message).toContain('development');
    // And which variable to edit.
    expect(message).toContain('DATABASE_URL');
  });

  it('describeRuntimeTarget carries no credential either', () => {
    const target = assertRuntimeDatabaseTarget({
      appEnv: 'production',
      connectionString: PRODUCTION,
    });
    const described = describeRuntimeTarget(target, 'production');

    expect(described).toContain(PRODUCTION_DATABASE_HOST);
    expect(described).not.toContain(PASSWORD);
    expect(described).not.toContain('@');
  });
});

// ---- 11, 12: TLS and the Supabase CA ---------------------------------------
describe('TLS, and where the Supabase certificate applies', () => {
  it('does not require DATABASE_CA_CERT for a local database', () => {
    /*
      `createDatabaseClient` sets `ssl: false` for a local connection, so
      `loadCaCert` is never reached — the certificate is a property of the
      hosted provider, not of the application. Asserted on the source so the
      ordering cannot be inverted without this failing: a `ca:` read that moved
      OUT of the TLS branch would make local development depend on a production
      certificate file.
    */
    const client = readFileSync(new URL('../client.ts', import.meta.url), 'utf8');
    const tlsBranch = client.slice(client.indexOf('ssl: requiresTls(connection)'));

    expect(tlsBranch.indexOf('ca: loadCaCert(options)')).toBeGreaterThan(-1);
    expect(tlsBranch.indexOf('ca: loadCaCert(options)')).toBeLessThan(tlsBranch.indexOf(': false'));
  });

  it('keeps full certificate verification for a hosted database', () => {
    // `rejectUnauthorized` must stay on unless insecure TLS is asked for
    // explicitly. `sslmode=require` encrypts without verifying, which is the
    // setting that looks secure and is not.
    const client = readFileSync(new URL('../client.ts', import.meta.url), 'utf8');

    expect(client).toContain('rejectUnauthorized: options.insecureTls !== true');
    expect(client).not.toContain('rejectUnauthorized: false');
  });
});

describe('the local database allowlist', () => {
  it('names exactly the three databases this project uses', () => {
    // Pinned so a fourth cannot be added without a decision.
    expect([...LOCAL_DATABASES]).toEqual(['sailent_dev', 'sailent_e2e', 'sailent_test']);
  });
});
