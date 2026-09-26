import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Request schemas for impact records.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DECISION A14 IS ENFORCED HERE AND AT THE PUBLISH TRANSITION.
 *
 * "Every public statistic must trace to a database aggregate or a dated,
 * sourced impact record." These ARE the sourced records, so the date is
 * mandatory on every one and the metric cannot be negative. The source itself —
 * `verificationMethod` — is required at publication rather than at save, so a
 * draft can be written before the count has been checked.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const impactIdParam = z.object({ id: z.string().uuid('Not a valid id') });

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

/** A calendar date, not an instant. An impact is reported for a day. */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in the form 2026-11-04')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a real date');

const statisticsList = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(120),
      value: z.number().finite(),
      unit: z.string().trim().max(32).optional(),
    }),
  )
  .max(20);

const mediaList = z
  .array(
    z.object({
      seed: z.string().trim().max(120).optional(),
      url: z.string().trim().max(1000).optional(),
      alt: z.string().trim().min(1).max(300),
      caption: z.string().trim().max(300).optional(),
    }),
  )
  .max(40);

export const impactListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'published', 'archived', 'all']).optional(),
  programId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  metricType: z.string().trim().max(48).optional(),
});

const impactFields = {
  title: z.string().trim().min(1, 'A title is required').max(240),
  slug: slugField.optional(),
  description: z.string().trim().min(1, 'A description is required').max(20_000),
  coverImage: z.string().trim().max(1000).nullish(),

  /**
   * At least one parent. Checked again by the database — Phase 9's migration
   * `0013` widened `impact_updates_has_parent` to admit an event, so a medical
   * camp's own figures need not be filed against a campaign that did not
   * produce them.
   */
  campaignId: z.string().uuid().nullish(),
  programId: z.string().uuid().nullish(),
  eventId: z.string().uuid().nullish(),

  images: mediaList.nullish(),
  videos: mediaList.nullish(),
  documents: mediaList.nullish(),

  location: z.string().trim().max(160).nullish(),
  state: z.string().trim().max(120).nullish(),

  impactDate: calendarDate,

  statistics: statisticsList.nullish(),
  metricType: z.string().trim().max(48).nullish(),
  metricValue: z.number().int('A whole number').min(0, 'Cannot be negative').nullish(),
  metricUnit: z.string().trim().max(32).nullish(),

  verificationMethod: z.string().trim().max(4000).nullish(),
};

function refineParent<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (value: Record<string, unknown>) =>
      Boolean(value.campaignId) || Boolean(value.programId) || Boolean(value.eventId),
    {
      message:
        'Attach this to a campaign, a programme or an event — an unattributed figure is not a claim.',
      path: ['campaignId'],
    },
  );
}

export const createImpactSchema = refineParent(z.object(impactFields).strict());

/**
 * Update accepts a partial, and the parent rule is checked in the SERVICE
 * rather than here.
 *
 * A patch that sends only `title` cannot be judged against the parent rule in
 * isolation — the parent it needs is already on the stored row. Enforcing it
 * here would refuse every partial edit that did not resend a parent id.
 */
export const updateImpactSchema = z
  .object({ ...impactFields, impactDate: calendarDate.optional() })
  .strict()
  .partial();

export const impactStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  reason: z.string().trim().max(500).optional(),
});

export class CreateImpactUpdateDto {
  @ApiProperty({ example: 'Reading corners installed across fourteen schools' })
  title!: string;

  @ApiProperty({ example: 'Fourteen classrooms received a reading corner…' })
  description!: string;

  @ApiProperty({ example: '2026-08-31', description: 'The day being reported on' })
  impactDate!: string;

  @ApiPropertyOptional({ example: 'children_reached' })
  metricType?: string;

  @ApiPropertyOptional({ example: 1240, minimum: 0 })
  metricValue?: number;

  @ApiPropertyOptional({
    example: 'Headcount from school attendance registers, countersigned by each head teacher.',
    description: 'Required before publication whenever a figure is claimed (decision A14).',
  })
  verificationMethod?: string;
}

export type CreateImpactInput = z.infer<typeof createImpactSchema>;
export type UpdateImpactInput = z.infer<typeof updateImpactSchema>;
export type ImpactListQuery = z.infer<typeof impactListQuerySchema>;
