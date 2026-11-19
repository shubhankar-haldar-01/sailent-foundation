ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "fee_amount" bigint;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "payment_id" varchar(128);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "order_id" varchar(128);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "paid_amount" bigint;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_fee_amount_non_negative'
  ) THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_fee_amount_non_negative" CHECK ("fee_amount" IS NULL OR "fee_amount" >= 0);
  END IF;
END $$;

