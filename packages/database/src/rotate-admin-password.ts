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
  assertPasswordAcceptable,
  closePrompts,
  prompt,
  promptHidden,
} from './lib/password-policy.js';

loadDotenv({ path: ROOT_ENV_PATH });

/**
 * Rotate one staff account's password. Nothing else.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS.
 *
 * The application has no password-change mechanism at all. `updateUserSchema`
 * accepts a name and a phone number; `UsersService` writes `password_hash`
 * exactly once, at invite, with a random unusable value; there is no reset
 * route, no change route, and `must_change_password` is written but never read.
 * The only two password inputs in the whole product — the login form and the
 * re-authentication panel — both VERIFY a password and neither can change one.
 *
 * So an exposed administrator credential could not be replaced except by hand.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * DELIBERATELY NARROW. It changes `password_hash` and revokes sessions. It
 * does not touch the email, the role, the status, permissions, TOTP columns,
 * donors, volunteers, or any existing audit row. It cannot create a user: an
 * address with no account is an error, not an invitation — otherwise a typo in
 * an email would silently mint a second administrator, which is exactly the
 * situation this whole exercise has been unwinding.
 *
 * The password is read from a hidden prompt, twice, and is never accepted as a
 * command-line argument. Arguments are visible in `ps` to every other process
 * on the machine and land in shell history.
 */
async function main(): Promise<void> {
  /*
    THE GUARD THAT WAS MISSING, AND THE REASON THIS FILE HAS AN INCIDENT
    ATTACHED TO IT.

    `DATABASE_MIGRATION_URL || DATABASE_URL` picked the wrong one during a test
    and rotated the production administrator's password to a value nobody had
    recorded. It is resolved first, before a single prompt is shown, so a
    refusal costs the operator nothing but a re-run.
  */
  const flags = parseTargetFlags(process.argv.slice(2));
  const target = resolveDatabaseTarget(process.env, {
    command: 'db:rotate-admin-password',
    declared: flags.declared,
    confirmedHost: flags.confirmedHost,
  });
  const connectionString = target.connectionString;

  console.log(
    `[rotate] Target: ${target.host}/${target.database} (${target.kind}, from ${target.source}).`,
  );

  const email = (process.env.ADMIN_EMAIL ?? (await prompt('Administrator email: ')))
    .trim()
    .toLowerCase();

  if (!email.includes('@')) throw new Error('That does not look like an email address.');

  const password = await promptHidden('New password: ');
  const confirmation = await promptHidden('Confirm new password: ');

  if (password !== confirmation) {
    throw new Error('The two passwords do not match. Nothing was changed.');
  }

  closePrompts();

  assertPasswordAcceptable(password);

  const client = createDatabaseClient({ connectionString });
  const alive = await announceConnection(client, {
    info: (message) => console.log(`[rotate] ${message}`),
    warn: (message) => console.warn(`[rotate] ${message}`),
    error: (message) => console.error(`[rotate] ${message}`),
  });
  if (!alive) throw new Error('Cannot reach the database — see above.');

  try {
    const found = await client.db.execute(sql`
      SELECT id::text AS id, password_hash, status::text AS status
        FROM users WHERE lower(btrim(email)) = ${email} LIMIT 1
    `);

    const user = (found.rows ?? [])[0] as
      { id: string; password_hash: string | null; status: string } | undefined;

    if (!user) {
      // NOT an invitation. See the note above about typos minting admins.
      throw new Error(
        `No account exists for that address. This command rotates an EXISTING password ` +
          `and will not create a user. Check the address, or use db:create-admin.`,
      );
    }

    /*
      REFUSE A ROTATION TO THE SAME PASSWORD.

      The reason anybody runs this is that the current password is no longer
      trusted. Re-setting the same value succeeds, prints a success line, and
      changes nothing — the worst possible outcome, because the operator walks
      away believing the exposure is closed.
    */
    if (user.password_hash && (await argon2.verify(user.password_hash, password))) {
      throw new Error(
        'That is the password the account already has. Rotating to the same value would ' +
          'leave the exposure open while looking like it had been closed. Nothing was changed.',
      );
    }

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

    // Prove the new hash verifies before storing it. A hash the application
    // cannot check locks the administrator out, discovered at the worst moment.
    if (!(await argon2.verify(passwordHash, password))) {
      throw new Error('The generated hash did not verify. Nothing was changed.');
    }

    const revoked = await client.db.transaction(async (tx) => {
      /*
        Only these columns.

        `status`, `totp_secret`, `totp_enabled`, the email and the role are all
        untouched, and the lockout counters are cleared because an account
        locked out by the attempts that prompted this rotation should not stay
        locked after its password has changed.
      */
      await tx.execute(sql`
        UPDATE users
           SET password_hash = ${passwordHash},
               failed_login_count = 0,
               locked_until = NULL,
               updated_at = now()
         WHERE id = ${user.id}::uuid
      `);

      /*
        Revoke every live session AFTER the change, in the same transaction.

        A rotation that leaves existing sessions alive has not taken anything
        away: whoever holds one keeps full access for the life of their refresh
        token, and the exposed password is not what they are using any more.
      */
      const result = await tx.execute(sql`
        UPDATE sessions
           SET revoked_at = now(), revoked_reason = 'password_rotated'
         WHERE user_id = ${user.id}::uuid AND revoked_at IS NULL
      `);

      // An APPEND to the audit log. No existing row is read, altered or removed.
      await tx.execute(sql`
        INSERT INTO audit_logs (actor_type, user_id, actor_email_snapshot, action,
                                entity_type, entity_id, severity, reason)
        VALUES ('system', ${user.id}::uuid, ${email}, 'user.password_rotated',
                'user', ${user.id}::uuid, 'warning',
                'Password rotated out of band via db:rotate-admin-password')
      `);

      return result.rowCount ?? 0;
    });

    // Identity and counts only. No password, no hash, no token.
    console.log(`\n[rotate] Password changed for ${email}.`);
    console.log(`[rotate] ${revoked} live session(s) revoked — they must sign in again.`);
    console.log('[rotate] Role, status and second-factor settings are unchanged.');
    console.log(
      '[rotate] Nothing about the password was printed, logged or stored by this command.\n',
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof DatabaseTargetError) {
    console.error(`\n[rotate] REFUSED\n${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  console.error('[rotate] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
