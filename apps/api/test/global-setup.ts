import * as argon2 from 'argon2';
import { sql } from 'drizzle-orm';

import { loadRootEnvFile } from '@sailent/config/dotenv';
import { createDatabaseClient } from '@sailent/database';

import { TEST_PASSWORD, TEST_USERS } from './fixtures.js';

/**
 * Create the suites' staff fixtures ONCE, before any spec file runs.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS WAS PER-APP AND IT DID NOT WORK.
 *
 * The first version provisioned these accounts inside `createTestApp()`, which
 * runs once per spec file. Twenty-five files run in parallel, so twenty-five
 * workers issued `UPDATE users … WHERE email = …` against the SAME two rows at
 * the same moment, and spent their time waiting on each other's row locks —
 * five spec files failed on unrelated assertions, because what actually ran
 * out was time.
 *
 * It also hashed the same password twenty-five times. Argon2id is deliberately
 * ~100ms, so that alone was two and a half seconds of pure duplication.
 *
 * Once, here, before anything else starts. The suites then only sign in.
 * ══════════════════════════════════════════════════════════════════════════
 */

loadRootEnvFile();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  raw: false,
} as const;

export default async function setup(): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) return;

  /*
    The same refusal `harness.ts` makes, repeated because this runs FIRST and
    would otherwise write staff accounts into a remote database before that
    check ever executed.
  */
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(
    connectionString,
  );
  if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
    throw new Error(
      'Refusing to create test accounts in a non-local database.\n' +
        'Set TEST_DATABASE_URL to a local database, or ALLOW_REMOTE_TEST_DB=true for a disposable CI one.',
    );
  }

  const passwordHash = await argon2.hash(TEST_PASSWORD, ARGON2_OPTIONS);
  // `@sailent/database`'s own client, not a raw `pg` one: `pg` is not a direct
  // dependency of this app, and reaching past the package that owns the
  // connection would mean two places that know how to build one.
  const client = createDatabaseClient({ connectionString, maxConnections: 1 });

  try {
    for (const email of Object.values(TEST_USERS)) {
      await client.db.execute(sql`
        INSERT INTO users (email, password_hash, first_name, last_name,
                           status, email_verified_at, totp_enabled)
             VALUES (${email}, ${passwordHash}, 'Test', 'Staff', 'active', now(), false)
        ON CONFLICT DO NOTHING
      `);

      /*
        Applied unconditionally, not only on insert. A suite that failed
        halfway, or a database built by an older revision of this file,
        otherwise leaves an account whose password nobody knows — and every
        later run fails on a sign-in that looks like a code defect.

        It also clears a lockout, which the rate-limit suite can legitimately
        leave behind after deliberately spraying wrong passwords.
      */
      await client.db.execute(sql`
        UPDATE users
           SET password_hash = ${passwordHash}, status = 'active', totp_enabled = false,
               totp_secret = NULL, failed_login_count = 0, locked_until = NULL
         WHERE lower(btrim(email)) = ${email}
      `);

      await client.db.execute(sql`
        INSERT INTO user_roles (user_id, role_id)
             SELECT u.id, r.id FROM users u, roles r
              WHERE lower(btrim(u.email)) = ${email} AND r.key = 'SUPER_ADMIN'
                AND NOT EXISTS (SELECT 1 FROM user_roles ur
                                 WHERE ur.user_id = u.id AND ur.role_id = r.id)
      `);
    }
  } finally {
    await client.close();
  }
}
