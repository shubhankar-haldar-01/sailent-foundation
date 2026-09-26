import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

export const adminDonorListQuerySchema = paginationQuerySchema.extend({
  /** Donors with at least one confirmed donation, or all records. */
  hasDonated: z.enum(['true', 'false', 'all']).default('all'),
});

export type AdminDonorListQuery = z.infer<typeof adminDonorListQuerySchema>;

export const donorIdParam = z.object({ id: z.string().uuid() });

/**
 * What staff may correct on a donor record.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A CORRECTION, NOT AN EDIT — AND CERTAINLY NOT A LEDGER.
 *
 * Finance can fix a misspelled name, a bounced email or a mistyped PAN, because
 * those are transcription errors that stop a receipt arriving or a Form 10BD
 * filing succeeding. What is absent is everything that would let a staff member
 * rewrite what happened:
 *
 *   totalDonated / donationCount / firstDonatedAt / lastDonatedAt
 *     Written only inside the payment-capture transaction (decision A6). An
 *     administrator who could set these could manufacture a giving history.
 *
 *   donorCode
 *     Assigned once and printed on receipts already issued.
 *
 *   phone
 *     The donor's sign-in identifier. Changing it hands somebody else the
 *     account, so it is a verified support operation and not a form field —
 *     for staff exactly as for the donor themselves.
 *
 * `.strict()`, so an attempt to send one of these is rejected rather than
 * quietly dropped.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const updateDonorSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(160).optional(),

    addressLine1: z.string().trim().max(160).optional(),
    addressLine2: z.string().trim().max(160).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    postalCode: z.string().trim().max(16).optional(),

    taxIdType: z
      .enum(['pan', 'aadhaar', 'passport', 'driving_licence', 'voter_id', 'foreign_tin'])
      .optional(),
    taxIdNumber: z
      .string()
      .trim()
      .max(32)
      .transform((value) => value.toUpperCase())
      .optional(),

    /** Staff-only. Never returned to the donor by any donor-facing route. */
    internalNotes: z.string().trim().max(4000).optional(),

    /**
     * MANDATORY, and it is the point of the endpoint.
     *
     * Correcting somebody else's record is the kind of act that gets questioned
     * a year later. A free-text sentence written at the time answers it better
     * than any category chosen from a list, and it goes straight into the audit
     * row.
     */
    reason: z.string().trim().min(5, 'Say why this record is being corrected').max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.taxIdNumber && !value.taxIdType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxIdType'],
        message: 'A tax id needs its type, or it cannot go on a Form 10BD export.',
      });
    }
  });

export type UpdateDonorInput = z.infer<typeof updateDonorSchema>;

// ---------------------------------------------------------------------------
// Swagger shapes
// ---------------------------------------------------------------------------

export class UpdateDonorDto {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional({ format: 'email' }) email?: string;
  @ApiPropertyOptional() addressLine1?: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional({
    enum: ['pan', 'aadhaar', 'passport', 'driving_licence', 'voter_id', 'foreign_tin'],
  })
  taxIdType?: string;
  @ApiPropertyOptional() taxIdNumber?: string;
  @ApiPropertyOptional({ description: 'Staff-only. Never shown to the donor.' })
  internalNotes?: string;
  @ApiPropertyOptional({ description: 'Required. Goes into the audit row.' }) reason?: string;
}
