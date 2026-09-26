import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Request schemas for volunteer management.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE APPLICATION SCHEMA IS THE PUBLIC ATTACK SURFACE.
 *
 * `POST /volunteers/apply` is unauthenticated — it has to be, since applying is
 * how somebody first appears. So every field is bounded, the arrays are capped,
 * and `.strict()` rejects unknown keys rather than ignoring them.
 *
 * `status`, `volunteerId`, `totalHours`, `verifiedHours`, `statusReason` and
 * `internalNotes` appear in NO write schema here. They are system- or
 * admin-controlled, and the way they stay that way is by having no syntax in
 * which a client can name them.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const volunteerIdParam = z.object({ id: z.string().uuid('Not a valid id') });

export const assignmentParams = z.object({
  id: z.string().uuid('Not a valid volunteer id'),
  assignmentId: z.string().uuid('Not a valid assignment id'),
});

const phoneField = z
  .string()
  .trim()
  .regex(/^(\+91[-\s]?)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number');

const shortList = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max);

// ---------------------------------------------------------------------------
// Public: applying
// ---------------------------------------------------------------------------

export const applyAsVolunteerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'A name is required').max(120),
    lastName: z.string().trim().max(120).optional(),
    email: z.string().trim().email('Enter a valid email address').max(255),
    phone: phoneField,

    city: z.string().trim().max(120).optional(),
    state: z.string().trim().max(120).optional(),

    education: z.string().trim().max(255).optional(),
    occupation: z.string().trim().max(255).optional(),
    /** Free prose. Capped because it is written by an anonymous caller. */
    experience: z.string().trim().max(4000).optional(),

    languages: shortList(20).optional(),
    skills: shortList(30).optional(),
    interests: shortList(30).optional(),

    availability: z
      .object({
        days: z.string().trim().max(40).optional(),
        hours: z.string().trim().max(40).optional(),
        mode: z.string().trim().max(40).optional(),
      })
      .optional(),

    /**
     * Collected together or not at all.
     *
     * A name with no number cannot be rung, and a number with nobody attached
     * to it is worse — somebody will ring it in an emergency not knowing who
     * they are speaking to. The refinement below enforces the pairing.
     */
    emergencyContactName: z.string().trim().max(160).optional(),
    emergencyContactPhone: phoneField.optional(),
    emergencyContactRelation: z.string().trim().max(80).optional(),

    motivation: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.emergencyContactName) === Boolean(value.emergencyContactPhone), {
    message: 'Give both a name and a number for the emergency contact, or neither.',
    path: ['emergencyContactPhone'],
  });

// ---------------------------------------------------------------------------
// Admin: review
// ---------------------------------------------------------------------------

export const volunteerListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      'applied',
      'under_review',
      'approved',
      'active',
      'inactive',
      'suspended',
      'rejected',
      'archived',
      'all',
      'pending',
    ])
    .optional(),
  skill: z.string().trim().max(80).optional(),
});

export const reviewDecisionSchema = z
  .object({
    status: z.enum([
      'under_review',
      'approved',
      'active',
      'inactive',
      'suspended',
      'rejected',
      'archived',
    ]),
    /**
     * ADMIN-ONLY, always. Recorded against the application and the audit log,
     * and never returned on any volunteer-facing route.
     */
    reason: z.string().trim().max(1000).optional(),
    reviewNotes: z.string().trim().max(4000).optional(),
    /** Days before this person may apply again. Rejections only. */
    coolingPeriodDays: z.number().int().min(0).max(3650).optional(),
  })
  .strict();

export const updateVolunteerSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().max(120).nullish(),
    email: z.string().trim().email().max(255).nullish(),
    phone: phoneField,
    city: z.string().trim().max(120).nullish(),
    state: z.string().trim().max(120).nullish(),
    addressLine1: z.string().trim().max(255).nullish(),
    postalCode: z.string().trim().max(16).nullish(),
    education: z.string().trim().max(255).nullish(),
    occupation: z.string().trim().max(255).nullish(),
    experience: z.string().max(10_000).nullish(),
    languages: shortList(20).nullish(),
    skills: shortList(30).nullish(),
    interests: shortList(30).nullish(),
    emergencyContactName: z.string().trim().max(160).nullish(),
    emergencyContactPhone: phoneField.nullish(),
    emergencyContactRelation: z.string().trim().max(80).nullish(),
    /** ADMIN-ONLY. Invisible to the volunteer. */
    internalNotes: z.string().max(10_000).nullish(),
  })
  .strict()
  .partial();

/** What a volunteer may change about themselves. A much shorter list. */
export const updateMyVolunteerProfileSchema = z
  .object({
    phone: phoneField.optional(),
    city: z.string().trim().max(120).nullish(),
    state: z.string().trim().max(120).nullish(),
    occupation: z.string().trim().max(255).nullish(),
    languages: shortList(20).nullish(),
    skills: shortList(30).nullish(),
    interests: shortList(30).nullish(),
    emergencyContactName: z.string().trim().max(160).nullish(),
    emergencyContactPhone: phoneField.nullish(),
    emergencyContactRelation: z.string().trim().max(80).nullish(),
    availability: z
      .object({
        days: z.string().trim().max(40).optional(),
        hours: z.string().trim().max(40).optional(),
        mode: z.string().trim().max(40).optional(),
      })
      .nullish(),
  })
  .strict()
  .partial();

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const instant = z
  .string()
  .datetime({ offset: true, message: 'Use an ISO-8601 timestamp, e.g. 2026-11-04T09:30:00+05:30' })
  .transform((value) => new Date(value));

export const createAssignmentSchema = z
  .object({
    role: z.string().trim().min(1, 'Say what they will be doing').max(160),
    description: z.string().trim().max(4000).optional(),
    assignableType: z.enum(['event', 'campaign', 'program', 'general']).optional(),
    assignableId: z.string().uuid().nullish(),
    startsAt: instant,
    endsAt: instant.nullish(),
    location: z.string().trim().max(255).nullish(),
    expectedHours: z.number().int().min(0).max(24).nullish(),
    notes: z.string().trim().max(4000).nullish(),
  })
  .strict()
  .refine((value) => !value.endsAt || value.endsAt.getTime() >= value.startsAt.getTime(), {
    message: 'The assignment would end before it starts.',
    path: ['endsAt'],
  })
  .refine(
    (value) => value.assignableType === 'general' || !value.assignableType || value.assignableId,
    {
      message: 'Name what this attaches to, or leave the type as general.',
      path: ['assignableId'],
    },
  );

export const assignmentStatusSchema = z
  .object({
    status: z.enum(['assigned', 'confirmed', 'completed', 'cancelled', 'no_show']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in the form 2026-11-04')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a real date');

export const recordAttendanceSchema = z
  .object({
    date: calendarDate,
    /**
     * Minutes, not hours.
     *
     * Somebody who worked 90 minutes should not have to decide whether that is
     * "1" or "1.5" — and a float here becomes a rounding argument later, on a
     * figure that ends up printed on a certificate. Whole minutes have no such
     * ambiguity. The database caps it at 1440, because a day is 24 hours.
     */
    durationMinutes: z.number().int('Whole minutes').min(1, 'At least a minute').max(1440),
    checkInAt: instant.nullish(),
    checkOutAt: instant.nullish(),
    notes: z.string().trim().max(2000).nullish(),
    /**
     * Record and verify in one step.
     *
     * Convenient for an organiser marking a register they personally
     * supervised, and it is still a distinct decision — the default is false,
     * so unverified is what happens if nobody chooses.
     */
    verified: z.boolean().optional(),
  })
  .strict();

export const verifyAttendanceSchema = z
  .object({
    attendanceIds: z.array(z.string().uuid()).min(1, 'Nothing selected').max(200),
    verified: z.boolean(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

export const issueCertificateSchema = z
  .object({
    certificateType: z.enum(['participation', 'appreciation', 'completion', 'service']).optional(),
    title: z.string().trim().max(240).optional(),
    periodStart: calendarDate,
    periodEnd: calendarDate,
  })
  .strict()
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: 'The period ends before it starts.',
    path: ['periodEnd'],
  });

export const revokeCertificateSchema = z
  .object({
    reason: z.string().trim().min(1, 'Say why — it is the record of the decision').max(1000),
  })
  .strict();

export const verificationCodeParam = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{6,32}$/i, 'Not a valid verification code'),
});

// ---------------------------------------------------------------------------
// Swagger
// ---------------------------------------------------------------------------

export class ApplyAsVolunteerDto {
  @ApiProperty({ example: 'Priya' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  lastName?: string;

  @ApiProperty({ example: 'priya@example.com' })
  email!: string;

  @ApiProperty({ example: '9876543210' })
  phone!: string;

  @ApiPropertyOptional({ example: ['Teaching', 'First aid'] })
  skills?: string[];

  @ApiPropertyOptional({ example: ['Education', 'Healthcare'] })
  interests?: string[];
}

export class ReviewDecisionDto {
  @ApiProperty({ enum: ['under_review', 'approved', 'active', 'rejected', 'suspended'] })
  status!: string;

  @ApiPropertyOptional({
    description: 'ADMIN-ONLY. Recorded and audited; never shown to the applicant.',
  })
  reason?: string;
}

export class RecordAttendanceDto {
  @ApiProperty({ example: '2026-11-04' })
  date!: string;

  @ApiProperty({ example: 240, minimum: 1, maximum: 1440 })
  durationMinutes!: number;

  @ApiPropertyOptional({ description: 'Record and verify in one step.' })
  verified?: boolean;
}

export type ApplyAsVolunteerInput = z.infer<typeof applyAsVolunteerSchema>;
export type VolunteerListQuery = z.infer<typeof volunteerListQuerySchema>;
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
export type UpdateVolunteerInput = z.infer<typeof updateVolunteerSchema>;
export type UpdateMyVolunteerProfileInput = z.infer<typeof updateMyVolunteerProfileSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;
