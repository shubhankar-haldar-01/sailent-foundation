import { z } from 'zod';

import { emailSchema } from '../schemas/primitives.js';

/**
 * Phase 13 — the rules shared by the API and the web for inbound
 * communication, general FAQs, staff passwords and organisation settings.
 *
 * Shared for the usual reason: the browser gives fast feedback with the same
 * schema the server enforces, so the two cannot disagree about what is valid.
 */

// ── Contact form ────────────────────────────────────────────────────────────

export const CONTACT_SUBJECTS = [
  'general',
  'donation',
  'volunteering',
  'partnership',
  'documents',
  'media',
] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  general: 'General question',
  donation: 'A donation or receipt',
  volunteering: 'Volunteering',
  partnership: 'Partnership or CSR',
  documents: 'Documents and registrations',
  media: 'Media enquiry',
};

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 5000;

export const contactSubmissionSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(120),
    email: emailSchema,
    subject: z.enum(CONTACT_SUBJECTS),
    message: z
      .string()
      .trim()
      .min(CONTACT_MESSAGE_MIN, `Please write at least ${CONTACT_MESSAGE_MIN} characters`)
      .max(CONTACT_MESSAGE_MAX, `Please keep it under ${CONTACT_MESSAGE_MAX} characters`),
    /**
     * Honeypot. Hidden from people, filled in by naive bots. A submission with
     * anything here is accepted with the usual answer and silently discarded,
     * so the bot learns nothing.
     */
    website: z.string().max(200).optional(),
  })
  .strict();
export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

export const CONTACT_MESSAGE_STATUSES = ['new', 'handled', 'archived'] as const;
export type ContactMessageStatus = (typeof CONTACT_MESSAGE_STATUSES)[number];

// ── Newsletter ──────────────────────────────────────────────────────────────

export const newsletterSubscribeSchema = z
  .object({
    email: emailSchema,
    /** Honeypot, as on the contact form. */
    website: z.string().max(200).optional(),
  })
  .strict();

/** The raw token in a confirmation or unsubscribe link: 32 random bytes, base64url. */
export const newsletterTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'That link is not valid');

export const NEWSLETTER_STATUSES = ['pending', 'subscribed', 'unsubscribed'] as const;
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

// ── General FAQs ────────────────────────────────────────────────────────────

/** The groups `/faq` shows, in order. Stored in `faqs.category`. */
export const FAQ_CATEGORIES = [
  { id: 'donations', label: 'Donations', description: 'Giving, receipts and tax' },
  {
    id: 'campaigns',
    label: 'Campaigns',
    description: 'How campaigns work and how progress is counted',
  },
  {
    id: 'volunteering',
    label: 'Volunteering',
    description: 'Applying, commitment and certification',
  },
  { id: 'events', label: 'Events', description: 'Registration, capacity and attendance' },
  {
    id: 'transparency',
    label: 'Transparency',
    description: 'Accounts, audits and how we measure impact',
  },
  { id: 'general', label: 'General', description: 'Contact and data handling' },
] as const;
export const FAQ_CATEGORY_IDS = FAQ_CATEGORIES.map((category) => category.id) as [
  (typeof FAQ_CATEGORIES)[number]['id'],
  ...(typeof FAQ_CATEGORIES)[number]['id'][],
];
export type FaqCategoryId = (typeof FAQ_CATEGORIES)[number]['id'];

// ── Staff passwords ─────────────────────────────────────────────────────────

/** Same policy as `db:create-admin` (`packages/database/src/lib/password-policy.ts`). */
export const STAFF_PASSWORD_MIN = 12;
/** Argon2 has no practical limit, but a megabyte "password" is a cheap denial of service. */
export const STAFF_PASSWORD_MAX = 128;
const FORBIDDEN_STAFF_PASSWORDS = new Set([
  'devpassword123!',
  'password',
  'admin',
  'changeme',
  'sailent',
]);

export const staffPasswordSchema = z
  .string()
  .min(STAFF_PASSWORD_MIN, `Use at least ${STAFF_PASSWORD_MIN} characters`)
  .max(STAFF_PASSWORD_MAX, `Use at most ${STAFF_PASSWORD_MAX} characters`)
  .refine(
    (value) => !FORBIDDEN_STAFF_PASSWORDS.has(value.toLowerCase()),
    'That is a known default password. Choose one that has never been published.',
  );

/** The raw token in an invitation or password-reset link: 32 random bytes, base64url. */
export const staffTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'That link is not valid');

// ── Organisation settings ───────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

/** `organization_contact` — everything the footer and contact page show. */
export const organizationContactSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email address')
      .max(254)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    pressEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email address')
      .max(254)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    /** As displayed, e.g. "+91 98765 43210". The tel: link is derived from it. */
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^\+?[0-9 ()-]{6,32}$/, 'Use digits, spaces and an optional leading +')
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    officeHours: optionalText(160),
    address: z
      .object({
        line1: optionalText(160),
        line2: optionalText(160),
        city: optionalText(80),
        state: optionalText(80),
        postalCode: optionalText(16),
        country: optionalText(80),
      })
      .strict(),
  })
  .strict();
export type OrganizationContact = z.output<typeof organizationContactSchema>;

export const SOCIAL_NETWORKS = ['Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'X'] as const;

export const organizationSocialSchema = z
  .array(
    z
      .object({
        label: z.enum(SOCIAL_NETWORKS),
        url: z
          .string()
          .trim()
          .url('Enter a full address, starting https://')
          .max(300)
          .refine((value) => value.startsWith('https://'), 'Use an https:// address'),
      })
      .strict(),
  )
  .max(SOCIAL_NETWORKS.length);
export type OrganizationSocial = z.output<typeof organizationSocialSchema>;

/** `registration_details`. The last four fields arrived in Phase 13 and may be absent. */
export const registrationDetailsSchema = z
  .object({
    registrationNumber: z.string().trim().max(120).nullable(),
    pan: z
      .string()
      .trim()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'A PAN looks like AAAAA9999A')
      .nullable(),
    section12A: z.string().trim().max(120).nullable(),
    section80G: z.string().trim().max(120).nullable(),
    registeredAs: z.string().trim().max(120).nullable().optional(),
    trustDeedNumber: z.string().trim().max(120).nullable().optional(),
    /** ISO date (YYYY-MM-DD). */
    registeredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')
      .nullable()
      .optional(),
    csr1: z.string().trim().max(120).nullable().optional(),
  })
  .strict();
export type RegistrationDetails = z.output<typeof registrationDetailsSchema>;

/** The `tel:` form of a displayed phone number: digits and a leading +. */
export function phoneHref(display: string): string {
  const trimmed = display.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}
