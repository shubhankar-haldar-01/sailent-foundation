-- ---------------------------------------------------------------------------
-- Phase 10.7: the blog, as real records.
--
-- ══════════════════════════════════════════════════════════════════════════
-- WHAT THIS REPLACES.
--
-- `/blog` rendered eight FABRICATED articles from
-- `apps/web/src/lib/mock/blog.ts` — invented titles, invented authors,
-- invented dates. Both the page and the sitemap carried deliberate exclusions
-- (`noIndex`, and no sitemap entries) whose comments said, in terms, that they
-- come off together when a real table lands. This is that table.
--
-- ADDITIVE ONLY. Three new tables, one new enum value, and nothing dropped,
-- renamed or rewritten. No existing row is read or modified. It is therefore
-- safe to apply while the site is serving, and safe to apply twice.
--
-- WRITTEN BY HAND, like every migration since 0008. `drizzle-kit generate`
-- diffs against `meta/0007_snapshot.json`, which is eleven migrations stale —
-- it would propose re-creating half the schema and prompt about a
-- `product_status` enum that has existed since 0000. See docs/phase-10.7.md.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. The shared taxonomy learns about articles.
--
-- `category_kind` already had program | campaign | both. Adding `blog` lets
-- the blog reuse the categories the rest of the site already names, instead of
-- a second table that would hold a second spelling of "Child Welfare" and a
-- second public URL for it.
--
-- `both` is deliberately NOT widened to include blog: it predates this value
-- and means "programme and campaign". Widening it would silently re-file every
-- existing category as a blog category.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'category_kind' AND e.enumlabel = 'blog'
  ) THEN
    ALTER TYPE "category_kind" ADD VALUE 'blog';
  END IF;
END $$;

COMMIT;

-- A new enum value cannot be used in the same transaction that added it, so
-- the tables that reference `categories` are created after the commit above.
BEGIN;

-- 2. Posts.
CREATE TABLE IF NOT EXISTS "blog_posts" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title"             varchar(240) NOT NULL,
  "slug"              varchar(240) NOT NULL,
  "excerpt"           text,
  -- MARKDOWN, never HTML. Rendered to React elements, so there is no raw-HTML
  -- path to sanitise. See docs/phase-10.7.md §Security.
  "content"           text,
  -- A real foreign key, unlike `success_stories.cover_image`, which is a plain
  -- URL because it predates the media library. `set null`: losing an image
  -- must not delete the article written around it.
  "featured_media_id" uuid REFERENCES "media"("id") ON DELETE SET NULL,
  "category_id"       uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  -- `set null` so removing a staff account does not remove their articles.
  -- The public API never returns this id — only a display name.
  "author_id"         uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "status"            "publish_status" DEFAULT 'draft' NOT NULL,
  "published_at"      timestamp with time zone,
  "meta_title"        varchar(240),
  "meta_description"  varchar(400),
  "canonical_url"     text,
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at"        timestamp with time zone
);

-- Slug uniqueness is enforced HERE, not only in the service. Two editors
-- publishing "Our year in review" minutes apart is a race the application
-- cannot win on its own.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_unique" ON "blog_posts" ("slug");
-- The public listing's exact access path: published, newest first.
CREATE INDEX IF NOT EXISTS "blog_posts_status_published_idx"
    ON "blog_posts" ("status", "published_at");
CREATE INDEX IF NOT EXISTS "blog_posts_category_idx" ON "blog_posts" ("category_id");
CREATE INDEX IF NOT EXISTS "blog_posts_author_idx"   ON "blog_posts" ("author_id");

-- 3. Tags.
--
-- The UNIQUE on `slug` is what actually prevents duplicates: "Field Notes",
-- "field notes" and "Field-Notes" all normalise to `field-notes`, so the
-- second attempt finds the first rather than creating a twin.
CREATE TABLE IF NOT EXISTS "blog_tags" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       varchar(80) NOT NULL,
  "slug"       varchar(80) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "blog_tags_slug_unique" ON "blog_tags" ("slug");

-- 4. Posts to tags.
--
-- The pair IS the identity, so it is the primary key — tagging one post twice
-- with the same tag is impossible rather than merely discouraged. Both sides
-- cascade: a junction row has no meaning once either end is gone.
CREATE TABLE IF NOT EXISTS "blog_post_tags" (
  "post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
  "tag_id"  uuid NOT NULL REFERENCES "blog_tags"("id")  ON DELETE CASCADE,
  CONSTRAINT "blog_post_tags_pk" PRIMARY KEY ("post_id", "tag_id")
);
CREATE INDEX IF NOT EXISTS "blog_post_tags_tag_idx" ON "blog_post_tags" ("tag_id");

-- 5. Row level security, on all three.
--
-- NOT OPTIONAL, AND NOT A FORMALITY. Supabase publishes the `public` schema
-- through PostgREST using the `anon` key, which is public by design. A table
-- in this schema without RLS is readable by anyone who knows the project URL —
-- so for the blog that would mean every DRAFT, readable by the world, which is
-- precisely what the publish gate exists to prevent.
--
-- NO POLICIES ARE DEFINED, deliberately. RLS with no policies denies every row
-- to any role it applies to, and the application connects as the table owner
-- and bypasses it entirely. A policy here would be a second authorization
-- system with different rules from the permission guards — two answers to the
-- same question, and no way to tell which is enforced.
--
-- `apps/api/test/database.spec.ts` asserts this for every table rather than a
-- fixed list, so a future table that forgets it fails there instead of
-- shipping. These three forgot it, and that is exactly how it was caught.
ALTER TABLE "blog_posts"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blog_tags"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blog_post_tags" ENABLE ROW LEVEL SECURITY;

COMMIT;
