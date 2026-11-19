-- Enforce uniqueness for team member Aadhaar number (digits only, excluding deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_aadhar_unique"
ON "team_members" (regexp_replace("aadhar_number", '[^0-9]', '', 'g'))
WHERE "deleted_at" IS NULL AND "aadhar_number" IS NOT NULL AND "aadhar_number" != '';
--> statement-breakpoint

-- Enforce uniqueness for team member contact number (last 10 digits, excluding deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_contact_number_unique"
ON "team_members" (right(regexp_replace("contact_number", '[^0-9]', '', 'g'), 10))
WHERE "deleted_at" IS NULL AND "contact_number" IS NOT NULL AND length(regexp_replace("contact_number", '[^0-9]', '', 'g')) >= 10;
--> statement-breakpoint

-- Enforce uniqueness for team member public email (case-insensitive, excluding deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_email_public_unique"
ON "team_members" (lower(btrim("email_public")))
WHERE "deleted_at" IS NULL AND "email_public" IS NOT NULL AND "email_public" != '';
--> statement-breakpoint

-- Add deterministic hash for donor tax ID (PAN) to support uniqueness across encrypted values
ALTER TABLE "donors" ADD COLUMN IF NOT EXISTS "tax_id_hash" varchar(64);
--> statement-breakpoint

-- Enforce uniqueness for donor PAN / Tax ID hash
CREATE UNIQUE INDEX IF NOT EXISTS "donors_tax_id_hash_unique"
ON "donors" ("tax_id_hash")
WHERE "tax_id_hash" IS NOT NULL;
--> statement-breakpoint

-- Enforce uniqueness for staff user phone (last 10 digits)
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_unique"
ON "users" (right(regexp_replace("phone", '[^0-9]', '', 'g'), 10))
WHERE "phone" IS NOT NULL AND length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 10;

