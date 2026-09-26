import { z } from 'zod';

/**
 * Donor tax identity (decision A7).
 *
 * Required for the annual Form 10BD statement. PAN is preferred; the
 * alternatives are what the statement accepts. The ID TYPE is stored
 * alongside the number so the export can declare it.
 *
 * Capture is always OPTIONAL at checkout — demanding a PAN before payment
 * destroys conversion. It is requested afterwards.
 */

export const taxIdTypeSchema = z.enum([
  'pan',
  'aadhaar',
  'passport',
  'driving_licence',
  'voter_id',
  'foreign_tin',
]);

export type TaxIdType = z.infer<typeof taxIdTypeSchema>;

/** PAN: five letters, four digits, one letter. */
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN, for example ABCDE1234F');

export const taxIdSchema = z
  .object({
    type: taxIdTypeSchema,
    number: z.string().trim().min(1, 'Enter the identification number').max(64),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'pan') {
      const result = panSchema.safeParse(value.number);
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['number'],
          message: result.error.issues[0]?.message ?? 'Enter a valid PAN',
        });
      }
    }
  });
