import { z } from 'zod';

/**
 * The four site settings, and what each is actually for.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE KEYS ARE A CLOSED SET.
 *
 * `settings` is a key/value table, so an update route that took an arbitrary
 * key would let anybody invent settings nothing reads — a table slowly filling
 * with rows that look meaningful and govern nothing. Every key below exists in
 * the seed, and adding one is a deliberate edit here plus a consumer.
 *
 * Each value is validated against its own shape rather than accepted as
 * whatever JSON arrives: the column is `jsonb`, so without this a number
 * setting could hold a string and the code reading it would fail far away from
 * the edit that caused it.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const SETTING_KEYS = [
  'organization_name',
  'registration_details',
  'donation_minimum_paise',
  'fcra_enabled',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/**
 * Statutory identifiers, exactly the four the seed defines.
 *
 * `.strict()` so a typo becomes an error rather than a fifth field nothing
 * reads. Null means "not supplied yet", which is the launch-blocking state the
 * seed describes — an empty string would read as "supplied, and blank".
 */
const registrationDetailsSchema = z
  .object({
    registrationNumber: z.string().trim().max(120).nullable(),
    pan: z
      .string()
      .trim()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'A PAN looks like AAAAA9999A')
      .nullable(),
    section12A: z.string().trim().max(120).nullable(),
    section80G: z.string().trim().max(120).nullable(),
  })
  .strict();

export const settingValueSchemas = {
  organization_name: z
    .string()
    .trim()
    .min(1, 'The organisation name cannot be empty')
    .max(200)
    // It goes on receipts and in email. A name that is only whitespace would
    // produce a receipt from nobody.
    .refine((value) => value.trim().length > 0, 'The organisation name cannot be empty'),

  registration_details: registrationDetailsSchema,

  /*
    Paise, as an integer (decision A2). Money is never a float anywhere in this
    system, and a minimum expressed in rupees would be the one place it was.
  */
  donation_minimum_paise: z
    .number()
    .int('Must be a whole number of paise')
    .min(0, 'Cannot be negative')
    .max(10_000_000, 'A minimum above ₹1,00,000 would refuse almost every donation'),

  fcra_enabled: z.boolean(),
} as const;

export const updateSettingsSchema = z
  .object({
    organization_name: settingValueSchemas.organization_name.optional(),
    registration_details: settingValueSchemas.registration_details.optional(),
    donation_minimum_paise: settingValueSchemas.donation_minimum_paise.optional(),
    fcra_enabled: settingValueSchemas.fcra_enabled.optional(),
    /** Recorded on the audit row. Who changed it is not the same as why. */
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict()
  .refine((value) => SETTING_KEYS.some((key) => value[key] !== undefined), 'Nothing to update');

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
