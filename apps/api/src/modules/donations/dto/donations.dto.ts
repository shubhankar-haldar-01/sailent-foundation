import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Request schemas for donations and payments.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTE WHAT IS ABSENT FROM `createDonationSchema`.
 *
 * There is no price, no subtotal, no total, no currency and no campaign status.
 * Those are not validated-then-ignored — they cannot be expressed. Zod strips
 * unknown keys, so a request carrying `"total": 100` is parsed into an object
 * that has never heard of it, and the handler could not read it if it tried.
 *
 * That is the first of two barriers. The second is `DonationsService`, which
 * reads every price from the database. Both exist because a single barrier on
 * the most valuable endpoint in the system is not enough.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Paise. Integer, matching the database's CHECK constraints. */
const paise = z.number().int('Amounts are whole paise').nonnegative();

const slugParam = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a valid campaign URL');

export const donationReferenceParam = z.object({
  reference: z
    .string()
    .trim()
    .min(4)
    .max(24)
    .regex(/^[A-Z0-9-]+$/i, 'Not a valid donation reference'),
});

export const donationIdParam = z.object({ id: z.string().uuid('Not a valid donation id') });

/**
 * Donor details.
 *
 * Name, email and phone only. NO tax id: a PAN is collected later, in the
 * Form 10BD flow, by a donor who has chosen to claim a deduction — asking for
 * one at checkout adds a sensitive field to the highest-abandonment step of the
 * funnel for a benefit most donors will not use (decision A7).
 */
const donorSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(200),
  email: z.string().trim().email('Enter a valid email address').max(255),
  /**
   * Indian mobile, normalised by the frontend before it arrives. Kept strict
   * here because it is the donor DEDUPLICATION KEY — a loose rule creates a
   * second donor record for the same person and splits their giving history.
   */
  phone: z
    .string()
    .trim()
    .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number'),
  anonymous: z.boolean().optional(),
  message: z.string().trim().max(1000).optional(),
});

export const createDonationSchema = z.object({
  campaignSlug: slugParam,
  items: z
    .array(
      z.object({
        campaignProductId: z.string().uuid('Not a valid item'),
        quantity: z
          .number()
          .int('Choose a whole number of items')
          .positive('Choose at least one')
          // A ceiling here as well as per-offering: it stops a nonsense
          // quantity reaching the arithmetic at all.
          .max(9999, 'That quantity is too large'),
      }),
    )
    .max(50, 'That is too many different items for one donation')
    .default([]),
  /** Paise, on top of any products. Zero or absent for a pure product donation. */
  customAmount: paise
    .max(100_000_000, 'That amount looks wrong — check the number of zeroes')
    .optional(),
  donor: donorSchema,
});

/**
 * What Razorpay Checkout hands back to the browser.
 *
 * Every field is verified server-side before anything is recorded — see
 * `PaymentVerificationService`. This schema only checks that the shape is
 * plausible enough to be worth verifying.
 */
export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(4).max(128),
  razorpayPaymentId: z.string().trim().min(4).max(128),
  razorpaySignature: z.string().trim().min(16).max(256),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminDonationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['pending', 'processing', 'successful', 'failed', 'cancelled', 'all']).optional(),
  campaignId: z.string().uuid().optional(),
  donorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: paise.optional(),
});

// ---------------------------------------------------------------------------
// Swagger shapes
// ---------------------------------------------------------------------------

export class DonorDetailsDto {
  @ApiProperty({ example: 'A Donor' }) name!: string;
  @ApiProperty({ example: 'donor@example.com' }) email!: string;
  @ApiProperty({
    example: '9876543210',
    description: 'Indian mobile. The donor deduplication key.',
  })
  phone!: string;
  @ApiPropertyOptional({ description: 'Hides the donor from PUBLIC display only.' })
  anonymous?: boolean;
  @ApiPropertyOptional() message?: string;
}

export class CreateDonationDto {
  @ApiProperty({ example: 'school-kits-jharkhand' }) campaignSlug!: string;
  @ApiPropertyOptional({
    isArray: true,
    description: 'Campaign-product ids and quantities. Prices are read server-side.',
    example: [{ campaignProductId: '…uuid…', quantity: 2 }],
  })
  items?: { campaignProductId: string; quantity: number }[];
  @ApiPropertyOptional({
    example: 50000,
    description: 'Paise on top of the products. ₹500 is 50000.',
  })
  customAmount?: number;
  /*
    Declared as a nested class rather than `type: 'object'`, which Swagger's
    typings reject without an `additionalProperties`. A named shape documents
    the three fields properly in the generated spec anyway.
  */
  @ApiProperty({ type: () => DonorDetailsDto })
  donor!: DonorDetailsDto;
}

export class VerifyPaymentDto {
  @ApiProperty({ example: 'order_Nxxxxxxxxxxxxx' }) razorpayOrderId!: string;
  @ApiProperty({ example: 'pay_Nxxxxxxxxxxxxx' }) razorpayPaymentId!: string;
  @ApiProperty({ description: 'HMAC-SHA256 of orderId|paymentId, from Checkout.' })
  razorpaySignature!: string;
}
