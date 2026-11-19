ALTER TABLE "programs" DROP CONSTRAINT IF EXISTS "programs_category_id_categories_id_fk";
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_category_id_categories_id_fk";
ALTER TABLE "blog_posts" DROP CONSTRAINT IF EXISTS "blog_posts_category_id_fkey";

DROP INDEX IF EXISTS "blog_posts_category_idx";

ALTER TABLE "programs" DROP COLUMN IF EXISTS "category_id";
ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "category_id";
ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "category_id";

DROP TABLE IF EXISTS "categories" CASCADE;
DROP TYPE IF EXISTS "public"."category_kind";

