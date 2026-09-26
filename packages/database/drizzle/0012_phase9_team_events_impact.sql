-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 9 — Team, Events and Impact.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- FOUR COLUMNS. NOT FOUR TABLES.
--
-- `team_members`, `events`, `event_registrations` and `impact_updates` were all
-- created in Phase 3 and carry almost everything this phase needs — including
-- the unique index on (event_id, email) that makes duplicate registration a
-- database guarantee rather than a service check.
--
-- What is genuinely absent is listed below, and nothing else is touched.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
/*
  An impact update needs an address of its own.

  `/impact/[slug]` is the detail page, and until now these rows were reachable
  only as a list — there was no stable, human-readable identifier to link to.
  Nullable first, backfilled below, then made NOT NULL and unique.
*/
ALTER TABLE "impact_updates" ADD COLUMN IF NOT EXISTS "slug" varchar(240);--> statement-breakpoint

/*
  The cover photograph, as a column rather than the first element of `images`.

  `campaigns`, `events` and `success_stories` all carry `cover_image` this way,
  and reaching into a JSON array for the one image that every card needs would
  make this the only entity that behaves differently.
*/
ALTER TABLE "impact_updates" ADD COLUMN IF NOT EXISTS "cover_image" text;--> statement-breakpoint

/*
  An impact update may belong to an EVENT as well as to a programme or campaign.

  A medical camp produces its own figures — patients seen, medicines dispensed —
  and those belong to the camp, not to the campaign that funded it. ON DELETE
  SET NULL: deleting an event must never delete the record of what it achieved.
*/
ALTER TABLE "impact_updates" ADD COLUMN IF NOT EXISTS "event_id" uuid;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'impact_updates_event_id_events_id_fk'
  ) THEN
    ALTER TABLE "impact_updates"
      ADD CONSTRAINT "impact_updates_event_id_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null;
  END IF;
END $$;--> statement-breakpoint

/*
  Backfill the slugs from the titles already on file.

  Lower-cased, non-alphanumerics collapsed to hyphens, trimmed. A collision
  falls back to appending the row's own id fragment, which is ugly and unique —
  and an editor can rename it afterwards. Doing this before the NOT NULL means
  the constraint can never be added against rows that cannot satisfy it.
*/
UPDATE "impact_updates"
   SET "slug" = btrim(regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'), '-')
 WHERE "slug" IS NULL;--> statement-breakpoint

UPDATE "impact_updates" u
   SET "slug" = u."slug" || '-' || substring(u."id"::text, 1, 8)
  FROM (
    SELECT "slug" FROM "impact_updates" GROUP BY "slug" HAVING count(*) > 1
  ) duplicates
 WHERE u."slug" = duplicates."slug";--> statement-breakpoint

-- Guard: an empty title would have produced an empty slug, which is not an
-- address. Better to stop than to publish a page at `/impact/`.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM impact_updates WHERE slug IS NULL OR btrim(slug) = '';
  IF n > 0 THEN
    RAISE EXCEPTION
      'Refusing to make impact_updates.slug required: % row(s) produced an empty slug from their title. Give them titles first.', n;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "impact_updates" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "impact_updates_slug_unique" ON "impact_updates" ("slug");--> statement-breakpoint

/*
  When registration closes, and who is running the event.

  `registration_status` already says whether registration is open, closed or
  full — so there is no `registration_required` flag here; "closed" is that
  flag. What it cannot express is a CUT-OFF, which is a different fact: an event
  can be open today and shut at midnight without anybody editing it.
*/
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizer" varchar(200);--> statement-breakpoint

-- The listing query for an event's own impact.
CREATE INDEX IF NOT EXISTS "impact_updates_event_idx" ON "impact_updates" ("event_id");
