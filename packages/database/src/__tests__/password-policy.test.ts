import { describe, expect, it } from 'vitest';
import * as argon2 from 'argon2';

import {
  ARGON2_OPTIONS,
  FORBIDDEN_PASSWORDS,
  MINIMUM_PASSWORD_LENGTH,
  assertPasswordAcceptable,
  isLocalDatabase,
} from '../lib/password-policy.js';

/**
 * The staff password policy.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS MODULE IS SHARED BY `db:create-admin` AND `db:rotate-admin-password`,
 * and that is the thing worth testing.
 *
 * Two commands that each carried their own copy of the rule would drift, and
 * always in the same direction: a rotation command that accepts what
 * provisioning refuses is worse than no rotation command, because it looks
 * like it enforced something.
 * ══════════════════════════════════════════════════════════════════════════
 */
describe('password policy', () => {
  it('refuses anything shorter than the minimum', () => {
    expect(() => assertPasswordAcceptable('a'.repeat(MINIMUM_PASSWORD_LENGTH - 1))).toThrow(
      /at least 12 characters/,
    );
  });

  it('accepts exactly the minimum', () => {
    // The boundary, stated: 12 passes, 11 does not.
    expect(() => assertPasswordAcceptable('a'.repeat(MINIMUM_PASSWORD_LENGTH))).not.toThrow();
  });

  it('refuses every known development password', () => {
    for (const forbidden of FORBIDDEN_PASSWORDS) {
      expect(() => assertPasswordAcceptable(forbidden), forbidden).toThrow();
    }
  });

  it('refuses the development password even though it is long enough', () => {
    /*
      `DevPassword123!` is fifteen characters and would pass a length check on
      its own. It is the exact credential this whole cleanup existed to remove
      from a live database, so length is not the control that matters here.
    */
    expect('DevPassword123!'.length).toBeGreaterThan(MINIMUM_PASSWORD_LENGTH);
    expect(() => assertPasswordAcceptable('DevPassword123!')).toThrow(/known development/);
  });

  it('NEVER echoes the rejected password in the error', () => {
    /*
      These commands run in terminals whose scrollback ends up in bug reports.
      An error that quotes the password it just refused defeats the point of
      hiding the input.
    */
    const secret = 'admin';
    try {
      assertPasswordAcceptable(secret);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('accepts an ordinary strong password', () => {
    expect(() => assertPasswordAcceptable('9-Rusted-Kettles-Argue')).not.toThrow();
  });
});

describe('argon2 parameters', () => {
  it('match the application, so a rotated password costs the same to verify', async () => {
    // `argon2.verify` reads parameters back out of the encoded hash, so any
    // hash would verify. Matching them is about cost, which is what the
    // application's tuning was chosen for.
    const hash = await argon2.hash('9-Rusted-Kettles-Argue', ARGON2_OPTIONS);

    expect(hash).toContain('$argon2id$');
    expect(hash).toContain('m=65536');
    expect(hash).toContain('t=3');
    expect(hash).toContain('p=4');
  });

  it('produces a hash the application can verify, and rejects a wrong password', async () => {
    const hash = await argon2.hash('9-Rusted-Kettles-Argue', ARGON2_OPTIONS);

    expect(await argon2.verify(hash, '9-Rusted-Kettles-Argue')).toBe(true);
    expect(await argon2.verify(hash, '9-Rusted-Kettles-Argu')).toBe(false);
  });

  it('salts, so the same password twice gives different hashes', async () => {
    const [first, second] = await Promise.all([
      argon2.hash('9-Rusted-Kettles-Argue', ARGON2_OPTIONS),
      argon2.hash('9-Rusted-Kettles-Argue', ARGON2_OPTIONS),
    ]);

    expect(first).not.toBe(second);
  });
});

describe('local database detection', () => {
  it('recognises the local forms', () => {
    for (const url of [
      'postgres://u:p@localhost:5432/db',
      'postgres://u:p@127.0.0.1:5432/db',
      'postgres://u:p@[::1]:5432/db',
      'postgres://u:p@host.docker.internal:5432/db',
    ]) {
      expect(isLocalDatabase(url), url).toBe(true);
    }
  });

  it('refuses a hosted database', () => {
    // The guard that keeps `db:prepare-e2e` from seeding demo campaigns into
    // a live site, and the E2E suite from minting a Super Admin there.
    expect(
      isLocalDatabase('postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'),
    ).toBe(false);
  });

  it('is not fooled by a hostname that merely contains "localhost"', () => {
    expect(isLocalDatabase('postgres://u:p@localhost.evil.example.com:5432/db')).toBe(false);
  });
});
