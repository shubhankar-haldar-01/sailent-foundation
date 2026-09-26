-- ---------------------------------------------------------------------------
-- Phase 10.9: section-composed pages.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ADDITIVE ONLY. Two new tables, no new enum, nothing dropped, renamed or
-- rewritten, and no existing row read or modified. Safe to apply while the
-- site is serving, and safe to apply twice.
--
-- `sections` is jsonb, and the constraint that matters is NOT in this file:
-- every element is validated against the closed registry in
-- `@sailent/validation` on write. docs/database-architecture.md — "an unknown
-- section type is rejected. This is what keeps a composer from becoming an
-- unconstrained page builder." A CHECK constraint cannot express "one of the
-- nine React components the site can render", so the database enforces shape
-- and the application enforces membership.
--
-- WRITTEN BY HAND, like every migration since 0008. `drizzle-kit generate`
-- diffs against `meta/0007_snapshot.json`, which is twelve migrations stale.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. The pages.
CREATE TABLE IF NOT EXISTS "pages" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- The route this composes, without a leading slash: `home`, `about`. A row
  -- does not CREATE a route; it decides which approved sections an existing
  -- route shows.
  "slug"             varchar(120) NOT NULL,
  "title"            varchar(240) NOT NULL,
  "sections"         jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status"           "publish_status" DEFAULT 'draft' NOT NULL,
  "published_at"     timestamp with time zone,
  -- Scheduling without a scheduler: a page is public when it is `published`
  -- AND this is null or already past. The gate is in SQL on every public read,
  -- so there is no cron job to run and no window where the row and the site
  -- disagree.
  "scheduled_at"     timestamp with time zone,
  "meta_title"       varchar(240),
  "meta_description" varchar(400),
  "version"          integer DEFAULT 1 NOT NULL,
  "updated_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"       timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at"       timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "pages_slug_unique" ON "pages" ("slug");
-- The public read's exact access path.
CREATE INDEX IF NOT EXISTS "pages_status_scheduled_idx" ON "pages" ("status", "scheduled_at");

-- 2. A snapshot per save.
--
-- Append-only in practice: nothing in the code updates or deletes a revision,
-- for the reason the audit log is append-only. "Who changed the homepage, and
-- to what" is worth nothing if it can be rewritten afterwards.
CREATE TABLE IF NOT EXISTS "page_revisions" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id"          uuid NOT NULL REFERENCES "pages"("id") ON DELETE CASCADE,
  "version"          integer NOT NULL,
  "title"            varchar(240) NOT NULL,
  "sections"         jsonb NOT NULL,
  "meta_title"       varchar(240),
  "meta_description" varchar(400),
  "note"             text,
  "created_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL
);

-- One snapshot per version, so "revert to version 7" names exactly one row.
CREATE UNIQUE INDEX IF NOT EXISTS "page_revisions_page_version_unique"
    ON "page_revisions" ("page_id", "version");
CREATE INDEX IF NOT EXISTS "page_revisions_page_idx"
    ON "page_revisions" ("page_id", "created_at");

-- 3. Row level security, on both.
--
-- Supabase publishes the `public` schema through PostgREST with the `anon`
-- key. A table here without RLS is readable by anyone who knows the project
-- URL — which for `pages` would mean every unpublished draft of the homepage.
-- No policies: RLS with none denies every row to any role it applies to, and
-- the application connects as the owner and bypasses it.
ALTER TABLE "pages"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "page_revisions" ENABLE ROW LEVEL SECURITY;

COMMIT;
