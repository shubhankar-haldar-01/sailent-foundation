import { describe, expect, it } from 'vitest';

import {
  contactSubmissionSchema,
  newsletterSubscribeSchema,
  organizationContactSchema,
  organizationSocialSchema,
  phoneHref,
  registrationDetailsSchema,
  staffPasswordSchema,
  staffTokenSchema,
} from '../index.js';

describe('contactSubmissionSchema', () => {
  const valid = {
    name: 'Asha',
    email: ' Asha@Example.org ',
    subject: 'general',
    message: 'I would like to know more about your programmes.',
  };

  it('accepts a real message and normalises the address', () => {
    const parsed = contactSubmissionSchema.parse(valid);
    expect(parsed.email).toBe('asha@example.org');
  });

  it('refuses an unknown subject, a short message and unknown fields', () => {
    expect(contactSubmissionSchema.safeParse({ ...valid, subject: 'refund' }).success).toBe(false);
    expect(contactSubmissionSchema.safeParse({ ...valid, message: 'hi' }).success).toBe(false);
    expect(contactSubmissionSchema.safeParse({ ...valid, admin: true }).success).toBe(false);
  });

  it('refuses a message over the limit', () => {
    expect(contactSubmissionSchema.safeParse({ ...valid, message: 'x'.repeat(5001) }).success).toBe(
      false,
    );
  });
});

describe('newsletterSubscribeSchema', () => {
  it('normalises the address and refuses anything else', () => {
    expect(newsletterSubscribeSchema.parse({ email: ' A@B.org' }).email).toBe('a@b.org');
    expect(newsletterSubscribeSchema.safeParse({ email: 'a@b.org', status: 'x' }).success).toBe(
      false,
    );
  });
});

describe('staffPasswordSchema', () => {
  it('requires 12 characters and refuses known defaults in any case', () => {
    expect(staffPasswordSchema.safeParse('short').success).toBe(false);
    expect(staffPasswordSchema.safeParse('DEVPASSWORD123!').success).toBe(false);
    expect(staffPasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
    expect(staffPasswordSchema.safeParse('correct horse battery').success).toBe(true);
  });
});

describe('staffTokenSchema', () => {
  it('accepts exactly a 43-character base64url token', () => {
    expect(staffTokenSchema.safeParse('A'.repeat(43)).success).toBe(true);
    expect(staffTokenSchema.safeParse('A'.repeat(42)).success).toBe(false);
    expect(staffTokenSchema.safeParse(`${'A'.repeat(42)}=`).success).toBe(false);
  });
});

describe('organisation settings', () => {
  it('turns blank fields into null rather than empty strings', () => {
    const parsed = organizationContactSchema.parse({
      email: '',
      pressEmail: null,
      phone: '',
      officeHours: '',
      address: { line1: ' 1 Main Road ', line2: '', city: 'Pune' },
    });
    expect(parsed).toMatchObject({
      email: null,
      phone: null,
      officeHours: null,
      address: { line1: '1 Main Road', line2: null, city: 'Pune', state: null },
    });
  });

  it('refuses a bad email or phone', () => {
    const base = { address: {} };
    expect(organizationContactSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
    expect(organizationContactSchema.safeParse({ ...base, phone: 'call me' }).success).toBe(false);
  });

  it('allows only https links to known networks', () => {
    expect(
      organizationSocialSchema.safeParse([{ label: 'Facebook', url: 'https://facebook.com/x' }])
        .success,
    ).toBe(true);
    expect(
      organizationSocialSchema.safeParse([{ label: 'Facebook', url: 'http://facebook.com/x' }])
        .success,
    ).toBe(false);
    expect(
      organizationSocialSchema.safeParse([{ label: 'Myspace', url: 'https://myspace.com/x' }])
        .success,
    ).toBe(false);
    expect(
      organizationSocialSchema.safeParse([{ label: 'X', url: 'javascript:alert(1)' }]).success,
    ).toBe(false);
  });

  it('keeps a pre-Phase-13 registration row valid', () => {
    expect(
      registrationDetailsSchema.safeParse({
        registrationNumber: null,
        pan: null,
        section12A: null,
        section80G: null,
      }).success,
    ).toBe(true);
  });

  it('derives a tel: link from a displayed number', () => {
    expect(phoneHref('+91 98765 43210')).toBe('+919876543210');
    expect(phoneHref('020 (2567) 1234')).toBe('02025671234');
  });
});
