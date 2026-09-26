import { defineConfig } from 'drizzle-kit';

/**
 * The connection drizzle-kit is ALLOWED to use.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS FILE USED TO CHOOSE THE DATABASE, AND IT CHOSE BADLY.
 *
 * It read `DATABASE_MIGRATION_URL || DATABASE_URL || process.env…` — a
 * four-deep fallback chain. On a machine whose `.env` `DATABASE_URL` points at
 * production Supabase, that meant `db:push` would apply schema changes to
 * production, and `db:studio` would serve production rows — including donor
 * PII — over a local web UI, with nothing asked and nothing said.
 *
 * It no longer chooses anything. `src/drizzle-guarded.ts` resolves and
 * authorises the target first, then hands the approved URL over in
 * `DRIZZLE_AUTHORISED_URL` and DELETES the other two variables from the
 * child environment, so there is nothing here to fall back to.
 *
 * WHEN THE VARIABLE IS ABSENT this falls back to a deliberately dead address —
 * `127.0.0.1:1`, where nothing listens — rather than throwing. `db:generate`
 * needs a config it can load but never opens a connection, so it keeps
 * working; while anybody invoking `drizzle-kit push` or `drizzle-kit studio`
 * by hand gets an instant connection refusal against their own loopback
 * instead of a session on a real database.
 * ══════════════════════════════════════════════════════════════════════════
 */
const UNAUTHORISED = 'postgresql://unauthorised@127.0.0.1:1/unauthorised';
const url = process.env.DRIZZLE_AUTHORISED_URL || UNAUTHORISED;

export default defineConfig({
  // Points at the BUILD, not the source: this package compiles to Node ESM,
  // where  specifiers are required and correct. drizzle-kit reads TS
  // source with a CJS require that cannot map  onto , so
  // generating from dist keeps one correct specifier style in the source.
  schema: './dist/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
