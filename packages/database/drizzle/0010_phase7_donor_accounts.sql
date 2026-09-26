-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7 — Donor accounts.
--
-- Two unrelated things travel together here because they touch the same three
-- tables and splitting them would mean two migrations that must be applied in
-- order anyway:
--
--   PART A  withdraws refunds, which Phase 6 built as scaffolding and which the
--           platform has decided not to offer.
--   PART B  adds what a donor account needs: saved campaigns, and the topic
--           preferences the notification settings screen writes to.
--
-- EVERY DESTRUCTIVE STEP IS GUARDED. Each `RAISE EXCEPTION` below aborts the
-- whole migration if live data would be lost, because a migration that silently
-- discards a financial record is worse than one that refuses to run. On this
-- database all five guards pass with zero rows; on any other, they are the
-- thing that stops this from being a data-loss event.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
-- ───────────────────────────────────────────────────────────────────────────
-- PART A — withdraw refunds
-- ───────────────────────────────────────────────────────────────────────────

-- Guard 1: no refund was ever issued.
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.refunds') IS NULL THEN RETURN; END IF;
  EXECUTE 'SELECT count(*) FROM refunds' INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop refunds: % row(s) exist. The platform is withdrawing refund support, so these must be settled and archived out of band before this migration can run.', n;
  END IF;
END $$;
--> statement-breakpoint

-- Guard 2: no donation or payment is sitting in a refunded state. Such a row
-- would have no state to move to once the enum values are gone.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM donations WHERE status::text IN ('refunded', 'partially_refunded');
  IF n > 0 THEN
    RAISE EXCEPTION 'Refusing to rewrite donation_status: % donation(s) are refunded or partially refunded.', n;
  END IF;
  SELECT count(*) INTO n FROM payments WHERE status::text IN ('refunded', 'partially_refunded');
  IF n > 0 THEN
    RAISE EXCEPTION 'Refusing to rewrite payment_status: % payment(s) are refunded or partially refunded.', n;
  END IF;
  SELECT count(*) INTO n FROM payment_transactions
   WHERE from_status::text IN ('refunded', 'partially_refunded')
      OR to_status::text IN ('refunded', 'partially_refunded');
  IF n > 0 THEN
    RAISE EXCEPTION 'Refusing to rewrite payment_status: % payment transition(s) reference a refunded state.', n;
  END IF;
END $$;
--> statement-breakpoint

-- Guard 3: no donation line has had units returned.
DO $$
DECLARE n bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'donation_items' AND column_name = 'refunded_quantity'
  ) THEN RETURN; END IF;
  EXECUTE 'SELECT count(*) FROM donation_items WHERE refunded_quantity <> 0' INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'Refusing to drop donation_items.refunded_quantity: % line(s) record returned units.', n;
  END IF;
END $$;
--> statement-breakpoint

DROP TABLE IF EXISTS "refunds";--> statement-breakpoint

-- Takes `donation_items_refunded_within_quantity` with it.
ALTER TABLE "donation_items" DROP COLUMN IF EXISTS "refunded_quantity";--> statement-breakpoint

-- Postgres has no `ALTER TYPE … DROP VALUE`, so narrowing an enum means
-- building the new type beside the old one, moving every column across and
-- dropping the old. The defaults come off first: a default is an expression of
-- the OLD type and blocks the column rewrite.
-- `donations_pending_idx` is a PARTIAL index, and its predicate holds enum
-- literals: `WHERE status IN ('pending','processing')` is stored as
-- `'pending'::donation_status`. Renaming the type retypes those literals too,
-- so the rebuilt column would be compared against `donation_status_old` and the
-- rewrite fails with "operator does not exist". It is dropped here and recreated
-- below, unchanged — Postgres re-resolves the literals against the new type.
DROP INDEX IF EXISTS "donations_pending_idx";--> statement-breakpoint

ALTER TABLE "donations" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."donation_status" RENAME TO "donation_status_old";--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('pending', 'processing', 'successful', 'failed', 'cancelled');--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "status" TYPE "public"."donation_status" USING "status"::text::"public"."donation_status";--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
DROP TYPE "public"."donation_status_old";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donations_pending_idx" ON "donations" USING btree ("created_at") WHERE status IN ('pending', 'processing');--> statement-breakpoint

ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."payment_status" RENAME TO "payment_status_old";--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'pending', 'processing', 'successful', 'failed', 'cancelled');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "public"."payment_status" USING "status"::text::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "from_status" TYPE "public"."payment_status" USING "from_status"::text::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "to_status" TYPE "public"."payment_status" USING "to_status"::text::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'created';--> statement-breakpoint
DROP TYPE "public"."payment_status_old";--> statement-breakpoint

-- The permission and its threshold setting. Deleting the permission row cascades
-- to `role_permissions`, so no role keeps a grant for a capability that is gone.
DELETE FROM "permissions" WHERE "key" = 'donation.refund';--> statement-breakpoint
DELETE FROM "settings" WHERE "key" = 'refund_approval_threshold_paise';--> statement-breakpoint

-- ───────────────────────────────────────────────────────────────────────────
-- PART B — donor accounts
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "saved_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "donor_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- CASCADE on both sides: a bookmark is a pointer, not a record of anything that
-- happened, so there is nothing to preserve once either end is gone. The
-- opposite choice on a financial table would be a bug; here it is the point.
ALTER TABLE "saved_campaigns" ADD CONSTRAINT "saved_campaigns_donor_id_donors_id_fk"
  FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_campaigns" ADD CONSTRAINT "saved_campaigns_campaign_id_campaigns_id_fk"
  FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Saving twice is saving once. Enforced here because a double-tapped bookmark
-- sends two requests that both read "not saved" before either writes.
CREATE UNIQUE INDEX IF NOT EXISTS "saved_campaigns_donor_campaign_unique" ON "saved_campaigns" USING btree ("donor_id","campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_campaigns_donor_idx" ON "saved_campaigns" USING btree ("donor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_campaigns_campaign_idx" ON "saved_campaigns" USING btree ("campaign_id");--> statement-breakpoint

ALTER TABLE "saved_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- WHAT a donor hears about, beside the existing columns for HOW to reach them.
-- `email_opt_in` / `sms_opt_in` / `whatsapp_opt_in` are channels; these are
-- topics, and the two are independent — someone may want email but only for the
-- campaigns they funded.
--
-- Transactional mail is deliberately absent: a receipt is not a preference, and
-- a donor cannot switch off the record of their own gift.
ALTER TABLE "donors" ADD COLUMN IF NOT EXISTS "notify_campaign_updates" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "donors" ADD COLUMN IF NOT EXISTS "notify_impact_updates" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "donors" ADD COLUMN IF NOT EXISTS "notify_newsletter" boolean DEFAULT false NOT NULL;
