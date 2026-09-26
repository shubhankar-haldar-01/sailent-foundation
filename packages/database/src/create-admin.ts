import { config as loadDotenv } from 'dotenv';
import { sql } from 'drizzle-orm';
import * as argon2 from 'argon2';

import { createDatabaseClient } from './client.js';
import { announceConnection } from './announce.js';
import { ROOT_ENV_PATH } from './lib/env-path.js';
import {
  DatabaseTargetError,
  parseTargetFlags,
  resolveDatabaseTarget,
} from './lib/database-target.js';
import {
  ARGON2_OPTIONS,
  DEVELOPMENT_DOMAIN,
  assertPasswordAcceptable,
  closePrompts,
  prompt,
  promptHidden,
} from './lib/password-policy.js';

loadDotenv({ path: ROOT_ENV_PATH });

/**
 * Provision ONE real administrator.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS RATHER THAN THE INVITE ENDPOINT.
 *
 * `POST /admin/users` is the right way to add the second administrator and
 * cannot produce the first. It creates an account in `invited` state with a
 * deliberately unusable password hash, and there is no route to set a real
 * one: no password-set endpoint, no reset endpoint, no invitation-token table.
 * The service comment says delivery "is Phase 4", which never shipped.
 *
 * It also requires `@Sensitive()`, so it needs an already-signed-in
 * administrator — which is the thing that does not exist yet.
 *
 * So the first administrator is provisioned out of band, once, by somebody
 * with database access. That is the normal shape of this problem and it is
 * better than the alternative, which is an HTTP endpoint that can mint a
 * superuser.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE PASSWORD IS NEVER PRINTED, LOGGED, STORED IN A FILE, OR PASSED AS AN
 * ARGUMENT. Command-line arguments are visible in `ps` output and land in
 * shell history; this reads from an interactive prompt with echo suppressed,
 * or from an environment variable for non-interactive use.
 *
 * Hashing is Argon2id with the SAME parameters as the application's
 * `PasswordService`. They are repeated here rather than imported because this
 * package must not depend on the API, and they are asserted against the
 * resulting hash before anything is written.
 */

/*
  The policy, the Argon2id parameters and the hidden prompt all live in
  `lib/password-policy.ts`, shared with `db:rotate-admin-password`. Two copies
  of a password rule drift, and they drift the same way every time: the newer
  command gets the stricter rule and the older one quietly keeps accepting what
  the newer one refuses.
*/

async function main(): Promise<void> {
  /*
    WHICH DATABASE, DECIDED BEFORE ANYTHING ELSE HAPPENS.

    This used to be `DATABASE_MIGRATION_URL || DATABASE_URL`, which silently
    preferred one when they disagreed — and that is how a test run created and
    later rotated a credential on the production database. The resolver refuses
    an ambiguous pair, an undeclared environment, and a production target with
    no typed confirmation. See `lib/database-target.ts`.
  */
  const flags = parseTargetFlags(process.argv.slice(2));
  const target = resolveDatabaseTarget(process.env, {
    command: 'db:create-admin',
    declared: flags.declared,
    confirmedHost: flags.confirmedHost,
  });
  const connectionString = target.connectionString;

  /*
    Environment variables for automation, an interactive prompt otherwise.
    Neither path echoes the password or writes it anywhere.
  */
  const email = (process.env.ADMIN_EMAIL ?? (await prompt('Administrator email: ')))
    .trim()
    .toLowerCase();

  const firstName =
    process.env.ADMIN_FIRST_NAME ?? (await prompt('First name: ')) ?? 'Administrator';
  const lastName = process.env.ADMIN_LAST_NAME ?? '';

  if (!email.includes('@') || email.length < 5) {
    throw new Error('That does not look like an email address.');
  }

  if (email.endsWith(DEVELOPMENT_DOMAIN)) {
    throw new Error(
      `Refusing to create an administrator on ${DEVELOPMENT_DOMAIN}. That domain is reserved for ` +
        'development accounts, which is exactly what this command exists to replace.',
    );
  }

  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden('Password: '));

  assertPasswordAcceptable(password);

  if (!process.env.ADMIN_PASSWORD) {
    const again = await promptHidden('Confirm password: ');
    if (again !== password) throw new Error('The two passwords do not match.');
  }

  closePrompts();

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  // Prove the stored hash actually verifies before writing it. A hash the
  // application cannot check produces an administrator who cannot sign in,
  // discovered at the worst possible moment.
  if (!(await argon2.verify(passwordHash, password))) {
    throw new Error('The generated hash did not verify. Nothing was written.');
  }

  const client = createDatabaseClient({ connectionString });
  const alive = await announceConnection(client, {
    info: (message) => console.log(`[create-admin] ${message}`),
    warn: (message) => console.warn(`[create-admin] ${message}`),
    error: (message) => console.error(`[create-admin] ${message}`),
  });
  if (!alive) throw new Error('Cannot reach the database — see above.');

  try {
    await client.db.transaction(async (tx) => {
      const existing = await tx.execute(sql`
        SELECT id::text AS id FROM users WHERE lower(btrim(email)) = ${email} LIMIT 1
      `);

      if ((existing.rows ?? []).length > 0) {
        throw new Error(
          `An account already exists for that address. This command creates the FIRST ` +
            `administrator and deliberately will not overwrite an existing password — ` +
            `use the admin UI, or reset deliberately with a separate operation.`,
        );
      }

      /*
        `status` defaults to 'invited', which cannot sign in. Set explicitly.
        `email_verified_at` is stamped because the address was chosen by the
        operator out of band rather than proven by a click-through, and leaving
        it null would misrepresent that as an unverified address.

        No TOTP: `totp_secret` stays null and `totp_enabled` false. SUPER_ADMIN
        no longer requires a second factor, and there is no enrolment route to
        give it one.
      */
      const created = await tx.execute(sql`
        INSERT INTO users (email, password_hash, first_name, last_name,
                           status, email_verified_at, totp_enabled, must_change_password)
        VALUES (${email}, ${passwordHash}, ${firstName || 'Administrator'},
                ${lastName || null}, 'active', now(), false, false)
        RETURNING id::text AS id
      `);

      const userId = (created.rows ?? [])[0]?.id as string | undefined;
      if (!userId) throw new Error('The account was not created.');

      const role = await tx.execute(
        sql`SELECT id::text AS id FROM roles WHERE key = 'SUPER_ADMIN'`,
      );
      const roleId = (role.rows ?? [])[0]?.id as string | undefined;
      if (!roleId) {
        throw new Error(
          'No SUPER_ADMIN role exists. Run `pnpm --filter @sailent/database db:seed --reference` first.',
        );
      }

      // The existing relationship, unchanged. No new role is created.
      await tx.execute(sql`
        INSERT INTO user_roles (user_id, role_id) VALUES (${userId}::uuid, ${roleId}::uuid)
      `);

      await tx.execute(sql`
        INSERT INTO audit_logs (actor_type, user_id, actor_email_snapshot, action,
                                entity_type, entity_id, severity, reason)
        VALUES ('system', ${userId}::uuid, ${email}, 'user.provisioned',
                'user', ${userId}::uuid, 'warning',
                'First administrator provisioned out of band via db:create-admin')
      `);
    });

    // Identity only. No password, no hash, no token.
    console.log(`\n[create-admin] Created ${email} as SUPER_ADMIN, active, no second factor.`);
    console.log(
      '[create-admin] Sign in at /admin/login with that address and the password you set.',
    );
    console.log(
      '[create-admin] The password was not printed, logged or stored anywhere by this command.\n',
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  // A refusal is guidance, not a stack trace: it names what was wrong and what
  // to type instead.
  if (error instanceof DatabaseTargetError) {
    console.error(`\n[create-admin] REFUSED\n${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  console.error('[create-admin] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
