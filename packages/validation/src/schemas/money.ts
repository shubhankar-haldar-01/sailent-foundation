import { z } from 'zod';

/**
 * Money codec (decision A2).
 *
 * Amounts are integer PAISE. They are serialised across the wire as STRINGS,
 * because a large paise value is not safely representable once it leaves
 * JavaScript's number type and because a string is unambiguous about precision.
 * This package owns both directions so no endpoint hand-rolls it.
 */

export const MIN_DONATION_PAISE = 1000; // ₹10
export const MAX_DONATION_PAISE = 100_000_000; // ₹10,00,000 — above this, route to a contact path

/** Paise as stored and computed: a non-negative integer. */
export const paiseSchema = z
  .number()
  .int('Amount must be a whole number of paise')
  .nonnegative('Amount must not be negative');

/** Paise as received over the wire: a numeric string. */
export const paiseFromStringSchema = z
  .string()
  .regex(/^\d+$/, 'Amount must be a whole number of paise')
  .transform((value) => Number.parseInt(value, 10))
  .pipe(paiseSchema);

/** Serialise paise for a JSON response. */
export function serialisePaise(value: number): string {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Cannot serialise a non-integer paise value: ${value}`);
  }
  return value.toString(10);
}

/** A donation amount: within the accepted range. */
export const donationAmountSchema = paiseSchema
  .min(MIN_DONATION_PAISE, `Minimum donation is ₹${MIN_DONATION_PAISE / 100}`)
  .max(MAX_DONATION_PAISE, 'For gifts this size, please contact us directly');

/** Currency. INR only for v1 — FCRA is not registered. */
export const currencySchema = z.literal('INR');

/**
 * Format paise as Indian currency for display.
 *
 * The rupee symbol is prepended manually rather than taken from
 * `style: 'currency'`: WebKit emits `"₹\u00a0900"` where Node and Chromium emit
 * `"₹900"`, which produces a React hydration mismatch on every page showing
 * money for every Safari and iOS visitor. Grouping still comes from Intl,
 * because Indian lakh/crore grouping is consistent across engines.
 *
 * Mirrors `formatCurrency` in @sailent/ui — the UI copy is what components use;
 * this one exists for server-side and validation contexts.
 */
export function formatPaise(value: number, options: { showDecimals?: boolean } = {}): string {
  const rupees = value / 100;
  const hasPaise = value % 100 !== 0;
  const showDecimals = options.showDecimals ?? hasPaise;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
  return `₹${formatted}`;
}
