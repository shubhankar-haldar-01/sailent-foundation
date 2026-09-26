-- Phase 5 — the product catalogue.
--
-- Phase 4 kept products INSIDE campaign_products: a name, a description and a
-- price on a row belonging to one campaign. Offering the same School Kit in
-- three appeals meant three copies of the same sentence, and whether they still
-- agreed with each other was a matter of luck.
--
-- This migration lifts that content into a `products` master and reduces
-- `campaign_products` to what genuinely differs between campaigns.
--
-- ORDER MATTERS. The content is copied out BEFORE the columns holding it are
-- dropped, and product_id is proved non-null before it is declared so. A drop
-- that runs before its backfill is not recoverable.

CREATE TYPE "product_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint

CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"image" text,
	"default_price" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"unit" varchar(40) DEFAULT 'unit' NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_default_price_positive" CHECK (default_price > 0),
	CONSTRAINT "products_name_not_blank" CHECK (length(btrim(name)) > 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX "products_slug_unique" ON "products" ("slug");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" ("status");--> statement-breakpoint

-- BACKFILL 1: every distinct campaign product becomes a catalogue entry.
-- DISTINCT ON keeps the earliest row per slug; where two campaigns happened to
-- use one slug with different wording, the first one written wins and the other
-- campaign keeps its own price and target regardless.
INSERT INTO "products" ("name", "slug", "description", "image", "default_price", "currency", "status", "created_at")
SELECT DISTINCT ON (cp."slug")
	cp."name", cp."slug", cp."description", cp."image", cp."price", cp."currency", 'active', cp."created_at"
FROM "campaign_products" cp
ORDER BY cp."slug", cp."created_at" ASC
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

ALTER TABLE "campaign_products" ADD COLUMN "product_id" uuid;--> statement-breakpoint

-- BACKFILL 2: point each offering at its catalogue entry.
UPDATE "campaign_products" cp
SET "product_id" = p."id"
FROM "products" p
WHERE p."slug" = cp."slug";--> statement-breakpoint

-- Refuse to continue if anything failed to match. Better a failed migration
-- than a NOT NULL added to a column with holes in it.
DO $$
DECLARE orphaned integer;
BEGIN
	SELECT count(*) INTO orphaned FROM "campaign_products" WHERE "product_id" IS NULL;
	IF orphaned > 0 THEN
		RAISE EXCEPTION 'Phase 5 backfill incomplete: % campaign_products have no product', orphaned;
	END IF;
END $$;--> statement-breakpoint

ALTER TABLE "campaign_products" ALTER COLUMN "product_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_product_id_products_id_fk"
	FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- One product per campaign, enforced by the database rather than by a service
-- that a double-clicked button can race.
DROP INDEX IF EXISTS "campaign_products_slug_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_products_campaign_product_unique" ON "campaign_products" ("campaign_id", "product_id");--> statement-breakpoint
CREATE INDEX "campaign_products_product_idx" ON "campaign_products" ("product_id");--> statement-breakpoint

-- "fulfilled" described a warehouse; "provided" describes what a donor was
-- told. Renamed rather than replaced, so the counts survive.
ALTER TABLE "campaign_products" RENAME COLUMN "fulfilled_quantity" TO "provided_quantity";--> statement-breakpoint
ALTER TABLE "campaign_products" DROP CONSTRAINT IF EXISTS "campaign_products_fulfilled_non_negative";--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_provided_non_negative" CHECK (provided_quantity >= 0);--> statement-breakpoint

-- Now — and only now — the copied columns go.
ALTER TABLE "campaign_products" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "campaign_products" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "campaign_products" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "campaign_products" DROP COLUMN "image";--> statement-breakpoint

-- Donation lines cite the catalogue entry as well as the offering, so a product
-- removed from a campaign does not orphan its own history.
ALTER TABLE "donation_items" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "donation_items" ADD CONSTRAINT "donation_items_product_id_products_id_fk"
	FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

UPDATE "donation_items" di
SET "product_id" = cp."product_id"
FROM "campaign_products" cp
WHERE cp."id" = di."campaign_product_id";--> statement-breakpoint

ALTER TABLE "donation_items" DROP CONSTRAINT IF EXISTS "donation_items_type_consistent";--> statement-breakpoint
ALTER TABLE "donation_items" ADD CONSTRAINT "donation_items_type_consistent" CHECK (
	(item_type = 'product' AND campaign_product_id IS NOT NULL AND product_id IS NOT NULL)
	OR (item_type = 'custom' AND campaign_product_id IS NULL AND product_id IS NULL)
);--> statement-breakpoint

DROP INDEX IF EXISTS "donation_items_product_idx";--> statement-breakpoint
CREATE INDEX "donation_items_campaign_product_idx" ON "donation_items" ("campaign_product_id");--> statement-breakpoint
CREATE INDEX "donation_items_product_idx" ON "donation_items" ("product_id");--> statement-breakpoint

-- Phase 4's lockdown applies to the new table too: no PostgREST access, RLS on
-- with no policies, so the Data API cannot read the catalogue.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "products" FROM anon, authenticated;
	END IF;
END $$;--> statement-breakpoint

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
