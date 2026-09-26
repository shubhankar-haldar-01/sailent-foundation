import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Request schemas for the product catalogue and campaign offerings.
 *
 * Two things every schema here has in common with the rest of the API:
 *
 *   • System-controlled fields are ABSENT. `providedQuantity`, `status` and
 *     every derived counter cannot be named in any request body, so Zod strips
 *     them before a handler sees them. That is the first of two barriers; the
 *     service allow-lists are the second.
 *
 *   • Money is an INTEGER COUNT OF PAISE (decision A2). Every monetary field is
 *     `z.number().int()`, so a decimal is a validation error rather than a
 *     silently truncated amount. ₹900 is 90000.
 */

export const productIdParam = z.object({ id: z.string().uuid('Not a valid product id') });

export const campaignProductParams = z.object({
  campaignId: z.string().uuid('Not a valid campaign id'),
  productId: z.string().uuid('Not a valid id'),
});

export const campaignIdOnlyParam = z.object({
  campaignId: z.string().uuid('Not a valid campaign id'),
});

export const campaignSlugParam = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a valid campaign URL'),
});

/** Paise. Integer, above zero — the database enforces the same rule. */
const positivePaise = z
  .number()
  .int('Amounts are whole paise')
  .positive('Must be above zero')
  // ₹10,00,000 per unit. Not a business rule so much as a typo catcher: a
  // price three digits too long is a donor charged a hundred times over.
  .max(100_000_000, 'That price looks wrong — check the number of zeroes');

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const productListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'archived', 'all']).optional(),
  /**
   * Powers the "add a product" picker: list what this campaign does NOT yet
   * offer, so the operator cannot pick a duplicate in the first place.
   */
  notInCampaignId: z.string().uuid().optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(160),
  slug: slugField.optional(),
  description: z.string().trim().min(1, 'Say what the donor is funding').max(2000),
  image: z.string().max(1000).nullish(),
  /**
   * The SUGGESTED price, in paise. Copied onto a campaign when the product is
   * added there, and never read again — see ProductsService.
   */
  defaultPrice: positivePaise,
  /** What one of these is: "kit", "day", "meal". Shown as "₹900 per kit". */
  unit: z.string().trim().min(1).max(40).optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const productStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'archived']),
  reason: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Campaign offerings
// ---------------------------------------------------------------------------

export const addCampaignProductSchema = z.object({
  /**
   * An EXISTING catalogue product. There is no name or description here, and
   * that absence is the design: this endpoint cannot create a product, so it
   * cannot create a duplicate one.
   */
  productId: z.string().uuid('Choose a product from the catalogue'),
  /** Paise. Omitted means "use the catalogue default", copied at this moment. */
  price: positivePaise.optional(),
  targetQuantity: z.number().int().nonnegative().max(1_000_000).nullish(),
  maxPerDonation: z.number().int().positive().max(9999).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const updateCampaignProductSchema = addCampaignProductSchema
  .omit({ productId: true })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/**
 * The separate, audited correction path for a provided quantity.
 * A reason is mandatory: this edits a number that is meant to be a consequence
 * of donations received.
 */
export const adjustProvidedSchema = z.object({
  providedQuantity: z.number().int().nonnegative().max(1_000_000),
  reason: z.string().trim().min(3, 'Explain why this is being corrected').max(500),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const optionalReasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const reorderCampaignProductsSchema = z.object({
  order: z
    .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(9999) }))
    .min(1)
    .max(200),
});

// ---------------------------------------------------------------------------
// Swagger shapes
// ---------------------------------------------------------------------------

export class CreateProductDto {
  @ApiProperty({ example: 'School Kit' }) name!: string;
  @ApiPropertyOptional({ example: 'school-kit' }) slug?: string;
  @ApiProperty({ example: 'Notebooks, stationery, a bag and two uniforms.' }) description!: string;
  @ApiProperty({ example: 90000, description: 'Paise. ₹900 is 90000.' }) defaultPrice!: number;
  @ApiPropertyOptional({ example: 'kit' }) unit?: string;
}

export class AddCampaignProductDto {
  @ApiProperty({ format: 'uuid', description: 'An existing catalogue product.' })
  productId!: string;
  @ApiPropertyOptional({
    example: 95000,
    description: 'Paise. Omit to copy the catalogue default at this moment.',
  })
  price?: number;
  @ApiPropertyOptional({ example: 500 }) targetQuantity?: number;
}

export class ProductStatusDto {
  @ApiProperty({ enum: ['active', 'inactive', 'archived'] }) status!: string;
  @ApiPropertyOptional({ example: 'No longer distributed after the 2026 programme review.' })
  reason?: string;
}
