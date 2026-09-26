-- ---------------------------------------------------------------------------
-- Phase 10.10: the document library.
--
-- ══════════════════════════════════════════════════════════════════════════
-- NO NEW TABLE. `documents` HAS EXISTED SINCE MIGRATION 0000.
--
-- It shipped with every column, both enums, three indexes and two CHECK
-- constraints — and nothing in the application could ever write to it. This
-- phase is the missing write path, so the migration is only what the table was
-- missing to support one: a uniqueness guarantee, one more invariant, and the
-- index the admin listing actually orders by.
--
-- ADDITIVE ONLY. Nothing dropped, renamed or rewritten, and no existing row
-- modified. Safe to apply while the site is serving, and safe to apply twice.
--
-- WRITTEN BY HAND, like every migration since 0008. `drizzle-kit generate`
-- diffs against `meta/0007_snapshot.json`, which is thirteen migrations stale.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. One row per stored object.
--
-- `file_key` is generated server-side from 16 random bytes, so a collision is
-- not a practical worry — but a DUPLICATE is. Two rows naming one object turn
-- a single delete or a single visibility change into a silent inconsistency:
-- one row says public, the other says private, and the bytes can only be in
-- one bucket. The constraint makes that unrepresentable rather than unlikely.
CREATE UNIQUE INDEX IF NOT EXISTS "documents_file_key_unique"
    ON "documents" ("file_key");

-- 2. A public document must have been published.
--
-- `campaign-content.service.ts` filters public reads on
-- `visibility = 'public' AND published_at IS NOT NULL`. Without this
-- constraint a row can satisfy the first half and not the second, which
-- renders it invisible on the site while the admin screen reports it as
-- public — the failure mode nobody reports because nothing looks broken.
--
-- The converse is deliberately NOT constrained: a document that was public and
-- has been withdrawn keeps its `published_at`, because when it was published
-- is a fact about the past and withdrawing it does not make that untrue.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_public_has_published_at'
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT "documents_public_has_published_at"
      CHECK ("visibility" <> 'public' OR "published_at" IS NOT NULL);
  END IF;
END $$;

-- 3. The order the library is actually read in.
--
-- The three existing indexes serve the filters (visibility+type, financial
-- year, related entity). None of them serves "newest first", which is what
-- every page of the admin list is sorted by.
CREATE INDEX IF NOT EXISTS "documents_created_at_idx"
    ON "documents" ("created_at" DESC);

-- 4. Row level security.
--
-- Already enabled on this table, and re-stated here because it is the single
-- most consequential line for `documents` specifically: Supabase publishes the
-- `public` schema through PostgREST with the `anon` key, and this table holds
-- audited financials, internal policy papers and the location of every private
-- object in the bucket. No policies: RLS with none denies every row to any
-- role it applies to, and the application connects as the owner and bypasses
-- it. `ENABLE` is idempotent.
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

COMMIT;
