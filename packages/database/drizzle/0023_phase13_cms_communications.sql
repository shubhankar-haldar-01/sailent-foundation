-- ---------------------------------------------------------------------------
-- Phase 13: contact messages, newsletter subscriptions, organisation settings
-- and the permissions that govern them.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ADDITIVE ONLY. Two new tables, two new settings rows, six new permissions
-- granted to SUPER_ADMIN. Nothing dropped, renamed or rewritten, and no
-- existing row modified.
--
-- WHY THE SETTINGS AND PERMISSIONS ARE HERE AND NOT ONLY IN THE SEED.
-- The reference seed (`db:seed --reference`) deletes and re-inserts every
-- SUPER_ADMIN grant, leaving a window in which nobody can administer the site
-- (DEPLOYMENT.md §10). Inserting the new rows here, with ON CONFLICT DO
-- NOTHING, gives production exactly what it needs by applying the migration —
-- the seed catalogue lists the same keys, so a later reseed changes nothing.
--
-- The settings rows are inserted EMPTY (every field null). Real organisation
-- details are entered by staff in Admin → Settings; demo values never reach a
-- database through this file.
--
-- No BEGIN/COMMIT: the migrator wraps pending migrations in one transaction
-- (AGENTS.md §5). Written by hand, like every migration since 0008.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Contact messages — what the public contact form submits.
CREATE TABLE IF NOT EXISTS "contact_messages" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"        varchar(120) NOT NULL,
  -- Normalised (NFC, trimmed, lower case) by the API before it is written.
  "email"       varchar(254) NOT NULL,
  "subject"     varchar(32) NOT NULL,
  "message"     text NOT NULL,
  "status"      varchar(16) DEFAULT 'new' NOT NULL,
  -- The address the web server vouched for (Phase 12), for abuse handling.
  "ip_address"  varchar(45),
  "handled_by"  uuid,
  "handled_at"  timestamp with time zone,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_messages_status_check"
    CHECK ("status" IN ('new', 'handled', 'archived')),
  CONSTRAINT "contact_messages_subject_check"
    CHECK ("subject" IN ('general', 'donation', 'volunteering', 'partnership', 'documents', 'media')),
  CONSTRAINT "contact_messages_message_length"
    CHECK (char_length("message") BETWEEN 1 AND 5000)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_handled_by_users_id_fk'
  ) THEN
    ALTER TABLE "contact_messages"
      ADD CONSTRAINT "contact_messages_handled_by_users_id_fk"
      FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "contact_messages_status_created_idx"
    ON "contact_messages" ("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "contact_messages_email_idx"
    ON "contact_messages" ("email");

-- 2. Newsletter subscriptions — double opt-in.
--
-- A row starts `pending`; only a click on the link sent to the address makes
-- it `subscribed`. Tokens are stored as SHA-256 hashes, like sign-in codes.
CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email"                    varchar(254) NOT NULL,
  "status"                   varchar(16) DEFAULT 'pending' NOT NULL,
  "confirm_token_hash"       varchar(64),
  "confirm_expires_at"       timestamp with time zone,
  "unsubscribe_token_hash"   varchar(64),
  "confirmation_sent_at"     timestamp with time zone,
  "confirmed_at"             timestamp with time zone,
  "unsubscribed_at"          timestamp with time zone,
  "source"                   varchar(40),
  "consent_ip"               varchar(45),
  "created_at"               timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"               timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "newsletter_subscribers_status_check"
    CHECK ("status" IN ('pending', 'subscribed', 'unsubscribed')),
  CONSTRAINT "newsletter_subscribers_confirmed_has_time"
    CHECK ("status" <> 'subscribed' OR "confirmed_at" IS NOT NULL)
);

-- One row per address, whatever its case or surrounding space.
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_email_unique"
    ON "newsletter_subscribers" (lower(btrim("email")));
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_confirm_token_unique"
    ON "newsletter_subscribers" ("confirm_token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_unsubscribe_token_unique"
    ON "newsletter_subscribers" ("unsubscribe_token_hash");
CREATE INDEX IF NOT EXISTS "newsletter_subscribers_status_idx"
    ON "newsletter_subscribers" ("status");

-- 3. Row level security (no policies: the app connects as the owner; migration
--    0017 asserts every table has RLS enabled).
ALTER TABLE "contact_messages"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "newsletter_subscribers"  ENABLE ROW LEVEL SECURITY;

-- 4. Organisation settings, inserted empty. Both are public: they are what the
--    footer, contact page and structured data show.
INSERT INTO "settings" ("key", "value", "category", "description", "is_public")
VALUES
  (
    'organization_contact',
    '{"email": null, "pressEmail": null, "phone": null, "officeHours": null,
      "address": {"line1": null, "line2": null, "city": null, "state": null,
                  "postalCode": null, "country": null}}'::jsonb,
    'organization',
    'Public contact details: email, phone, office hours and postal address. Contact-form messages are sent to the email.',
    true
  ),
  (
    'organization_social',
    '[]'::jsonb,
    'organization',
    'Public social media profiles shown in the footer and on the contact page.',
    true
  )
ON CONFLICT ("key") DO NOTHING;

-- 5. Permissions, granted to SUPER_ADMIN (the only administrative role).
INSERT INTO "permissions" ("key", "resource", "action", "description", "is_sensitive")
VALUES
  ('document.delete',  'document',   'delete', 'Delete a document and its stored file', true),
  ('contact.read',     'contact',    'read',   'Read contact-form messages', false),
  ('contact.manage',   'contact',    'manage', 'Mark contact-form messages handled or archived', false),
  ('newsletter.read',  'newsletter', 'read',   'View newsletter subscriptions', false),
  ('faq.read',         'faq',        'read',   'View general FAQs, including drafts', false),
  ('faq.manage',       'faq',        'manage', 'Create, edit, publish and remove general FAQs', false)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
  JOIN "permissions" p ON p."key" IN (
    'document.delete', 'contact.read', 'contact.manage',
    'newsletter.read', 'faq.read', 'faq.manage'
  )
 WHERE r."key" = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
