-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 8 — row level security on the volunteer tables.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WITHOUT THIS, THE FIVE NEW TABLES ARE PUBLIC.
--
-- Supabase publishes the `public` schema through PostgREST using the `anon`
-- key, which ships in browsers by design. A table with RLS disabled is
-- readable by anybody who knows the project URL.
--
-- On these tables that means: volunteers' phone numbers, home addresses,
-- dates of birth and EMERGENCY CONTACTS; the admin-only rejection reasons and
-- internal review notes on `volunteer_applications`; and — worst of the set —
-- every `verification_code` in `volunteer_certificates`, which is the secret
-- that makes the public certificate check meaningful. Enumerable codes would
-- turn a verification page into a directory of everybody's service record.
--
-- RLS with NO POLICIES makes every row invisible to `anon` and `authenticated`
-- while leaving the application's own connection untouched: it connects as the
-- table owner, and an owner bypasses RLS unless FORCE ROW LEVEL SECURITY is
-- set, which it deliberately is not. Same arrangement as migration 0004.
--
-- `database.spec.ts` asserts this across the whole schema rather than against
-- a list, which is how the omission was caught before it shipped.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
ALTER TABLE volunteer_sequences ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE volunteer_assignments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE volunteer_attendance ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE volunteer_certificates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

/*
  The invariant, asserted rather than assumed — and asserted for the WHOLE
  schema, not just the tables above, so that a future migration which adds a
  table without RLS fails here as well as in the test suite.
*/
DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO unprotected
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relname <> '__drizzle_migrations'
     AND c.relrowsecurity = false;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION
      'These tables are published without row level security: %. Supabase serves them to the anon key.', unprotected;
  END IF;
END $$;
