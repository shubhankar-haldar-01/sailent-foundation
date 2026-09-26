/**
 * Money (decision A2).
 *
 * Every monetary value in this platform is an integer count of PAISE.
 * ₹900 is 90_000. There is no float, no decimal, no `number` masquerading
 * as an amount — floating-point currency is the most common source of
 * financial bugs in donation platforms.
 *
 * The brand makes it a type error to pass a raw number where an amount is
 * expected, so a bug has to be deliberate rather than accidental.
 */
declare const paiseBrand: unique symbol;

export type Paise = number & { readonly [paiseBrand]: 'Paise' };

/** Construct Paise from an integer. Throws on a non-integer or negative value. */
export function paise(value: number): Paise {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Paise must be an integer, received ${value}`);
  }
  if (value < 0) {
    throw new RangeError(`Paise must not be negative, received ${value}`);
  }
  return value as Paise;
}

/** Rupees → Paise. Rounds to the nearest paisa. */
export function rupeesToPaise(rupees: number): Paise {
  return paise(Math.round(rupees * 100));
}

/** Paise → Rupees. For DISPLAY ONLY — never store or compute with the result. */
export function paiseToRupees(value: Paise): number {
  return value / 100;
}

export type CurrencyCode = 'INR';
