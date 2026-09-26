CREATE TYPE "public"."category_kind" AS ENUM('program', 'campaign', 'both');--> statement-breakpoint
CREATE TYPE "public"."faq_context" AS ENUM('general', 'donation', 'volunteer', 'campaign', 'event');--> statement-breakpoint
CREATE TYPE "public"."media_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"icon" varchar(32),
	"kind" "category_kind" DEFAULT 'both' NOT NULL,
	"display_order" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"slug" varchar(240) NOT NULL,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" varchar(300) NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(80),
	"context_type" "faq_context" DEFAULT 'general' NOT NULL,
	"context_id" uuid,
	"display_order" integer DEFAULT 100 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faqs_context_consistent" CHECK ((context_type = 'general' AND context_id IS NULL) OR (context_type <> 'general' AND context_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "campaign_gallery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"display_order" integer DEFAULT 100 NOT NULL,
	"visibility" "media_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"url" text,
	"alt_text" varchar(300) NOT NULL,
	"caption" varchar(300),
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"visibility" "media_visibility" DEFAULT 'public' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_size_positive" CHECK (size_bytes > 0),
	CONSTRAINT "media_private_has_no_url" CHECK (visibility = 'public' OR url IS NULL)
);
--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign_gallery" ADD CONSTRAINT "campaign_gallery_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_gallery" ADD CONSTRAINT "campaign_gallery_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_key_unique" ON "categories" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_kind_order_idx" ON "categories" USING btree ("kind","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_history_type_slug_unique" ON "slug_history" USING btree ("entity_type","slug");--> statement-breakpoint
CREATE INDEX "slug_history_entity_idx" ON "slug_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "faqs_context_idx" ON "faqs" USING btree ("context_type","context_id","display_order");--> statement-breakpoint
CREATE INDEX "faqs_published_idx" ON "faqs" USING btree ("is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_gallery_unique" ON "campaign_gallery" USING btree ("campaign_id","media_id");--> statement-breakpoint
CREATE INDEX "campaign_gallery_order_idx" ON "campaign_gallery" USING btree ("campaign_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "media_storage_key_unique" ON "media" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "media_visibility_idx" ON "media" USING btree ("visibility");--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- Seed the category catalogue HERE, not only in the seed script.
--
-- The backfill below has to map each existing `category` string onto a real
-- row, and migrations run before the seed does. Putting the catalogue in the
-- migration makes it self-contained: a database that has run its migrations is
-- a working database, whether or not anyone remembered the seed afterwards.
--
-- The seed still upserts the same list, so the two cannot drift.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO categories (key, name, slug, icon, kind, display_order) VALUES
  ('EDUCATION', 'Education', 'education', 'book', 'both', 10),
  ('HEALTHCARE', 'Healthcare', 'healthcare', 'heart', 'both', 20),
  ('CHILD_WELFARE', 'Child Welfare', 'child-welfare', 'shield', 'both', 30),
  ('WOMEN_EMPOWERMENT', 'Women Empowerment', 'women-empowerment', 'briefcase', 'both', 40),
  ('LIVELIHOOD', 'Livelihood', 'livelihood', 'briefcase', 'both', 50),
  ('ENVIRONMENT', 'Environment', 'environment', 'leaf', 'both', 60),
  ('ANIMAL_WELFARE', 'Animal Welfare', 'animal-welfare', 'paw', 'both', 70),
  ('DISASTER_RELIEF', 'Disaster Relief', 'disaster-relief', 'shield', 'both', 80),
  ('FOOD_SUPPORT', 'Food Support', 'food-support', 'sprout', 'both', 90),
  ('CLOTHING', 'Clothing', 'clothing', 'shield', 'campaign', 100),
  ('COMMUNITY_DEVELOPMENT', 'Community Development', 'community-development', 'sprout', 'both', 110),
  ('OTHER', 'Other', 'other', 'sprout', 'both', 999)
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
-- Backfill from the free-text column that categories replace. Matching on the
-- NAME because that is what was written there; anything that fails to match is
-- left null rather than guessed at, and shows up as an uncategorised record in
-- the admin list where somebody can fix it.
UPDATE programs p SET category_id = c.id FROM categories c
 WHERE p.category_id IS NULL AND lower(p.category) = lower(c.name);
--> statement-breakpoint
UPDATE campaigns ca SET category_id = c.id FROM categories c
 WHERE ca.category_id IS NULL AND lower(ca.category) = lower(c.name);
--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security on every new table.
--
-- Same reasoning as migration 0004: Supabase publishes `public` through
-- PostgREST with a key that ships in browsers. A table added later without RLS
-- is a hole that opens quietly, which is why `database.spec.ts` asserts the
-- property across the whole schema rather than against a list.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE slug_history ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE campaign_gallery ENABLE ROW LEVEL SECURITY;
