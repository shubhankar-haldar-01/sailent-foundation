ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "functions" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "function_name" varchar(120);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "attendees" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_attendee_count_max_four'
  ) THEN
    ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_attendee_count_max_four" CHECK ("attendee_count" >= 1 AND "attendee_count" <= 4);
  END IF;
END $$;

