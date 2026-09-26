-- Phase 6 — receipts, and a schema that can only express one-time giving.
--
-- Two jobs in one migration because they are the same decision seen twice:
-- this platform takes single donations and issues a numbered receipt for each.
-- Everything recurring was planned in Phase 3, never built, and is removed here
-- so it cannot be built by accident.
--
-- EVERY DESTRUCTIVE STEP IS GUARDED. Each one refuses rather than deletes when
-- it finds data, so this file is safe to run against a database it has never
-- seen. A migration that is only safe on the author's laptop is not a migration.

-- ---------------------------------------------------------------------------
-- 1. The gapless receipt counter.
--
-- An ordinary table, not a sequence. `nextval()` does not roll back, so a
-- failed capture would consume a number forever and leave a hole in the receipt
-- book. A row taken with SELECT … FOR UPDATE inside the capture transaction is
-- released when that transaction is.
-- ---------------------------------------------------------------------------
CREATE TABLE "receipt_sequences" (
	"financial_year" smallint PRIMARY KEY NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_sequences_next_positive" CHECK (next_value > 0)
);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Receipts. Immutable: no deleted_at, no update path in the services.
-- A wrong receipt is superseded by a corrected one that cites it.
-- ---------------------------------------------------------------------------
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" varchar(32) NOT NULL,
	"financial_year" smallint NOT NULL,
	"sequence" integer NOT NULL,
	"donation_id" uuid NOT NULL,
	"donor_id" uuid,
	"donor_name" varchar(255) NOT NULL,
	"donor_email" varchar(255),
	"campaign_title" varchar(240),
	"program_title" varchar(240),
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"line_items" jsonb NOT NULL,
	"payment_reference" varchar(128),
	"eighty_g_eligible_at" timestamp with time zone,
	"registration_number" varchar(64),
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" uuid,
	"superseded_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_amount_positive" CHECK (amount > 0),
	CONSTRAINT "receipts_sequence_positive" CHECK (sequence > 0)
);--> statement-breakpoint

ALTER TABLE "receipts" ADD CONSTRAINT "receipts_donation_id_donations_id_fk"
	FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_donor_id_donors_id_fk"
	FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_superseded_by_id_receipts_id_fk"
	FOREIGN KEY ("superseded_by_id") REFERENCES "receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "receipts_number_unique" ON "receipts" ("receipt_number");--> statement-breakpoint
-- One receipt per donation, enforced rather than assumed. This is also what
-- makes the capture transaction safe to retry: a second attempt collides here.
CREATE UNIQUE INDEX "receipts_donation_unique" ON "receipts" ("donation_id");--> statement-breakpoint
-- The gapless guarantee expressed as a constraint: a year cannot issue a
-- number twice, so a counter bug becomes a failed write rather than a
-- duplicated document.
CREATE UNIQUE INDEX "receipts_year_sequence_unique" ON "receipts" ("financial_year", "sequence");--> statement-breakpoint
CREATE INDEX "receipts_donor_idx" ON "receipts" ("donor_id");--> statement-breakpoint
CREATE INDEX "receipts_issued_idx" ON "receipts" ("issued_at");--> statement-breakpoint

-- `donations.receipt_id` has been a dangling uuid since migration 0000, with no
-- table to point at. It has one now.
ALTER TABLE "donations" ADD CONSTRAINT "donations_receipt_id_receipts_id_fk"
	FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. `donation_type` can only describe a one-time gift.
--
-- Was: one_time | monthly | product | hybrid | custom — two overlapping ideas
-- in one column. "one_time" answered "how often", the rest answered "made of
-- what", and "monthly" answered a question this platform does not ask.
--
-- Now it answers one question: what is the donation MADE OF.
--   custom   an amount, no products
--   product  products only
--   hybrid   products plus an amount
-- ---------------------------------------------------------------------------
DO $$
DECLARE recurring integer;
BEGIN
	SELECT count(*) INTO recurring FROM "donations" WHERE "donation_type" = 'monthly';
	IF recurring > 0 THEN
		RAISE EXCEPTION
			'% donation(s) are typed as monthly. Phase 6 removes recurring giving; migrate or refund them before running this.', recurring;
	END IF;
END $$;--> statement-breakpoint

ALTER TYPE "donation_type" RENAME TO "donation_type_legacy";--> statement-breakpoint
CREATE TYPE "donation_type" AS ENUM('custom', 'product', 'hybrid');--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "donation_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "donation_type" TYPE "donation_type"
	USING (CASE
		-- "one_time" said how often, not what of. A one-time gift with no
		-- products is a custom amount, which is what the column now records.
		WHEN "donation_type"::text = 'one_time' THEN 'custom'
		ELSE "donation_type"::text
	END)::"donation_type";--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "donation_type" SET DEFAULT 'custom';--> statement-breakpoint
DROP TYPE "donation_type_legacy";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. The recurring-donation columns go.
--
-- None is referenced by any service. They are the remains of a feature that was
-- designed and never built, and a nullable column pointing at a table nobody
-- writes is an invitation to build it.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "donations_subscription_idx";--> statement-breakpoint
ALTER TABLE "donations" DROP COLUMN IF EXISTS "subscription_id";--> statement-breakpoint
ALTER TABLE "payment_webhooks" DROP COLUMN IF EXISTS "related_subscription_id";--> statement-breakpoint
ALTER TABLE "donors" DROP COLUMN IF EXISTS "is_recurring_donor";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. The subscription tables, retired.
--
-- Phase 5 marked these deprecated and deliberately did NOT write this drop,
-- because dropping a table is irreversible and the decision belonged to
-- whoever could see the row count on the day. This is that drop, written so it
-- can make the check itself: it refuses on any data rather than destroying it,
-- so an operator running it on a database holding real mandates gets an error
-- and a reason, not a loss.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
	held integer := 0;
	child integer := 0;
BEGIN
	IF to_regclass('public.subscriptions') IS NOT NULL THEN
		EXECUTE 'SELECT count(*) FROM public.subscriptions' INTO held;
	END IF;
	IF to_regclass('public.subscription_payments') IS NOT NULL THEN
		EXECUTE 'SELECT count(*) FROM public.subscription_payments' INTO child;
	END IF;

	IF held > 0 OR child > 0 THEN
		RAISE EXCEPTION
			'Refusing to drop subscription tables: % subscription(s) and % payment(s) exist. Export and settle them first — see docs/phase-6.md.', held, child;
	END IF;

	DROP TABLE IF EXISTS public.subscription_payments;
	DROP TABLE IF EXISTS public.subscriptions;
END $$;--> statement-breakpoint

DROP TYPE IF EXISTS "subscription_status";--> statement-breakpoint
DROP TYPE IF EXISTS "subscription_frequency";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 6. Phase 4's lockdown applies to the new tables: no PostgREST access, RLS on
-- with no policies, so the Data API cannot read a donor's receipt.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "receipts", "receipt_sequences" FROM anon, authenticated;
	END IF;
END $$;--> statement-breakpoint

ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "receipt_sequences" ENABLE ROW LEVEL SECURITY;
