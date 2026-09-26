import { NOTIFICATION_TEMPLATES } from '@sailent/validation';

/**
 * The starting wording for every transactional email.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SEEDED AS REFERENCE DATA, AND UPSERTED BY SLUG — NEVER OVERWRITTEN.
 *
 * These rows are what makes "every transactional email has a template"
 * (product-requirements §4.21) true on a fresh database. But once an editor has
 * changed a body, re-running the seed must not undo it: an organisation that
 * rewrote its receipt wording and lost it to a deployment would, correctly,
 * stop trusting the editor.
 *
 * So `seedNotificationTemplates` inserts what is missing and updates only the
 * NAME, DESCRIPTION and VARIABLES — the metadata that belongs to the code —
 * leaving subject and bodies alone.
 *
 * THE BODIES BELOW ARE THE FALLBACKS MADE EDITABLE. Each processor keeps its
 * own built-in body and uses it when a template is absent or inactive, so
 * these are the same words in a place somebody can change them.
 * ══════════════════════════════════════════════════════════════════════════
 */

const WRAPPER_OPEN =
  '<div style="font-family:system-ui,-apple-system,\'Segoe UI\',sans-serif;max-width:560px;color:#1f2933">';
const WRAPPER_CLOSE = '</div>';
const SIGN_OFF = '<p style="font-size:13px;color:#52606d">With thanks,<br>Sailent Foundation</p>';

function html(...parts: string[]): string {
  return [WRAPPER_OPEN, ...parts, SIGN_OFF, WRAPPER_CLOSE].join('\n  ');
}

export interface SeedTemplate {
  slug: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export const NOTIFICATION_TEMPLATE_SEED: SeedTemplate[] = [
  {
    slug: 'donation.confirmation',
    subject: 'Thank you — your donation to {{campaignTitle}}',
    bodyHtml: html(
      '<p>Dear {{donorName}},</p>',
      '<p>Thank you. Your donation to <strong>{{campaignTitle}}</strong> has been received.</p>',
      '<table style="width:100%;border-collapse:collapse;margin:20px 0"><tbody>{{{itemsHtml}}}</tbody>' +
        '<tfoot><tr><td style="padding:10px 12px 0 0;border-top:1px solid #d9e2ec"><strong>Total</strong></td>' +
        '<td style="padding:10px 0 0;border-top:1px solid #d9e2ec;text-align:right"><strong>{{amount}}</strong></td></tr></tfoot></table>',
      '<p style="margin:0"><strong>Receipt number:</strong> {{receiptNumber}}<br>' +
        '<strong>Donation reference:</strong> {{reference}}</p>',
      '<p><a href="{{statusUrl}}">View this donation</a></p>',
      /*
        A14, and the one paragraph in this file that is a compliance
        requirement rather than a courtesy: a receipt is NOT an 80G
        certificate, and saying so here is what stops a donor believing they
        already hold one.
      */
      '<p style="font-size:13px;color:#52606d;border-top:1px solid #d9e2ec;padding-top:14px">' +
        'This is your receipt for the payment. It is <strong>not</strong> a tax-exemption certificate. ' +
        'If you are claiming relief under Section 80G, the Income Tax Department issues Form 10BE after ' +
        'our annual Form 10BD filing, and it will reach you separately.</p>',
    ),
    bodyText: `Dear {{donorName}},

Thank you. Your donation to {{campaignTitle}} has been received.

Total: {{amount}}
Receipt number: {{receiptNumber}}
Donation reference: {{reference}}

View this donation: {{statusUrl}}

This is your receipt for the payment. It is not a tax-exemption certificate —
if you are claiming relief under Section 80G, the Income Tax Department issues
Form 10BE after our annual Form 10BD filing, and it will reach you separately.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'donor.login_code',
    subject: 'Your Sailent Foundation sign-in code',
    bodyHtml: html(
      '<p>Your sign-in code is:</p>',
      '<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">{{code}}</p>',
      '<p>It is valid for {{minutes}} minutes and can be used once.</p>',
      '<p style="font-size:13px;color:#52606d">If you did not ask to sign in, ignore this email. ' +
        'Nobody can use this code without your inbox.</p>',
    ),
    bodyText: `Your sign-in code is: {{code}}

It is valid for {{minutes}} minutes and can be used once.

If you did not ask to sign in, ignore this email.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'event.registration.confirmed',
    subject: 'You’re registered — {{eventTitle}}',
    bodyHtml: html(
      '<p>Dear {{attendeeName}},</p>',
      '<p>Your place at <strong>{{eventTitle}}</strong> is confirmed.</p>',
      '<p style="margin:0"><strong>When:</strong> {{eventDate}}<br><strong>Where:</strong> {{eventLocation}}</p>',
      '<p>If you can no longer come, tell us so the seat can go to somebody else.</p>',
    ),
    bodyText: `Dear {{attendeeName}},

Your place at {{eventTitle}} is confirmed.

When: {{eventDate}}
Where: {{eventLocation}}

If you can no longer come, tell us so the seat can go to somebody else.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'event.cancelled',
    subject: 'Cancelled — {{eventTitle}}',
    bodyHtml: html(
      '<p>Dear {{attendeeName}},</p>',
      '<p><strong>{{eventTitle}}</strong>, due to take place on {{eventDate}}, has been cancelled.</p>',
      '<p>We are sorry. Your registration has been released and there is nothing you need to do.</p>',
    ),
    bodyText: `Dear {{attendeeName}},

{{eventTitle}}, due to take place on {{eventDate}}, has been cancelled.

We are sorry. Your registration has been released and there is nothing you need to do.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'volunteer.application.received',
    subject: 'We have your volunteer application',
    bodyHtml: html(
      '<p>Dear {{volunteerName}},</p>',
      // Promises a review, not an outcome. An acknowledgement that sounds like
      // an acceptance is a cruelty to write and a problem to answer for.
      '<p>Thank you for offering your time. We have your application and somebody will read it.</p>',
      '<p>We will write again when it has been reviewed.</p>',
    ),
    bodyText: `Dear {{volunteerName}},

Thank you for offering your time. We have your application and somebody will read it.

We will write again when it has been reviewed.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'volunteer.approved',
    subject: 'Welcome to the Sailent Foundation volunteer team',
    bodyHtml: html(
      '<p>Dear {{volunteerName}},</p>',
      '<p>Your application has been approved. Welcome.</p>',
      '<p style="margin:0"><strong>Your volunteer ID:</strong> {{volunteerId}}</p>',
      '<p>Keep it — it identifies you on assignments, attendance registers and certificates.</p>',
    ),
    bodyText: `Dear {{volunteerName}},

Your application has been approved. Welcome.

Your volunteer ID: {{volunteerId}}

Keep it — it identifies you on assignments, attendance registers and certificates.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'volunteer.rejected',
    subject: 'Your volunteer application',
    bodyHtml: html(
      '<p>Dear {{volunteerName}},</p>',
      /*
        THE INTERNAL REASON NEVER APPEARS HERE, and the template has no
        variable for it. `volunteers.rejection_reason` is ADMIN-ONLY; it is
        written for colleagues, and a note meant for colleagues arriving in the
        applicant's inbox is the failure this omission prevents.
      */
      '<p>Thank you for your interest in volunteering with us. We are not able to take your ' +
        'application forward at this time.</p>',
      '<p>You are welcome to apply again in future.</p>',
    ),
    bodyText: `Dear {{volunteerName}},

Thank you for your interest in volunteering with us. We are not able to take your
application forward at this time.

You are welcome to apply again in future.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'volunteer.assigned',
    subject: 'You have been assigned — {{role}}',
    bodyHtml: html(
      '<p>Dear {{volunteerName}},</p>',
      '<p>You have been assigned as <strong>{{role}}</strong> for {{eventTitle}}.</p>',
      '<p style="margin:0"><strong>Starts:</strong> {{startsAt}}</p>',
      '<p>If you cannot make it, tell us as early as you can.</p>',
    ),
    bodyText: `Dear {{volunteerName}},

You have been assigned as {{role}} for {{eventTitle}}.

Starts: {{startsAt}}

If you cannot make it, tell us as early as you can.

With thanks,
Sailent Foundation`,
  },
  {
    slug: 'volunteer.certificate.issued',
    subject: 'Your volunteer certificate',
    bodyHtml: html(
      '<p>Dear {{volunteerName}},</p>',
      '<p>Your certificate has been issued for {{hours}} verified hours. Thank you.</p>',
      '<p style="margin:0"><strong>Verification code:</strong> {{certificateCode}}</p>',
      '<p>Anybody can check the certificate against that code on our website.</p>',
    ),
    bodyText: `Dear {{volunteerName}},

Your certificate has been issued for {{hours}} verified hours. Thank you.

Verification code: {{certificateCode}}

Anybody can check the certificate against that code on our website.

With thanks,
Sailent Foundation`,
  },
];

/**
 * Every seeded slug must be in the registry, and every registry slug seeded.
 *
 * Checked at module load rather than in a test, because the two drifting is
 * silent: a template nobody seeded means an email that quietly keeps using its
 * built-in body, and a slug nobody registered means an editor with no
 * variable list.
 */
const registrySlugs = Object.keys(NOTIFICATION_TEMPLATES).sort();
const seedSlugs = NOTIFICATION_TEMPLATE_SEED.map((template) => template.slug).sort();

if (registrySlugs.join(',') !== seedSlugs.join(',')) {
  throw new Error(
    'Notification template seed and registry disagree.\n' +
      `  registry: ${registrySlugs.join(', ')}\n` +
      `  seed:     ${seedSlugs.join(', ')}`,
  );
}
