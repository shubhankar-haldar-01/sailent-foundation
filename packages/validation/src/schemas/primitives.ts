import { z } from 'zod';

/**
 * Shared validation primitives.
 *
 * The SAME schema runs on the client (for fast, humane feedback) and on the
 * server (because the client cannot be trusted). One definition means the two
 * cannot disagree about what is valid — docs/security-architecture.md §5.
 */

export const uuidSchema = z.string().uuid('Must be a valid UUID');

/**
 * THE one spelling of an email address (Phase 12).
 *
 * Every comparison of an address — sign-in, sign-in codes, donor and volunteer
 * lookups, checkout, email changes, uniqueness — uses this, and so do the
 * unique indexes it must agree with (`lower(btrim(email))`, migrations `0011`
 * and `0018`). Unicode-normalised (NFC) first, so a composed and a decomposed
 * spelling of the same character are one address, then trimmed and
 * lower-cased. Two places with two rules is how a lookup misses a row the
 * index considers a duplicate.
 */
export function normaliseEmail(value: string): string {
  return value.normalize('NFC').trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(255);

/**
 * Indian mobile number. Donor identity is the phone number (decision A8),
 * so this is the deduplication key and must normalise consistently.
 * Accepts +91/0 prefixes and spacing; stores the bare 10 digits.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  /**
   * Strip a country or trunk prefix — but ONLY when one is actually present.
   *
   * `9111111119` is a valid ten-digit Indian mobile that happens to begin with
   * the digits 91. Stripping `91` unconditionally turns it into an eight-digit
   * number and rejects a real donor's phone. So the prefix is removed only when
   * what remains is a full ten digits:
   *
   *   +919876543210 → 9876543210   (explicit country code)
   *   919876543210  → 9876543210   (12 digits: the leading 91 is the country code)
   *   09876543210   → 9876543210   (trunk prefix)
   *   9111111119    → 9111111119   (already ten digits — left alone)
   */
  .transform((value) => {
    if (value.startsWith('+91') && value.length === 13) return value.slice(3);
    if (value.startsWith('91') && value.length === 12) return value.slice(2);
    if (value.startsWith('0') && value.length === 11) return value.slice(1);
    return value;
  })
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9'),
  );

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Slug is required')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

export const urlSchema = z.string().trim().url('Enter a valid URL').max(2048);

/** ISO-8601 datetime string. */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Calendar date, `YYYY-MM-DD`. Impact records require a date — a claim without one is not a claim. */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');

export const nonEmptyString = (max = 255) => z.string().trim().min(1, 'Required').max(max);
