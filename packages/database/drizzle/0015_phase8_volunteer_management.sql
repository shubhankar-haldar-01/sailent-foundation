-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 8 — volunteer management.
--
-- FOUR TABLES AND A COUNTER. `volunteers` itself already existed, created in
-- Phase 3 with the full application shape, the status enum, the hours columns
-- and the check constraint that makes "has a VOL- id" mean "was approved".
-- Nothing here recreates it; two columns are added and one index is replaced.
--
-- NOT HERE, deliberately:
--   • volunteer_documents — file upload is out of scope for this phase.
--   • volunteer_hours     — attendance IS the record. A periodic aggregation
--                           would be a second source of truth for a number
--                           that gets printed on certificates.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
CREATE TYPE "volunteer_assignment_status" AS ENUM ('assigned', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "volunteer_certificate_type" AS ENUM ('participation', 'appreciation', 'completion', 'service');--> statement-breakpoint
CREATE TYPE "volunteer_certificate_status" AS ENUM ('issued', 'revoked');--> statement-breakpoint

/*
  The application form has always asked how the emergency contact is related to
  the volunteer, and there was nowhere to put it — so it was collected and
  discarded on every submission. "Ring this number" is markedly less useful
  than "ring their sister on this number" when somebody is hurt in the field.
*/
ALTER TABLE "volunteers" ADD COLUMN IF NOT EXISTS "emergency_contact_relation" varchar(80);--> statement-breakpoint

/*
  ONE LIVE RECORD PER PHONE NUMBER — not one ever.

  The unique index on `phone` permanently barred anybody who was ever rejected:
  apply in March, be turned down, and the number is burned. Every later
  application failed on a constraint, with no path back and no message that
  explained it.

  A PARTIAL index instead, excluding rejected and archived rows. Re-application
  becomes a policy question — the cooling period on `volunteer_applications`,
  which an administrator sets — rather than an accident of a database
  constraint. What it still prevents is what it was for: two live volunteers
  sharing a number, and one applicant flooding the review queue.
*/
DROP INDEX IF EXISTS "volunteers_phone_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "volunteers_phone_unique" ON "volunteers" ("phone")
  WHERE status NOT IN ('rejected', 'archived');--> statement-breakpoint

/*
  The gapless yearly counter behind VOL-2026-00001 (decision A13).

  A row per year, taken FOR UPDATE inside the approval transaction — the same
  mechanism `receipt_sequences` uses, and for the same reason: a Postgres
  sequence does not roll back, so an approval that failed after drawing a
  number would leave a permanent hole. A volunteer identifier appears on
  certificates that exist in the physical world.
*/
CREATE TABLE IF NOT EXISTS "volunteer_sequences" (
  "year" smallint PRIMARY KEY,
  "next_value" integer NOT NULL DEFAULT 1,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "volunteer_sequences_next_positive" CHECK ("next_value" > 0)
);--> statement-breakpoint

/*
  The application exactly as submitted, kept apart from the living profile.

  `volunteers` is edited over years — a corrected spelling, new availability,
  changed skills. That is right for a profile and useless for the question that
  gets asked after something goes wrong: what did this person actually tell us?
  `form_data` is a frozen snapshot, and nothing updates it.

  `review_notes` and `rejection_reason` are ADMIN-ONLY and must never reach the
  applicant.
*/
CREATE TABLE IF NOT EXISTS "volunteer_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "volunteer_id" uuid NOT NULL REFERENCES "volunteers"("id") ON DELETE cascade,
  "form_data" jsonb NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" "volunteer_status" DEFAULT 'applied' NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "rejection_reason" text,
  "cooling_period_until" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_applications_volunteer_idx" ON "volunteer_applications" ("volunteer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_applications_queue_idx" ON "volunteer_applications" ("status", "submitted_at")
  WHERE status IN ('applied', 'under_review');--> statement-breakpoint

/*
  A volunteer put to work.

  Polymorphic, because volunteering attaches to whatever the organisation is
  doing — an event, a campaign, a programme, or nothing in particular. Four
  nullable foreign keys plus a check that exactly one is set is the same design
  with more columns and a worse query plan.

  `expected_hours` is a PLAN. What was actually worked lives in attendance, and
  only attendance feeds the counters.
*/
CREATE TABLE IF NOT EXISTS "volunteer_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "volunteer_id" uuid NOT NULL REFERENCES "volunteers"("id") ON DELETE cascade,
  "assignable_type" varchar(24) DEFAULT 'general' NOT NULL,
  "assignable_id" uuid,
  "role" varchar(160) NOT NULL,
  "description" text,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "location" varchar(255),
  "expected_hours" integer,
  "status" "volunteer_assignment_status" DEFAULT 'assigned' NOT NULL,
  "assigned_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "volunteer_assignments_dates_ordered" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at"),
  CONSTRAINT "volunteer_assignments_expected_hours_sane" CHECK ("expected_hours" IS NULL OR ("expected_hours" >= 0 AND "expected_hours" <= 24))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_assignments_volunteer_idx" ON "volunteer_assignments" ("volunteer_id", "starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_assignments_target_idx" ON "volunteer_assignments" ("assignable_type", "assignable_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_assignments_status_idx" ON "volunteer_assignments" ("status");--> statement-breakpoint

/*
  What was actually worked.

  A VOLUNTEER CANNOT WRITE THIS TABLE. Certificates count verified hours, and a
  certificate is a document a future employer may rely on — somebody who could
  record their own attendance could print themselves any figure they liked.
  Every row is written by staff, and verification is a second, separate act.

  `duration_minutes` is STORED rather than derived, so a correction ("she
  stayed another hour, I forgot to note it") does not require inventing a
  check-out time that never happened.

  Unique on (assignment_id, date): one record per assignment per day. It
  deduplicates a double-submitted register, which on a phone at a venue is the
  ordinary case rather than the exotic one.
*/
CREATE TABLE IF NOT EXISTS "volunteer_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assignment_id" uuid NOT NULL REFERENCES "volunteer_assignments"("id") ON DELETE cascade,
  "volunteer_id" uuid NOT NULL REFERENCES "volunteers"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "check_in_at" timestamp with time zone,
  "check_out_at" timestamp with time zone,
  "duration_minutes" integer NOT NULL,
  "recorded_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "verified_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "verified_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "volunteer_attendance_duration_positive" CHECK ("duration_minutes" > 0),
  CONSTRAINT "volunteer_attendance_duration_sane" CHECK ("duration_minutes" <= 1440),
  CONSTRAINT "volunteer_attendance_times_ordered" CHECK ("check_in_at" IS NULL OR "check_out_at" IS NULL OR "check_out_at" > "check_in_at")
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "volunteer_attendance_unique" ON "volunteer_attendance" ("assignment_id", "date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_attendance_volunteer_idx" ON "volunteer_attendance" ("volunteer_id", "date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_attendance_unverified_idx" ON "volunteer_attendance" ("date") WHERE verified_at IS NULL;--> statement-breakpoint

/*
  A certificate of service — the document somebody shows an employer.

  `hours_credited` is drawn from VERIFIED attendance at the moment of issue and
  then frozen. Recomputing it later would mean a printed certificate and a
  database that disagree, and the printed one is the copy that exists in the
  world.

  `verification_code` backs a public /verify/[code] page so an employer can
  check it without an account. Deliberately NOT the certificate number:
  numbers are sequential and guessable, and a guessable code would let anybody
  enumerate every volunteer's service record.
*/
CREATE TABLE IF NOT EXISTS "volunteer_certificates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "volunteer_id" uuid NOT NULL REFERENCES "volunteers"("id") ON DELETE restrict,
  "certificate_number" varchar(32) NOT NULL,
  "verification_code" varchar(32) NOT NULL,
  "certificate_type" "volunteer_certificate_type" DEFAULT 'service' NOT NULL,
  "title" varchar(240) NOT NULL,
  "hours_credited" integer NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "issued_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "status" "volunteer_certificate_status" DEFAULT 'issued' NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "volunteer_certificates_hours_positive" CHECK ("hours_credited" > 0),
  CONSTRAINT "volunteer_certificates_period_ordered" CHECK ("period_end" >= "period_start")
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "volunteer_certificates_number_unique" ON "volunteer_certificates" ("certificate_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "volunteer_certificates_code_unique" ON "volunteer_certificates" ("verification_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "volunteer_certificates_volunteer_idx" ON "volunteer_certificates" ("volunteer_id", "issued_at");
