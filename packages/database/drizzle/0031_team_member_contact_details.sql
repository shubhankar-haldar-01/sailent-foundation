ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "contact_number" varchar(30);--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "aadhar_number" varchar(20);--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "address" text;

