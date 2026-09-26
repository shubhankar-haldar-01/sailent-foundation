import { describe, expect, it } from 'vitest';

import { emailSchema, phoneSchema, slugSchema } from '../schemas/primitives.js';
import { panSchema, taxIdSchema } from '../schemas/identity.js';
import {
  donationAmountSchema,
  formatPaise,
  paiseFromStringSchema,
  serialisePaise,
} from '../schemas/money.js';
import { paginationSchema, sortSchema } from '../schemas/pagination.js';

describe('phoneSchema', () => {
  it('normalises the accepted Indian formats to bare 10 digits', () => {
    // Donor identity is the phone number, so all of these must collapse to one
    // value or the deduplication key in `donors` is meaningless.
    for (const input of ['+91 98765 43210', '919876543210', '09876543210', '9876543210']) {
      expect(phoneSchema.parse(input)).toBe('9876543210');
    }
  });

  it('rejects numbers that cannot be Indian mobiles', () => {
    for (const input of ['1234567890', '5876543210', '98765', '98765432101', '+91', '']) {
      expect(phoneSchema.safeParse(input).success).toBe(false);
    }
  });

  it.each(['9111111119', '9112345678', '9100000009'])(
    'leaves %s alone — a ten-digit mobile that merely BEGINS with 91',
    (input) => {
      // The prefix strip used to be unconditional, which turned each of these
      // valid numbers into eight digits and rejected a real donor's phone. The
      // strip now applies only when what remains is a full ten digits.
      expect(phoneSchema.parse(input)).toBe(input);
    },
  );

  it('still strips 91 when it genuinely is the country code', () => {
    // Twelve digits: the leading 91 cannot be part of a ten-digit number.
    expect(phoneSchema.parse('919111111119')).toBe('9111111119');
  });

  it('strips a trunk 0 only when one is actually there', () => {
    expect(phoneSchema.parse('09876543210')).toBe('9876543210');
    // Eleven digits is the only shape where a leading 0 is a trunk prefix; a
    // ten-digit number starting with 0 is simply invalid, not un-prefixed.
    expect(phoneSchema.safeParse('0087654321').success).toBe(false);
  });

  it('gives a message a person can act on', () => {
    const result = phoneSchema.safeParse('12345');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('10-digit');
    }
  });
});

describe('emailSchema', () => {
  it('trims and lowercases so matching is stable', () => {
    expect(emailSchema.parse('  Donor@Example.COM ')).toBe('donor@example.com');
  });

  it('rejects malformed addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('slugSchema', () => {
  it('accepts hyphenated lowercase slugs', () => {
    expect(slugSchema.parse('School-Kits-Jharkhand'.toLowerCase())).toBe('school-kits-jharkhand');
  });

  it('rejects slugs with spaces, underscores or trailing hyphens', () => {
    for (const input of ['school kits', 'school_kits', 'school-kits-']) {
      expect(slugSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('money', () => {
  it('round-trips paise through the wire format without precision loss', () => {
    const amount = 290_000; // ₹2,900 — the hybrid donation example from Phase 0
    expect(paiseFromStringSchema.parse(serialisePaise(amount))).toBe(amount);
  });

  it('refuses a non-integer paise value rather than rounding silently', () => {
    expect(() => serialisePaise(900.5)).toThrow(TypeError);
  });

  it('rejects a wire value that is not a whole number of paise', () => {
    expect(paiseFromStringSchema.safeParse('900.50').success).toBe(false);
  });

  it('enforces the donation floor and ceiling', () => {
    expect(donationAmountSchema.safeParse(500).success).toBe(false); // ₹5, below minimum
    expect(donationAmountSchema.safeParse(90_000).success).toBe(true); // ₹900 school kit
    expect(donationAmountSchema.safeParse(200_000_000).success).toBe(false); // above ceiling
  });

  it('formats using Indian digit grouping', () => {
    // ₹4,20,000 — not ₹420,000. Getting this wrong reads as foreign to donors.
    expect(formatPaise(42_000_000)).toBe('₹4,20,000');
  });

  it('never emits a space between the symbol and the number', () => {
    // REGRESSION GUARD. Intl's `style: 'currency'` disagrees across engines:
    // WebKit produces "₹\u00a0900" where Node and Chromium produce "₹900".
    // The server then renders one string and Safari renders another, which is
    // a React hydration mismatch on every page that shows money — for every
    // iOS visitor. We prepend the symbol ourselves to keep it deterministic.
    for (const amount of [90_000, 42_000_000, 123_45]) {
      expect(formatPaise(amount)).not.toMatch(/₹[\s\u00a0\u202f]/);
      expect(formatPaise(amount).startsWith('₹')).toBe(true);
    }
  });
});

describe('taxIdSchema', () => {
  it('accepts a well-formed PAN and uppercases it', () => {
    expect(panSchema.parse('abcde1234f')).toBe('ABCDE1234F');
  });

  it('validates the PAN pattern only when the declared type is PAN', () => {
    expect(taxIdSchema.safeParse({ type: 'pan', number: 'NOTAPAN' }).success).toBe(false);
    expect(taxIdSchema.safeParse({ type: 'passport', number: 'Z1234567' }).success).toBe(true);
  });
});

describe('pagination', () => {
  it('applies defaults and coerces query strings', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, perPage: 20 });
    expect(paginationSchema.parse({ page: '3', perPage: '50' })).toEqual({ page: 3, perPage: 50 });
  });

  it('caps perPage so a client cannot request an unbounded page', () => {
    expect(paginationSchema.safeParse({ perPage: 5000 }).success).toBe(false);
  });

  it('parses the leading-hyphen descending convention', () => {
    expect(sortSchema.parse('-createdAt')).toEqual({ field: 'createdAt', direction: 'desc' });
    expect(sortSchema.parse('title')).toEqual({ field: 'title', direction: 'asc' });
  });
});
