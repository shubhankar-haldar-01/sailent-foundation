import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { smallint } from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import {
  volunteerAssignmentStatusEnum,
  volunteerCertificateStatusEnum,
  volunteerCertificateTypeEnum,
  volunteerStatusEnum,
} from './enums.js';
import { users } from './users.js';

/**
 * Volunteers.
 *
 * `volunteerId` (VOL-2026-00001) is assigned AT APPROVAL, never at application
 * (decision A13) — so applicants who are never approved consume no identifiers
 * and the sequence reflects the actual volunteer corps. It is permanent, never
 * reused, and never editable: it appears on certificates that exist in the
 * physical world and that an employer may rely on.
 *
 * Uniqueness is guaranteed by the database, not by the application. The
 * generator draws from a Postgres sequence inside the approval transaction, so
 * two managers approving simultaneously cannot collide.
 */
export const volunteers = pgTable(
  'volunteers',
  {
    id: primaryId(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    donorId: uuid('donor_id'),

    /** NULL until approved. A row without one has not been approved. */
    volunteerId: varchar('volunteer_id', { length: 24 }),

    firstName: varchar('first_name', { length: 120 }).notNull(),
    lastName: varchar('last_name', { length: 120 }),
    email: varchar('email', { length: 255 }),
    /** SENSITIVE. Deduplication key for applications. */
    phone: varchar('phone', { length: 20 }).notNull(),
    photoUrl: text('photo_url'),

    dateOfBirth: date('date_of_birth'),
    addressLine1: varchar('address_line1', { length: 255 }),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 120 }),
    postalCode: varchar('postal_code', { length: 16 }),

    education: varchar('education', { length: 255 }),
    occupation: varchar('occupation', { length: 255 }),
    experience: text('experience'),
    languages: text('languages').array(),
    skills: text('skills').array(),
    interests: text('interests').array(),
    /** { days, hours, remote } — shapes vary, so jsonb rather than columns. */
    availability: jsonb('availability'),

    /** SENSITIVE. Used only in the event of an incident during field work. */
    emergencyContactName: varchar('emergency_contact_name', { length: 160 }),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 20 }),
    /**
     * Who that person is to them.
     *
     * The application form has always asked for it; there was nowhere to put
     * it, so it was collected and dropped. "Ring this number" is markedly less
     * useful than "ring their sister on this number" when somebody is hurt in
     * the field.
     */
    emergencyContactRelation: varchar('emergency_contact_relation', { length: 80 }),

    status: volunteerStatusEnum('status').notNull().default('applied'),
    /** ADMIN-ONLY. Invisible to the volunteer, including rejection reasons. */
    statusReason: text('status_reason'),
    internalNotes: text('internal_notes'),

    joiningDate: date('joining_date'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),

    /**
     * Certificates count VERIFIED hours only. A volunteer who could edit their
     * own attendance could inflate the hours printed on a document a future
     * employer relies on — which is why volunteers cannot write these.
     */
    totalHours: integer('total_hours').notNull().default(0),
    verifiedHours: integer('verified_hours').notNull().default(0),
    assignmentCount: integer('assignment_count').notNull().default(0),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('volunteers_volunteer_id_unique').on(table.volunteerId),
    /**
     * ONE LIVE RECORD PER PHONE NUMBER — not one ever.
     *
     * ══════════════════════════════════════════════════════════════════════
     * This was a plain unique index, and it permanently barred anybody who was
     * ever rejected. Apply in March, get turned down, and the number is burned:
     * every later application fails on a constraint, with no path back.
     *
     * A PARTIAL index instead. `rejected` and `archived` rows are excluded, so
     * a rejected applicant may apply again — subject to the cooling period on
     * `volunteer_applications`, which is a policy decision an administrator
     * sets rather than an accident of a database constraint.
     *
     * What it still prevents is the thing it was for: two live volunteers
     * sharing a number, and an applicant flooding the review queue.
     * ══════════════════════════════════════════════════════════════════════
     */
    uniqueIndex('volunteers_phone_unique')
      .on(table.phone)
      .where(sql`status NOT IN ('rejected', 'archived')`),
    /**
     * ONE LIVE RECORD PER EMAIL ADDRESS — the same rule, on the other key.
     *
     * ══════════════════════════════════════════════════════════════════════
     * Duplicate protection used to be enforced on the phone number ALONE,
     * while the volunteer's own dashboard resolves their record by EMAIL.
     * Nothing joined the two, so two applications with the same address and
     * different numbers both succeeded and one person ended up with two live
     * records. `/me/volunteering` then returned whichever one Postgres
     * happened to hand back.
     *
     * Not a cross-user leak — every row involved is the same person's — but a
     * volunteer approved months ago could open their dashboard and be shown
     * the other record: no VOL- identifier, no hours, no certificates.
     *
     * On `lower(btrim(email))`, not the raw column, because that is the form
     * `apply()` stores and the form the resolver looks up. Indexing the column
     * as written would let " Asha@Example.com " and "asha@example.com" coexist
     * and reintroduce exactly the ambiguity this removes.
     *
     * PARTIAL for the same reason as the phone index above: a rejected
     * applicant must not have their address burned forever.
     * ══════════════════════════════════════════════════════════════════════
     */
    uniqueIndex('volunteers_email_live_unique')
      .on(sql`lower(btrim(${table.email}))`)
      .where(sql`status NOT IN ('rejected', 'archived')`),
    index('volunteers_status_idx').on(table.status),
    // Drives the application review queue.
    index('volunteers_review_queue_idx')
      .on(table.status, table.createdAt)
      .where(sql`status IN ('applied', 'under_review')`),
    check(
      'volunteers_hours_non_negative',
      sql`total_hours >= 0 AND verified_hours >= 0 AND verified_hours <= total_hours`,
    ),
    // An approved volunteer must carry an identifier, and an unapproved one
    // must not — the invariant that makes "has an ID" mean "was approved".
    check(
      'volunteers_id_requires_approval',
      sql`(volunteer_id IS NULL AND status IN ('applied','under_review','rejected')) OR (volunteer_id IS NOT NULL AND status NOT IN ('applied','under_review','rejected'))`,
    ),
  ],
);

export type Volunteer = typeof volunteers.$inferSelect;
export type NewVolunteer = typeof volunteers.$inferInsert;

/**
 * The gapless yearly counter behind `VOL-2026-00001` (decision A13).
 *
 * A row per year, taken `FOR UPDATE` inside the approval transaction — the
 * same mechanism `receipt_sequences` uses, and for the same reason: a Postgres
 * sequence does not roll back, so an approval that failed after drawing a
 * number would leave a hole. A volunteer identifier appears on certificates
 * that exist in the physical world, and "VOL-2026-00004 does not exist" is a
 * question nobody should have to answer.
 */
export const volunteerSequences = pgTable(
  'volunteer_sequences',
  {
    year: smallint('year').primaryKey(),
    nextValue: integer('next_value').notNull().default(1),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [check('volunteer_sequences_next_positive', sql`${table.nextValue} > 0`)],
);

/**
 * The application, exactly as it was submitted.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SEPARATE FROM THE PROFILE, AND IMMUTABLE.
 *
 * `volunteers` is the living record: an administrator corrects a spelling, the
 * volunteer updates their availability, skills change over years. That is
 * right for a profile and useless for a question that gets asked after
 * something goes wrong — "what did this person actually tell us when they
 * applied?"
 *
 * `formData` is a jsonb snapshot of the submission. Nothing edits it.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `reviewNotes` and `rejectionReason` are ADMIN-ONLY and must never reach the
 * applicant. A rejection is communicated as a decision; the reasoning behind
 * it is an internal record, and publishing it invites an argument the
 * organisation has no obligation to have.
 */
export const volunteerApplications = pgTable(
  'volunteer_applications',
  {
    id: primaryId(),
    volunteerId: uuid('volunteer_id')
      .notNull()
      .references(() => volunteers.id, { onDelete: 'cascade' }),

    /** The submission, frozen. */
    formData: jsonb('form_data').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),

    status: volunteerStatusEnum('status').notNull().default('applied'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /** ADMIN-ONLY. */
    reviewNotes: text('review_notes'),
    /** ADMIN-ONLY. Never shown to the applicant. */
    rejectionReason: text('rejection_reason'),

    /**
     * How long before this person may apply again.
     *
     * Set at rejection. It is what makes re-application a policy rather than
     * the absence of a constraint — see the partial index above.
     */
    coolingPeriodUntil: date('cooling_period_until'),

    ...timestamps,
  },
  (table) => [
    index('volunteer_applications_volunteer_idx').on(table.volunteerId),
    index('volunteer_applications_queue_idx')
      .on(table.status, table.submittedAt)
      .where(sql`status IN ('applied', 'under_review')`),
  ],
);

/**
 * A volunteer put to work.
 *
 * POLYMORPHIC, because volunteering attaches to whatever the organisation is
 * doing — an event, a campaign, a programme, or nothing in particular. The
 * alternative is four nullable foreign keys and a check constraint saying
 * exactly one is set, which is the same thing with more columns.
 *
 * `expectedHours` is a plan, not a record. What was actually worked lives in
 * attendance, and only attendance feeds the counters.
 */
export const volunteerAssignments = pgTable(
  'volunteer_assignments',
  {
    id: primaryId(),
    volunteerId: uuid('volunteer_id')
      .notNull()
      .references(() => volunteers.id, { onDelete: 'cascade' }),

    /** event | campaign | program | general */
    assignableType: varchar('assignable_type', { length: 24 }).notNull().default('general'),
    assignableId: uuid('assignable_id'),

    role: varchar('role', { length: 160 }).notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    location: varchar('location', { length: 255 }),
    expectedHours: integer('expected_hours'),

    status: volunteerAssignmentStatusEnum('status').notNull().default('assigned'),
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('volunteer_assignments_volunteer_idx').on(table.volunteerId, table.startsAt),
    index('volunteer_assignments_target_idx').on(table.assignableType, table.assignableId),
    index('volunteer_assignments_status_idx').on(table.status),
    check('volunteer_assignments_dates_ordered', sql`ends_at IS NULL OR ends_at >= starts_at`),
    check(
      'volunteer_assignments_expected_hours_sane',
      sql`expected_hours IS NULL OR (expected_hours >= 0 AND expected_hours <= 24)`,
    ),
  ],
);

/**
 * What was actually worked.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A VOLUNTEER CANNOT WRITE THIS TABLE, AND THAT IS THE WHOLE POINT.
 *
 * Certificates count verified hours, and a certificate is a document a future
 * employer may rely on. Somebody who could record their own attendance could
 * print themselves any number they liked. So every row here is written by
 * staff, and `verifiedAt` is a second, separate act.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `durationMinutes` is STORED rather than derived from the timestamps, because
 * a correction ("she stayed another hour, I forgot to note it") should not
 * require inventing a check-out time that never happened. The check constraint
 * keeps it consistent where both timestamps are present.
 *
 * Unique on `(assignment_id, date)`: one attendance record per assignment per
 * day. It deduplicates a double-submitted register, which on a phone at a
 * venue is the ordinary case rather than the exotic one.
 */
export const volunteerAttendance = pgTable(
  'volunteer_attendance',
  {
    id: primaryId(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => volunteerAssignments.id, { onDelete: 'cascade' }),
    volunteerId: uuid('volunteer_id')
      .notNull()
      .references(() => volunteers.id, { onDelete: 'cascade' }),

    date: date('date').notNull(),
    checkInAt: timestamp('check_in_at', { withTimezone: true }),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    durationMinutes: integer('duration_minutes').notNull(),

    /** Staff only. Recorded here so a disputed figure has a name against it. */
    recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
    /**
     * Verification is a SEPARATE act from recording.
     *
     * Only verified minutes reach `verified_hours`, and only verified hours
     * reach a certificate. Recording says "this happened"; verifying says
     * "and I stand behind it".
     */
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('volunteer_attendance_unique').on(table.assignmentId, table.date),
    index('volunteer_attendance_volunteer_idx').on(table.volunteerId, table.date),
    index('volunteer_attendance_unverified_idx')
      .on(table.date)
      .where(sql`verified_at IS NULL`),
    check('volunteer_attendance_duration_positive', sql`duration_minutes > 0`),
    check(
      'volunteer_attendance_duration_sane',
      // A day is 24 hours. A figure above that is a typo, not a heroic shift.
      sql`duration_minutes <= 1440`,
    ),
    check(
      'volunteer_attendance_times_ordered',
      sql`check_in_at IS NULL OR check_out_at IS NULL OR check_out_at > check_in_at`,
    ),
  ],
);

/**
 * A certificate of service.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS THE DOCUMENT SOMEBODY SHOWS AN EMPLOYER, so two things follow.
 *
 * `hoursCredited` must be above zero — a certificate for no hours certifies
 * nothing — and it is drawn from VERIFIED attendance at the moment of issue,
 * then FROZEN. Recomputing it later would mean a printed certificate and a
 * database disagreeing, and the printed one is the one in the world.
 *
 * `verificationCode` backs a public `/verify/[code]` page, so the employer can
 * check it without an account. It is deliberately not the certificate number:
 * numbers are sequential and guessable, and a guessable code lets anybody
 * enumerate every volunteer's service record.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Revocation is a status, not a delete. A certificate issued in error has been
 * seen; the honest record is that it existed and was withdrawn.
 */
export const volunteerCertificates = pgTable(
  'volunteer_certificates',
  {
    id: primaryId(),
    volunteerId: uuid('volunteer_id')
      .notNull()
      .references(() => volunteers.id, { onDelete: 'restrict' }),

    certificateNumber: varchar('certificate_number', { length: 32 }).notNull(),
    /** Unguessable. Backs the public verification page. */
    verificationCode: varchar('verification_code', { length: 32 }).notNull(),

    certificateType: volunteerCertificateTypeEnum('certificate_type').notNull().default('service'),
    title: varchar('title', { length: 240 }).notNull(),

    /** Frozen at issue, from verified attendance only. */
    hoursCredited: integer('hours_credited').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),

    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    issuedBy: uuid('issued_by').references(() => users.id, { onDelete: 'set null' }),

    status: volunteerCertificateStatusEnum('status').notNull().default('issued'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('volunteer_certificates_number_unique').on(table.certificateNumber),
    uniqueIndex('volunteer_certificates_code_unique').on(table.verificationCode),
    index('volunteer_certificates_volunteer_idx').on(table.volunteerId, table.issuedAt),
    check('volunteer_certificates_hours_positive', sql`hours_credited > 0`),
    check('volunteer_certificates_period_ordered', sql`period_end >= period_start`),
  ],
);

export type VolunteerApplication = typeof volunteerApplications.$inferSelect;
export type VolunteerAssignment = typeof volunteerAssignments.$inferSelect;
export type VolunteerAttendance = typeof volunteerAttendance.$inferSelect;
export type VolunteerCertificate = typeof volunteerCertificates.$inferSelect;
