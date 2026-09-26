-- ---------------------------------------------------------------------------
-- Phase 10.11: notification templates, and the send log's missing columns.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ADDITIVE ONLY. Two new tables and three new columns on `notifications`.
-- Nothing dropped, renamed or rewritten, and no existing row modified — every
-- new column is nullable or carries a default, so the rows already in the send
-- log stay exactly as they are.
--
-- `notification_templates` is documented in database-architecture.md §12 and
-- has never existed: every transactional email has been rendered from HTML
-- built inline in its worker processor. This is the table those bodies move
-- into, and the revisions table is what makes "templates with versioning"
-- (product-requirements §4.21) mean history rather than a counter.
--
-- WRITTEN BY HAND, like every migration since 0008. `drizzle-kit generate`
-- diffs against `meta/0007_snapshot.json`, which is fourteen migrations stale.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. The templates.
CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Matches `notifications.type`, so a processor looks up by the same string
  -- it already writes to the log.
  "slug"               varchar(96) NOT NULL,
  "name"               varchar(160) NOT NULL,
  "description"        text,
  "channel"            "notification_channel" DEFAULT 'email' NOT NULL,
  "subject"            varchar(320) NOT NULL,
  "body_html"          text NOT NULL,
  "body_text"          text NOT NULL,
  -- A schema of EXPECTED variables (`{ name: description }`), not values. It
  -- is what the editor is shown and what the preview fills in.
  "variables"          jsonb DEFAULT '{}'::jsonb NOT NULL,
  "brevo_template_id"  varchar(64),
  "is_active"          boolean DEFAULT true NOT NULL,
  "version"            integer DEFAULT 1 NOT NULL,
  "updated_by"         uuid,
  "created_at"         timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"         timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_templates_version_positive" CHECK ("version" >= 1)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_updated_by_users_id_fk'
  ) THEN
    ALTER TABLE "notification_templates"
      ADD CONSTRAINT "notification_templates_updated_by_users_id_fk"
      FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
END $$;

-- One template per slug. Two rows answering to `donation.confirmation` would
-- make which body a donor receives a matter of query ordering.
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_slug_unique"
    ON "notification_templates" ("slug");
CREATE INDEX IF NOT EXISTS "notification_templates_channel_idx"
    ON "notification_templates" ("channel", "is_active");

-- 2. One snapshot per save.
CREATE TABLE IF NOT EXISTS "notification_template_revisions" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "version"     integer NOT NULL,
  "subject"     varchar(320) NOT NULL,
  "body_html"   text NOT NULL,
  "body_text"   text NOT NULL,
  "variables"   jsonb,
  "note"        text,
  "created_by"  uuid,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_template_revisions_template_id_fk'
  ) THEN
    ALTER TABLE "notification_template_revisions"
      ADD CONSTRAINT "notification_template_revisions_template_id_fk"
      FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id")
      ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_template_revisions_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "notification_template_revisions"
      ADD CONSTRAINT "notification_template_revisions_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
END $$;

-- "Revert to version 7" must name exactly one row.
CREATE UNIQUE INDEX IF NOT EXISTS "notification_template_revisions_version_unique"
    ON "notification_template_revisions" ("template_id", "version");
CREATE INDEX IF NOT EXISTS "notification_template_revisions_template_idx"
    ON "notification_template_revisions" ("template_id", "created_at");

-- 3. The send log's missing columns (database-architecture.md §12).
--
-- All three are nullable or defaulted, so every row already in the log stays
-- valid and unchanged. `retry_count` defaults to 0 rather than NULL because
-- "how many attempts" has an answer for historical rows too: at least one was
-- made, and nothing recorded a second.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "template_id" uuid;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "template_version" integer;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_template_id_fk'
  ) THEN
    -- SET NULL, not CASCADE: retiring a template must not delete the record
    -- that a real email was sent to a real donor.
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_template_id_fk"
      FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id")
      ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_retry_count_positive'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_retry_count_positive" CHECK ("retry_count" >= 0);
  END IF;
END $$;

-- 4. The two reads this phase actually performs.
--
-- The bell asks for one staff user's unread in-app notifications; the send log
-- asks for failures on the email channel, newest first. Neither is served by
-- the three indexes already on this table.
CREATE INDEX IF NOT EXISTS "notifications_inbox_idx"
    ON "notifications" ("user_id", "channel", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_channel_status_idx"
    ON "notifications" ("channel", "status", "created_at");

-- 5. Row level security.
--
-- Supabase publishes the `public` schema through PostgREST with the `anon`
-- key. `notifications` holds donor email history and `notification_templates`
-- holds the wording of everything this organisation sends; neither belongs to
-- anonymous readers. No policies: RLS with none denies every row to any role
-- it applies to, and the application connects as the owner and bypasses it.
-- `ENABLE` is idempotent, and `notifications` already had it.
ALTER TABLE "notification_templates"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_template_revisions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"                    ENABLE ROW LEVEL SECURITY;

COMMIT;
