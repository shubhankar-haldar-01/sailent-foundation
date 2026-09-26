import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * What a donor is allowed to send about themselves.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS AN ALLOW-LIST, AND THAT IS THE WHOLE SECURITY MODEL OF THIS FILE.
 *
 * A donor may edit how we address them and where we write to them. Everything
 * else about a donor row is either derived from their giving or is the identity
 * they sign in with, and neither is theirs to set by sending JSON:
 *
 *   donorCode          assigned once, and quoted on receipts
 *   totalDonated       written only inside the payment-capture transaction (A6)
 *   donationCount      same
 *   firstDonatedAt     same
 *   lastDonatedAt      same
 *   internalNotes      staff-only, never shown to the donor at all
 *   source             attribution, recorded at the point of giving
 *
 * `.strict()` is what makes the list real: an unknown key is REJECTED rather
 * than ignored, so an attempt to set `totalDonated` fails loudly in the test
 * suite instead of silently doing nothing until the day someone refactors the
 * update to spread its input.
 *
 * PHONE IS ABSENT ON PURPOSE. It is the login identifier: a donor who could
 * change their own phone number could point their account at a number they
 * control and then hand the old one back. Changing it is a support operation
 * with identity checks, not a form field.
 * ══════════════════════════════════════════════════════════════════════════
 */
const baseProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(160).optional(),

    addressLine1: z.string().trim().max(160).optional(),
    addressLine2: z.string().trim().max(160).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    postalCode: z.string().trim().max(16).optional(),

    /**
     * PAN, for the annual Form 10BD filing.
     *
     * Editable because it is the donor's own tax identity and a typo in it is
     * the difference between receiving Form 10BE and not. Normalised upper-case
     * because the Income Tax Department's format is upper-case and a lower-case
     * copy would fail the filing for a reason nobody would find.
     */
    taxIdType: z
      .enum(['pan', 'aadhaar', 'passport', 'driving_licence', 'voter_id', 'foreign_tin'])
      .optional(),
    taxIdNumber: z
      .string()
      .trim()
      .max(32)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .strict();

/**
 * A tax id and its type move together, or not at all.
 *
 * `donors_tax_id_type_required` says the same thing in the database: a number
 * without a type cannot appear on a Form 10BD export, so it is refused. Without
 * this refinement the constraint is still the thing that stops it — but it
 * stops it as a 500 from Postgres, several layers below anything that could
 * explain what went wrong. Saying it here turns that into a 422 that names the
 * missing field.
 *
 * Only ADDING a number needs a type. Sending a type on its own is harmless, and
 * a donor correcting `passport` to `pan` without retyping the number is a
 * reasonable thing to do.
 */
export const updateProfileSchema = baseProfileSchema.superRefine((value, ctx) => {
  if (value.taxIdNumber && !value.taxIdType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['taxIdType'],
      message: 'Say which kind of identification this is — PAN, Aadhaar, passport and so on.',
    });
  }
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Notification and visibility preferences.
 *
 * Split from the profile because they answer a different question and because
 * the settings screen saves them on their own. Also `.strict()`.
 *
 * `isAnonymous` lives here rather than in the profile: it is a choice about
 * what the PUBLIC sees, not a fact about the donor. Finance can always identify
 * a donor regardless — an anonymous gift is anonymous on the campaign page, not
 * in the books, and the settings copy says so.
 */
export const updateSettingsSchema = z
  .object({
    communicationConsent: z.boolean().optional(),
    emailOptIn: z.boolean().optional(),
    smsOptIn: z.boolean().optional(),
    whatsappOptIn: z.boolean().optional(),

    notifyCampaignUpdates: z.boolean().optional(),
    notifyImpactUpdates: z.boolean().optional(),
    notifyNewsletter: z.boolean().optional(),

    isAnonymous: z.boolean().optional(),
  })
  .strict();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * The donation history filter.
 *
 * NO `donorId`. A donor's history is scoped by the session, never by a
 * parameter — accepting one would mean the difference between reading your own
 * giving and reading somebody else's was a value in a query string.
 */
export const myDonationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['pending', 'processing', 'successful', 'failed', 'cancelled', 'all']).optional(),
  campaignId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type MyDonationsQuery = z.infer<typeof myDonationsQuerySchema>;

export const donationIdParam = z.object({ id: z.string().uuid() });
export const campaignIdParam = z.object({ campaignId: z.string().uuid() });

export const saveCampaignSchema = z.object({ campaignId: z.string().uuid() }).strict();

// ---------------------------------------------------------------------------
// Swagger shapes
// ---------------------------------------------------------------------------

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 80 }) firstName?: string;
  @ApiPropertyOptional({ maxLength: 80 }) lastName?: string;
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
  @ApiPropertyOptional({ description: 'Stored upper-case.' }) taxIdNumber?: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional() communicationConsent?: boolean;
  @ApiPropertyOptional() emailOptIn?: boolean;
  @ApiPropertyOptional() smsOptIn?: boolean;
  @ApiPropertyOptional() whatsappOptIn?: boolean;
  @ApiPropertyOptional({ description: 'News from campaigns this donor has funded.' })
  notifyCampaignUpdates?: boolean;
  @ApiPropertyOptional({ description: 'Verified impact reports.' })
  notifyImpactUpdates?: boolean;
  @ApiPropertyOptional({ description: 'General newsletter. Off unless switched on.' })
  notifyNewsletter?: boolean;
  @ApiPropertyOptional({ description: 'Hide this donor from public donor lists.' })
  isAnonymous?: boolean;
}

export class SaveCampaignDto {
  @ApiProperty({ format: 'uuid' }) campaignId!: string;
}
