ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_goal_positive_when_public";--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_goal_positive_when_public" CHECK (status IN ('draft', 'archived') OR fundraising_goal > 0);
