ALTER TABLE "programs" ADD COLUMN "problem" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "approach" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "activities" jsonb;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "metrics" jsonb;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "accent_icon" varchar(24);--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "faqs" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "impact_notes" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "updates" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "schedule" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "gallery" jsonb;