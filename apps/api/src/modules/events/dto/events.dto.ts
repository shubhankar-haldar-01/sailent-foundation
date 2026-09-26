import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Request schemas for event administration and registration.
 *
 * The same two rules the catalogue schemas follow:
 *
 *   • System-controlled fields are ABSENT. `registeredCount`, `waitlistCount`,
 *     `status`, `registrationStatus` and `publishedAt` cannot be named in any
 *     body here, so Zod strips them before a handler sees them. Counters move
 *     only inside the registration transaction that earns the change.
 *
 *   • Dates arrive as ISO-8601 strings and are coerced once, here. A handler
 *     that receives a `Date` never has to wonder whether it got a string.
 */

export const eventIdParam = z.object({ id: z.string().uuid('Not a valid event id') });

export const registrationParams = z.object({
  id: z.string().uuid('Not a valid event id'),
  registrationId: z.string().uuid('Not a valid registration id'),
});

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

/**
 * An ISO-8601 instant.
 *
 * `z.coerce.date()` accepts anything `new Date()` accepts, which includes
 * `"tomorrow"`-shaped junk that becomes `Invalid Date` and then a Postgres
 * error at insert time. This refuses it at the edge instead.
 */
const instant = z
  .string()
  .datetime({ offset: true, message: 'Use an ISO-8601 timestamp, e.g. 2026-11-04T09:30:00+05:30' })
  .transform((value) => new Date(value));

const scheduleList = z
  .array(
    z.object({
      time: z.string().trim().min(1).max(40),
      activity: z.string().trim().min(1).max(300),
    }),
  )
  .max(40);

const galleryList = z
  .array(
    z.object({
      seed: z.string().trim().min(1).max(120),
      alt: z.string().trim().min(1).max(300),
      caption: z.string().trim().max(300).optional(),
      url: z.string().trim().max(1000).optional(),
    }),
  )
  .max(60);

// ---------------------------------------------------------------------------
// Admin: events
// ---------------------------------------------------------------------------

export const eventListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'published', 'archived', 'all']).optional(),
  lifecycle: z.enum(['open', 'closed', 'full', 'cancelled', 'completed']).optional(),
  when: z.enum(['upcoming', 'past']).optional(),
  programId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
});

const eventFields = {
  title: z.string().trim().min(1, 'A title is required').max(240),
  slug: slugField.optional(),
  summary: z.string().trim().max(1000).nullish(),
  description: z.string().max(20_000).nullish(),
  coverImage: z.string().trim().max(1000).nullish(),

  startDate: instant,
  endDate: instant.nullish(),
  timezone: z.string().trim().max(64).optional(),

  venueName: z.string().trim().max(200).nullish(),
  location: z.string().trim().max(255).nullish(),
  address: z.string().trim().max(2000).nullish(),
  city: z.string().trim().max(120).nullish(),
  state: z.string().trim().max(120).nullish(),
  isOnline: z.boolean().optional(),
  /** PRIVATE. Never returned by a public endpoint; see `ContentService`. */
  meetingUrl: z.string().trim().max(1000).nullish(),

  schedule: scheduleList.nullish(),
  gallery: galleryList.nullish(),

  /** NULL is uncapped. Zero is a legitimate cap — an event nobody may join. */
  capacity: z.number().int('Capacity is a whole number').min(0).max(1_000_000).nullish(),
  registrationDeadline: instant.nullish(),
  organizer: z.string().trim().max(200).nullish(),

  programId: z.string().uuid().nullish(),
  campaignId: z.string().uuid().nullish(),
  requiresVolunteers: z.boolean().optional(),
  volunteerSlots: z.number().int().min(0).max(100_000).nullish(),
};

/**
 * The end must not precede the start, and registration must not close after it.
 *
 * `events_dates_ordered` enforces the first in the database too. It is checked
 * here as well so the operator gets a field-level message rather than a
 * constraint violation, and there so it is true of every row however written.
 */
function refineDates<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (value: Record<string, unknown>) => {
        const start = value.startDate as Date | undefined;
        const end = value.endDate as Date | null | undefined;
        return !start || !end || end.getTime() >= start.getTime();
      },
      { message: 'The end must not be before the start.', path: ['endDate'] },
    )
    .refine(
      (value: Record<string, unknown>) => {
        const start = value.startDate as Date | undefined;
        const deadline = value.registrationDeadline as Date | null | undefined;
        return !start || !deadline || deadline.getTime() <= start.getTime();
      },
      {
        message: 'Registration cannot close after the event has started.',
        path: ['registrationDeadline'],
      },
    );
}

export const createEventSchema = refineDates(z.object(eventFields).strict());

export const updateEventSchema = refineDates(
  z
    .object({ ...eventFields, startDate: instant.optional() })
    .strict()
    .partial(),
);

export const eventPublishSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  reason: z.string().trim().max(500).optional(),
});

export const eventLifecycleSchema = z.object({
  lifecycle: z.enum(['open', 'closed', 'full', 'cancelled', 'completed']),
  /**
   * Required for a cancellation, because it is quoted to every registrant.
   *
   * An email that says only "this event has been cancelled" produces a hundred
   * replies asking why.
   */
  reason: z.string().trim().max(500).optional(),
});

export const registrationListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(['registered', 'waitlisted', 'confirmed', 'attended', 'no_show', 'cancelled', 'all'])
    .optional(),
});

export const attendanceSchema = z.object({
  entries: z
    .array(
      z.object({
        registrationId: z.string().uuid(),
        /** Only these two. See ATTENDANCE_OUTCOMES for why. */
        status: z.enum(['attended', 'no_show']),
      }),
    )
    .min(1, 'Mark at least one attendee')
    .max(500),
});

// ---------------------------------------------------------------------------
// Donor: registration
// ---------------------------------------------------------------------------

/**
 * What a donor supplies when registering.
 *
 * NO EMAIL FIELD. The address is read from the signed-in donor's record
 * server-side: it is the unique key on `event_registrations`, so accepting one
 * from the body would let a donor register under somebody else's address and
 * lock the real owner out of the event.
 *
 * Name and phone ARE accepted, because the attendee is not always the account
 * holder in the way the name on file suggests — "Priya Sharma" registering as
 * "Priya Sharma (Aarav's mother)" is a legitimate thing to want — and because
 * the phone on the donor record may be a landline the organiser cannot use on
 * the day. Both default to the donor record when omitted.
 */
export const registerForEventSchema = z
  .object({
    fullName: z.string().trim().min(2, 'A name is required').max(200).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(\+91[-\s]?)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number')
      .optional(),
    attendeeCount: z
      .number()
      .int('A whole number of people')
      .min(1, 'At least one person')
      .max(20, 'For groups larger than 20, contact the organiser')
      .optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const cancelRegistrationSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const myEventsQuerySchema = paginationQuerySchema.extend({
  when: z.enum(['upcoming', 'past']).optional(),
});

// ---------------------------------------------------------------------------
// Swagger shapes
// ---------------------------------------------------------------------------

export class CreateEventDto {
  @ApiProperty({ example: 'Community health camp, Ward 12' })
  title!: string;

  @ApiPropertyOptional({ example: 'community-health-camp-ward-12' })
  slug?: string;

  @ApiProperty({ example: '2026-11-04T09:30:00+05:30', description: 'ISO-8601 with an offset' })
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-11-04T16:00:00+05:30' })
  endDate?: string;

  @ApiPropertyOptional({
    example: 120,
    description: 'Seats. Omit or null for uncapped. Enforced under a row lock at registration.',
  })
  capacity?: number;

  @ApiPropertyOptional({
    example: '2026-11-02T23:59:59+05:30',
    description: 'When registration shuts. Defaults to the event start.',
  })
  registrationDeadline?: string;

  @ApiPropertyOptional({ example: 'Sailent Foundation, with Ward 12 Health Committee' })
  organizer?: string;
}

export class RegisterForEventDto {
  @ApiPropertyOptional({
    example: 'Priya Sharma',
    description: 'Defaults to the name on the donor record.',
  })
  fullName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  phone?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 20 })
  attendeeCount?: number;
}

export class AttendanceDto {
  @ApiProperty({
    description: 'One entry per attendee. Absent registrations are left untouched.',
    example: [{ registrationId: '…', status: 'attended' }],
  })
  entries!: { registrationId: string; status: 'attended' | 'no_show' }[];
}

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventListQuery = z.infer<typeof eventListQuerySchema>;
export type RegisterForEventInput = z.infer<typeof registerForEventSchema>;
export type RegistrationListQuery = z.infer<typeof registrationListQuerySchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type MyEventsQuery = z.infer<typeof myEventsQuerySchema>;
