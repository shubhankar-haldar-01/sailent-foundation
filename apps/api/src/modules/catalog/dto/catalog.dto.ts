import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Request schemas for programme and campaign administration.
 *
 * Two things every schema here has in common:
 *
 *   • System-controlled fields are ABSENT. `amountRaised`, `donorCount`,
 *     `beneficiariesReached`, `fulfilledQuantity` and `status` cannot be named
 *     in any request body, so Zod strips them before a handler ever sees them.
 *     That is the first of two barriers; the service allow-lists are the
 *     second.
 *
 *   • Money is an INTEGER COUNT OF PAISE (decision A2). Every monetary field is
 *     `z.number().int()`, so a decimal is a validation error rather than a
 *     silently truncated amount.
 */

export const uuidParam = z.object({ id: z.string().uuid('Not a valid id') });

export const campaignIdParam = z.object({
  campaignId: z.string().uuid('Not a valid campaign id'),
});

export const campaignChildParams = z.object({
  campaignId: z.string().uuid('Not a valid campaign id'),
  childId: z.string().uuid('Not a valid id'),
});

/** Paise. Integer, above zero — the database enforces the same rule. */
const positivePaise = z.number().int('Amounts are whole paise').positive('Must be above zero');

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

const titledList = z.array(
  z.object({ title: z.string().max(200), description: z.string().max(2000) }),
);

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

export const programListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'published', 'archived', 'all']).optional(),
  categoryId: z.string().uuid().optional(),
});

export const createProgramSchema = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  slug: slugField.optional(),
  tagline: z.string().trim().max(255).nullish(),
  shortDescription: z.string().trim().max(1000).nullish(),
  description: z.string().max(20_000).nullish(),
  problem: z.string().max(20_000).nullish(),
  approach: z.string().max(20_000).nullish(),
  beneficiaries: z.string().max(4000).nullish(),
  impactSummary: z.string().max(4000).nullish(),
  coverImage: z.string().max(1000).nullish(),
  accentIcon: z.enum(['book', 'heart', 'shield', 'sprout', 'briefcase', 'leaf', 'paw']).nullish(),
  categoryId: z.string().uuid().nullish(),
  goals: titledList.max(20).nullish(),
  activities: titledList.max(30).nullish(),
  metrics: z
    .array(
      z.object({
        label: z.string().max(120),
        value: z.number(),
        unit: z.string().max(24).optional(),
      }),
    )
    .max(12)
    .nullish(),
  locations: z
    .array(z.object({ district: z.string().max(120), state: z.string().max(120) }))
    .max(60)
    .nullish(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
  metaTitle: z.string().max(200).nullish(),
  metaDescription: z.string().max(400).nullish(),
});

export const updateProgramSchema = createProgramSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const programStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  reason: z.string().trim().max(500).optional(),
});

export const reorderSchema = z.object({
  order: z
    .array(z.object({ id: z.string().uuid(), displayOrder: z.number().int().min(0).max(9999) }))
    .min(1)
    .max(200),
});

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export const campaignListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(['draft', 'published', 'active', 'paused', 'completed', 'archived', 'all'])
    .optional(),
  categoryId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  state: z.string().max(120).optional(),
  startsAfter: z.coerce.date().optional(),
  endsBefore: z.coerce.date().optional(),
});

export const createCampaignSchema = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  slug: slugField.optional(),
  programId: z.string().uuid().nullish(),
  shortDescription: z.string().trim().max(1000).nullish(),
  description: z.string().max(40_000).nullish(),
  beneficiaryContext: z.string().max(4000).nullish(),
  coverImage: z.string().max(1000).nullish(),
  categoryId: z.string().uuid().nullish(),
  location: z.string().max(160).nullish(),
  state: z.string().max(120).nullish(),
  city: z.string().max(120).nullish(),
  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
  /** Paise, above zero. A goal of zero is an unpublishable campaign. */
  fundraisingGoal: positivePaise.optional(),
  beneficiaryTarget: z.number().int().nonnegative().nullish(),
  fundUtilization: z.string().max(8000).nullish(),
  stopAtGoal: z.boolean().optional(),
  allowCustomAmount: z.boolean().optional(),
  minDonationAmount: positivePaise.optional(),
  isFeatured: z.boolean().optional(),
  featuredOrder: z.number().int().min(0).max(9999).nullish(),
  impactNotes: z
    .array(
      z.object({
        label: z.string().max(120),
        value: z.number(),
        unit: z.string().max(24).optional(),
      }),
    )
    .max(12)
    .nullish(),
  /** Never rendered publicly — the content service strips it. */
  internalNotes: z.string().max(8000).nullish(),
  metaTitle: z.string().max(200).nullish(),
  metaDescription: z.string().max(400).nullish(),
});

export const updateCampaignSchema = createCampaignSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const campaignStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'active', 'paused', 'completed', 'archived']),
  reason: z.string().trim().max(500).optional(),
});

/** Pausing and completing always require a reason — see CampaignsService. */
export const reasonRequiredSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason').max(500),
});

export const optionalReasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Campaign products
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slugField.optional(),
  description: z.string().trim().min(1, 'Say what the donor is funding').max(2000),
  /** Paise, above zero — matched by a CHECK constraint. */
  price: positivePaise,
  image: z.string().max(1000).nullish(),
  targetQuantity: z.number().int().nonnegative().nullish(),
  maxPerDonation: z.number().int().positive().max(9999).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  sku: z.string().max(64).nullish(),
});

export const updateProductSchema = createProductSchema
  .omit({ slug: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/**
 * The separate, audited correction path for a fulfilled quantity.
 * A reason is mandatory: this edits a number that is meant to be a consequence
 * of donations received.
 */
export const adjustFulfilmentSchema = z.object({
  fulfilledQuantity: z.number().int().nonnegative(),
  reason: z.string().trim().min(3, 'Explain why this is being corrected').max(500),
});

// ---------------------------------------------------------------------------
// FAQs, gallery, updates
// ---------------------------------------------------------------------------

export const createFaqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(8000),
  displayOrder: z.number().int().min(0).max(9999).optional(),
  isPublished: z.boolean().optional(),
});

export const updateFaqSchema = createFaqSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/**
 * Add an image to a campaign gallery — FROM THE MEDIA LIBRARY (Phase 13).
 *
 * Until Phase 13 this took raw storage metadata (a key, a URL, a declared
 * type and size), which let a caller register an object no upload had ever
 * inspected. Now the image must already be a `media` row: uploaded through
 * `POST /admin/media`, its type sniffed from its bytes and its EXIF/GPS
 * removed. A public gallery item must use a public image.
 */
export const addGalleryItemSchema = z
  .object({
    mediaId: z.string().uuid('Choose an image from the media library'),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    visibility: z.enum(['public', 'private']).optional(),
  })
  .strict();

/** The whole gallery's order, first to last (Phase 13). */
export const reorderGallerySchema = z
  .object({
    ids: z
      .array(z.string().uuid())
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, 'Each image may appear once'),
  })
  .strict();

export const updateGalleryItemSchema = z
  .object({
    altText: z.string().trim().min(1).max(300).optional(),
    caption: z.string().trim().max(300).nullish(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    visibility: z.enum(['public', 'private']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const createUpdateSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(20_000),
  /** A date, not a timestamp: an update happened on a day. */
  impactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  location: z.string().max(160).nullish(),
  state: z.string().max(120).nullish(),
  metricType: z.string().max(48).nullish(),
  metricValue: z.number().int().nullish(),
  metricUnit: z.string().max(32).nullish(),
  /** Required before publishing when a metric is present (decision A14). */
  verificationMethod: z.string().max(2000).nullish(),
  statistics: z.record(z.unknown()).nullish(),
});

export const updateUpdateSchema = createUpdateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const publishFlagSchema = z.object({ published: z.boolean() });

/**
 * A progress update's status. `{ published }` is the original form; `{ status }`
 * (Phase 13) adds `archived` — the model's way to take an update down for
 * good, since updates are records and are not deleted.
 */
export const updateStatusSchema = z.union([
  publishFlagSchema.strict().transform((value) => ({
    status: value.published ? ('published' as const) : ('draft' as const),
  })),
  z.object({ status: z.enum(['draft', 'published', 'archived']) }).strict(),
]);

// ---------------------------------------------------------------------------
// Swagger shapes
// ---------------------------------------------------------------------------

export class CreateProgramDto {
  @ApiProperty({ example: 'Education' }) title!: string;
  @ApiPropertyOptional({ example: 'education' }) slug?: string;
  @ApiPropertyOptional() shortDescription?: string;
  @ApiPropertyOptional({ format: 'uuid' }) categoryId?: string;
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'School kits for 500 children' }) title!: string;
  @ApiPropertyOptional({ format: 'uuid' }) programId?: string;
  @ApiPropertyOptional({ example: 45000000, description: 'Paise. ₹4,50,000 is 45000000.' })
  fundraisingGoal?: number;
  @ApiPropertyOptional({ format: 'uuid' }) categoryId?: string;
}

export class StatusChangeDto {
  @ApiProperty({ enum: ['draft', 'published', 'active', 'paused', 'completed', 'archived'] })
  status!: string;
  @ApiPropertyOptional({ example: 'Operations temporarily paused.' }) reason?: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'School Kit' }) name!: string;
  @ApiProperty({ example: 'Notebooks, stationery, a bag and two uniforms.' }) description!: string;
  @ApiProperty({ example: 90000, description: 'Paise. ₹900 is 90000.' }) price!: number;
  @ApiPropertyOptional({ example: 500 }) targetQuantity?: number;
}
