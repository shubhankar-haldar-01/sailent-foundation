import { config as loadDotenv } from 'dotenv';
import { sql } from 'drizzle-orm';

import { createDatabaseClient } from './client.js';
import { announceConnection } from './announce.js';
import { ROOT_ENV_PATH } from './lib/env-path.js';
import {
  DatabaseTargetError,
  parseTargetFlags,
  resolveDatabaseTarget,
} from './lib/database-target.js';

loadDotenv({ path: ROOT_ENV_PATH });

/**
 * Neutralise development credentials on a database that is going live.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE PROBLEM THIS SOLVES.
 *
 * The development seed creates staff accounts on `@sailent.local` with a
 * password printed in `docs/database-development.md` and a TOTP secret that is
 * the RFC 6238 test vector — published in the RFC itself. That is correct for
 * development and catastrophic anywhere else.
 *
 * `assertDemoSeedAllowed()` in the seed already refuses to CREATE them in
 * production. It does nothing about rows that are already there, which is the
 * situation any project promoted from its development database is in: the
 * guard never runs again, and six full administrators ship with the data.
 *
 * Phase 8 made that worse without touching it. Collapsing the five staff roles
 * into one means every surviving account holds all 94 permissions — donor
 * export and the audit log included — where before most held a subset.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * IT NEUTRALISES, IT DOES NOT DELETE.
 *
 * Deleting is tempting and wrong. These rows are referenced as `approved_by`,
 * `verified_by`, `issued_by`, `reviewed_by` and a dozen more. Every one of
 * those is `ON DELETE SET NULL`, so a delete succeeds — and silently rewrites
 * history into "approved by nobody". `audit_logs` has no foreign key at all
 * and keeps an `actor_email_snapshot`, so the log survives either way, but the
 * operational tables do not.
 *
 * So the account stays, attribution stays, and what goes is the ability to
 * sign in: status suspended, TOTP secret cleared, password hash replaced with
 * a value no password can produce, live sessions revoked.
 *
 * DRY RUN BY DEFAULT. Pass `--confirm` to write. Nothing is printed that could
 * help anybody sign in — no hashes, no secrets, no passwords.
 */

/**
 * Addresses that cannot belong to a real person.
 *
 * `.local` is reserved for multicast DNS (RFC 6762 §3). Mail to it cannot be
 * routed, so nobody can own such an address, so no legitimate production user
 * can have one. That makes the domain a safe and honest selector — much safer
 * than matching on a password hash, which would mean holding the development
 * password in this file.
 */
const DEVELOPMENT_DOMAIN = '@sailent.local';

/**
 * A password hash no password verifies against.
 *
 * Argon2 verification parses this, fails to match, and returns false — the
 * same answer a wrong password gets. Setting the column NULL would be worse:
 * code paths that treat a missing hash as "this account uses another method"
 * are exactly the kind of thing that turns a disabled account into an open one.
 */
const UNUSABLE_PASSWORD =
  '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$disabled-by-db-harden';

interface Candidate {
  id: string;
  email: string;
  status: string;
  totp_enabled: boolean;
  roles: string | null;
  audit_rows: number;
  live_sessions: number;
}

async function main(): Promise<void> {
  /*
    THIS COMMAND HAD NO TARGET GUARD AT ALL.

    It had a SCOPE guard — it only ever touches `@sailent.local` accounts — and
    that was mistaken for a safety guard. The two are different: scope limits
    WHAT is changed, and says nothing about WHERE. Suspending six accounts in
    the wrong database is still suspending six accounts in the wrong database.

    Hardening is a production operation by design, so `--target=production` is
    the expected invocation; the point is that it must be typed, not inherited.
  */
  const flags = parseTargetFlags(process.argv.slice(2));
  const target = resolveDatabaseTarget(process.env, {
    command: 'db:harden',
    declared: flags.declared,
    confirmedHost: flags.confirmedHost,
  });
  const connectionString = target.connectionString;

  const confirm = process.argv.includes('--confirm');
  const client = createDatabaseClient({ connectionString });
  const alive = await announceConnection(client, {
    info: (message) => console.log(`[harden] ${message}`),
    warn: (message) => console.warn(`[harden] ${message}`),
    error: (message) => console.error(`[harden] ${message}`),
  });
  if (!alive) throw new Error('Cannot reach the database — see above.');

  try {
    const found = await client.db.execute(sql`
      SELECT u.id::text AS id,
             u.email,
             u.status::text AS status,
             u.totp_enabled,
             (SELECT string_agg(r.key, ', ')
                FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.id) AS roles,
             (SELECT count(*) FROM audit_logs a WHERE a.user_id = u.id) AS audit_rows,
             (SELECT count(*) FROM sessions s
               WHERE s.user_id = u.id AND s.revoked_at IS NULL) AS live_sessions
        FROM users u
       WHERE lower(u.email) LIKE ${'%' + DEVELOPMENT_DOMAIN}
       ORDER BY u.email
    `);

    const candidates = (found.rows ?? []) as unknown as Candidate[];

    if (candidates.length === 0) {
      console.log('[harden] No accounts on ' + DEVELOPMENT_DOMAIN + '. Nothing to do.');
      return;
    }

    console.log(`\n[harden] ${candidates.length} development account(s) found:\n`);
    for (const row of candidates) {
      console.log(
        `  ${row.email.padEnd(30)} status=${row.status.padEnd(10)} ` +
          `roles=${(row.roles ?? 'none').padEnd(12)} ` +
          `audit_rows=${row.audit_rows}  live_sessions=${row.live_sessions}`,
      );
    }

    /*
      The count is the point of printing it. Every one of these rows can sign
      in with a password that is in the documentation and a second factor that
      is in an RFC, and each now holds every permission in the system.
    */
    const active = candidates.filter((row) => row.status === 'active');
    console.log(
      `\n[harden] ${active.length} of them can sign in today with published credentials.`,
    );

    if (!confirm) {
      console.log('\n[harden] DRY RUN — nothing written. Re-run with --confirm to apply:\n');
      // The target is repeated in the suggested command, so applying it is a
      // deliberate re-statement of where, not a bare `--confirm` on whatever
      // happens to be in the environment next time.
      console.log(
        `    pnpm --filter @sailent/database db:harden --target=${flags.declared}` +
          (flags.declared === 'production' ? ` --confirm-host=${target.host}` : '') +
          ' --confirm\n',
      );
      console.log('  Each account will be suspended, its second factor removed, its password');
      console.log('  hash replaced with an unusable value, and its live sessions revoked.');
      console.log('  The ROW is kept, so approvals and certificates it signed keep their');
      console.log('  attribution.\n');
      return;
    }

    const result = await client.db.transaction(async (tx) => {
      const ids = candidates.map((row) => row.id);

      await tx.execute(sql`
        UPDATE users
           SET status = 'suspended',
               password_hash = ${UNUSABLE_PASSWORD},
               totp_secret = NULL,
               totp_enabled = false
         WHERE id = ANY(${sql.raw(`ARRAY['${ids.join("','")}']::uuid[]`)})
      `);

      // A suspended account that keeps working until its access token expires
      // is not suspended, it is scheduled for suspension — and the fifteen
      // minutes in between are exactly when it matters.
      const revoked = await tx.execute(sql`
        UPDATE sessions
           SET revoked_at = now(), revoked_reason = 'credentials_hardened'
         WHERE user_id = ANY(${sql.raw(`ARRAY['${ids.join("','")}']::uuid[]`)})
           AND revoked_at IS NULL
      `);

      return { accounts: ids.length, sessions: revoked.rowCount ?? 0 };
    });

    console.log(
      `\n[harden] Done. ${result.accounts} account(s) neutralised, ` +
        `${result.sessions} live session(s) revoked.`,
    );

    /*
      Refuse to end quietly on an empty system. Somebody has to be able to
      administer this platform tomorrow, and the point of hardening is not to
      lock everybody out — it is to replace published credentials with real ones.
    */
    const remaining = await client.db.execute(sql`
      SELECT count(*) AS n FROM users u
       WHERE u.status = 'active'
         AND lower(u.email) NOT LIKE ${'%' + DEVELOPMENT_DOMAIN}
         AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
    `);
    const left = Number((remaining.rows ?? [{ n: 0 }])[0]!.n);

    if (left === 0) {
      console.warn(
        '\n[harden] WARNING: there is now NO active administrator on a real address.\n' +
          '          Create one before anybody needs to sign in. Every account that\n' +
          '          could administer this system has just been suspended.',
      );
    } else {
      console.log(`[harden] ${left} administrator(s) remain on real addresses.`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof DatabaseTargetError) {
    console.error(`\n[harden] REFUSED\n${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  console.error('[harden] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
