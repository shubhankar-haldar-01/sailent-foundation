import { z } from 'zod';

/**
 * Notification templates: the registry, and the renderer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE RENDERER, SHARED BY THE WORKER AND THE PREVIEW.
 *
 * The worker renders a template to send it; the admin screen renders one to
 * show an editor what they just wrote. If those were two implementations, the
 * preview would eventually reassure somebody about an email that goes out
 * looking different — which is the precise failure a preview exists to prevent.
 *
 * INTERPOLATION ESCAPES, AND THAT IS NOT OPTIONAL.
 *
 * Every variable here is data somebody else supplied: a donor's name, a
 * campaign title, a volunteer's role. Substituting one into an HTML body
 * without escaping is an injection into an email this organisation signs and
 * sends. The text body is not escaped, because it is not markup.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * The transactional emails this platform sends, and what each is given.
 *
 * A CLOSED REGISTRY, for the reason the section composer has one: it is what
 * the seed creates, what the editor is shown, and what the preview fills in.
 * A template whose slug is not here would render with every variable empty and
 * nobody would find out until a donor did.
 */
export const NOTIFICATION_TEMPLATES = {
  'donation.confirmation': {
    name: 'Donation confirmation',
    description: 'Sent to a donor once a payment is captured and a receipt is numbered.',
    variables: {
      donorName: 'The donor’s first name, or “there” when unknown',
      campaignTitle: 'The campaign the donation was for',
      amount: 'The amount, already formatted as rupees',
      receiptNumber: 'The receipt number',
      reference: 'The donation reference',
      statusUrl: 'A link back to this donation',
      itemsHtml: 'The itemised table rows, built by the sender',
    },
    /*
      `itemsHtml` is the ONLY raw insertion in the platform, and it exists
      because a donation's line items are a table, not a sentence — a loop that
      simple substitution cannot express. The processor builds those rows and
      escapes every value inside them before they get here.
    */
    rawVariables: ['itemsHtml'],
  },
  'donor.login_code': {
    name: 'Sign-in code',
    description: 'The one-time code a donor or volunteer signs in with.',
    variables: {
      code: 'The six-digit code',
      minutes: 'How many minutes it remains valid',
    },
  },
  'event.registration.confirmed': {
    name: 'Event registration confirmed',
    description: 'Sent when a registration is accepted and a seat is held.',
    variables: {
      attendeeName: 'The attendee’s name',
      eventTitle: 'The event',
      eventDate: 'When it starts, already formatted',
      eventLocation: 'Where it is',
    },
  },
  'event.cancelled': {
    name: 'Event cancelled',
    description: 'Sent to everyone holding a seat when an event is called off.',
    variables: {
      attendeeName: 'The attendee’s name',
      eventTitle: 'The event',
      eventDate: 'When it was to have started',
    },
  },
  'volunteer.application.received': {
    name: 'Volunteer application received',
    description: 'Acknowledges an application. Promises a review, not an outcome.',
    variables: { volunteerName: 'The applicant’s name' },
  },
  'volunteer.approved': {
    name: 'Volunteer approved',
    description: 'Sent on approval, carrying the volunteer ID.',
    variables: {
      volunteerName: 'The volunteer’s name',
      volunteerId: 'The assigned volunteer ID, as VOL-2026-00001',
    },
  },
  'volunteer.rejected': {
    name: 'Volunteer application closed',
    description:
      'Sent when an application is not taken forward. Never carries the internal reason.',
    variables: { volunteerName: 'The applicant’s name' },
  },
  'volunteer.assigned': {
    name: 'Volunteer assignment',
    description: 'Sent when a volunteer is assigned to an event or a role.',
    variables: {
      volunteerName: 'The volunteer’s name',
      role: 'The role they have been given',
      eventTitle: 'The event, when the assignment is to one',
      startsAt: 'When it starts, already formatted',
    },
  },
  'volunteer.certificate.issued': {
    name: 'Volunteer certificate issued',
    description: 'Sent when a certificate is issued, carrying its verification code.',
    variables: {
      volunteerName: 'The volunteer’s name',
      certificateCode: 'The code the certificate is verified by',
      hours: 'Verified hours, already rounded',
    },
  },
} as const;

export type NotificationTemplateSlug = keyof typeof NOTIFICATION_TEMPLATES;

export const NOTIFICATION_TEMPLATE_SLUGS = Object.keys(
  NOTIFICATION_TEMPLATES,
) as NotificationTemplateSlug[];

export function isKnownTemplateSlug(slug: string): slug is NotificationTemplateSlug {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_TEMPLATES, slug);
}

/** The variables a given template expects, for the editor and the preview. */
export function expectedVariables(slug: string): Record<string, string> {
  return isKnownTemplateSlug(slug) ? { ...NOTIFICATION_TEMPLATES[slug].variables } : {};
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * `{{{ name }}}` raw, then `{{ name }}` escaped.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ESCAPED IS THE DEFAULT. RAW IS OPT-IN, VISIBLE, AND POLICED.
 *
 * Triple braces insert a value without escaping. That is the Mustache
 * convention, and it exists here for exactly one thing — a donation's
 * itemised table rows, which the sender builds and which no amount of
 * substitution could express as a sentence.
 *
 * `rawVariables` on the registry entry is the allowlist, and
 * `unsafeRawPlaceholders()` below is what the API refuses a save on. Without
 * that, an editor could turn `{{donorName}}` into `{{{donorName}}}` and put an
 * unescaped donor-supplied string into an email this organisation signs.
 *
 * Both patterns are built FRESH on every call. A module-level regex with the
 * `g` flag carries `lastIndex` between calls and silently skips matches on the
 * second use — the bug that once made the markdown renderer loop forever.
 * ══════════════════════════════════════════════════════════════════════════
 */
const RAW_PLACEHOLDER = '\\{\\{\\{\\s*([A-Za-z0-9_]+)\\s*\\}\\}\\}';
const PLACEHOLDER = '\\{\\{\\s*([A-Za-z0-9_]+)\\s*\\}\\}';

/** The five characters that change meaning inside HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderResult {
  output: string;
  /** Placeholders the caller supplied no value for. */
  missing: string[];
}

/**
 * Substitute `{{variables}}`.
 *
 * A placeholder with no value renders as EMPTY and is reported, rather than
 * left in place. `Dear {{donorName}}` arriving in a donor's inbox is worse
 * than `Dear ,` — and the caller is told, so a preview can warn and the worker
 * can log.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string | number | null | undefined>,
  options: { escape?: boolean } = {},
): RenderResult {
  const missing: string[] = [];

  const take = (name: string): string | null => {
    const value = values[name];
    if (value === undefined || value === null || value === '') {
      missing.push(name);
      return null;
    }
    return String(value);
  };

  /*
    TRIPLE BRACES FIRST. `{{{name}}}` contains `{{name}}`, so running the
    double-brace pattern first would consume the inner braces and leave a
    stray `{` and `}` around the value.
  */
  const output = body
    .replace(new RegExp(RAW_PLACEHOLDER, 'g'), (_match, name: string) => take(name) ?? '')
    .replace(new RegExp(PLACEHOLDER, 'g'), (_match, name: string) => {
      const text = take(name);
      if (text === null) return '';
      return options.escape ? escapeHtml(text) : text;
    });

  return { output, missing: [...new Set(missing)] };
}

/**
 * Raw placeholders a template uses that its slug does not permit.
 *
 * The API refuses a save when this is non-empty. Without it, changing
 * `{{donorName}}` to `{{{donorName}}}` would be a one-character edit that puts
 * an unescaped, donor-supplied string into an outgoing email — and it would
 * look like a formatting tweak in a diff.
 */
export function unsafeRawPlaceholders(slug: string, ...bodies: string[]): string[] {
  const entry = isKnownTemplateSlug(slug) ? NOTIFICATION_TEMPLATES[slug] : undefined;
  const allowed = new Set<string>(
    entry && 'rawVariables' in entry ? (entry.rawVariables as readonly string[]) : [],
  );

  const used = new Set<string>();
  for (const body of bodies) {
    const pattern = new RegExp(RAW_PLACEHOLDER, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) used.add(match[1]!);
  }

  return [...used].filter((name) => !allowed.has(name));
}

/** Render subject, HTML and text in one pass, escaping only the HTML. */
export function renderNotification(
  template: { subject: string; bodyHtml: string; bodyText: string },
  values: Record<string, string | number | null | undefined>,
): { subject: string; html: string; text: string; missing: string[] } {
  // The subject is plain text in a mail header, so it is not HTML-escaped —
  // escaping it would put `&amp;` in somebody's inbox.
  const subject = renderTemplate(template.subject, values);
  const html = renderTemplate(template.bodyHtml, values, { escape: true });
  const text = renderTemplate(template.bodyText, values);

  return {
    subject: subject.output,
    html: html.output,
    text: text.output,
    missing: [...new Set([...subject.missing, ...html.missing, ...text.missing])],
  };
}

/** Every placeholder a body mentions, in order of first appearance. */
export function placeholdersIn(body: string): string[] {
  const found: string[] = [];
  for (const source of [RAW_PLACEHOLDER, PLACEHOLDER]) {
    const pattern = new RegExp(source, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) found.push(match[1]!);
  }
  return [...new Set(found)];
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const subject = z
  .string()
  .trim()
  .min(3, 'Give the email a subject.')
  .max(320, 'Subjects are limited to 320 characters.');

const bodyHtml = z
  .string()
  .trim()
  .min(20, 'The HTML body is too short to be an email.')
  .max(50_000, 'The HTML body is limited to 50,000 characters.');

const bodyText = z
  .string()
  .trim()
  .min(10, 'The plain-text body is too short to be an email.')
  .max(50_000, 'The plain-text body is limited to 50,000 characters.');

/**
 * Editing a template.
 *
 * The SLUG is absent on purpose: it is the identity a processor looks up by,
 * so renaming one would silently stop an email going out while everything
 * still looked configured. Slugs come from the registry above and change only
 * when a processor changes.
 */
export const updateNotificationTemplateSchema = z
  .object({
    subject,
    bodyHtml,
    bodyText,
    isActive: z.boolean(),
    note: z.string().trim().max(500, 'Keep the note under 500 characters.').optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field.');

export const previewNotificationTemplateSchema = z.object({
  subject,
  bodyHtml,
  bodyText,
  /** Sample values. Anything missing is filled from the registry's descriptions. */
  values: z.record(z.string(), z.string().max(500)).optional(),
});

export const revertNotificationTemplateSchema = z.object({
  version: z.number().int().min(1, 'Name the version to go back to.'),
  note: z.string().trim().max(500).optional(),
});

export const notificationLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['pending', 'sent', 'failed', 'read']).optional(),
  channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']).optional(),
  type: z.string().trim().max(64).optional(),
});

export const inboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
});
