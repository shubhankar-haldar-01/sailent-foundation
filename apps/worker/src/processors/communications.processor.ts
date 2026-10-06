import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { and, eq, sql } from 'drizzle-orm';

import {
  contactMessages,
  newsletterSubscribers,
  notifications,
  settings,
  users,
  type DatabaseClient,
} from '@sailent/database';
import { CONTACT_SUBJECT_LABELS, organizationContactSchema } from '@sailent/validation';

import { sendEmail, type BrevoConfig } from '../lib/brevo.js';
import { alertStaffOfFailedSend } from '../lib/admin-alert.js';

/**
 * Phase 13 email jobs: contact messages, newsletter confirmation, staff
 * invitations and staff password reset.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SAME RULES AS EVERY OTHER EMAIL PROCESSOR.
 *
 *   - Re-read the state before sending. An invitation already accepted, a
 *     subscription already confirmed, an account no longer active: nothing is
 *     sent.
 *   - Record every attempt in `notifications` (the send log), sent or not.
 *     The row never holds a token, a link or a message body — only ids.
 *   - Retry only what is worth retrying. `unreachable` throws, so BullMQ
 *     backs off and tries again (3 attempts, exponential); `rejected` and
 *     `not_configured` are permanent, recorded `failed`, and raise the
 *     in-app alert to staff.
 *   - Contact messages are not emailed twice: a message whose send is already
 *     recorded as `sent` is skipped, whatever re-enqueued it.
 *
 * Links carry their token after `#` for staff (never sent to a server, never
 * in a log) and in the query for the newsletter, whose pages ask for a click
 * before acting, so a mail scanner that follows links changes nothing.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface ContactReceivedJob {
  contactMessageId: string;
}
export interface NewsletterConfirmJob {
  subscriberId: string;
  confirmToken: string;
  unsubscribeToken: string;
}
export interface StaffTokenJob {
  userId: string;
  token: string;
}

export interface CommunicationsDeps {
  database: DatabaseClient;
  brevo: BrevoConfig;
  appUrl: string;
  /** Where contact messages go. Defaults to the `organization_contact` setting. */
  organisationEmail?: (db: DatabaseClient['db']) => Promise<string | null>;
}

/** The organisation's public contact email from Admin → Settings, or null. */
export async function readOrganisationEmail(db: DatabaseClient['db']): Promise<string | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'organization_contact'))
    .limit(1);
  const contact = organizationContactSchema.safeParse(row?.value);
  return contact.success ? (contact.data.email ?? null) : null;
}

type SendOutcome = Awaited<ReturnType<typeof sendEmail>>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SHELL = (body: string) =>
  `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;color:#1f2933">${body}
  <p style="font-size:13px;color:#52606d;border-top:1px solid #d9e2ec;padding-top:14px">Sailent Foundation</p>
</div>`;

function link(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/+$/, '')}${path}`;
}

async function record(
  db: DatabaseClient['db'],
  entry: {
    recipientType: 'user' | 'organisation' | 'subscriber';
    recipientId: string | null;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown>;
    result: SendOutcome;
    attempts: number;
    logger: Logger;
  },
): Promise<void> {
  await db.insert(notifications).values({
    recipientType: entry.recipientType,
    recipientId: entry.recipientId,
    type: entry.type,
    title: entry.title,
    message: entry.message,
    data: entry.data,
    channel: 'email',
    status: entry.result.sent ? 'sent' : 'failed',
    sentAt: entry.result.sent ? new Date() : null,
    error: entry.result.sent
      ? null
      : `${entry.result.reason}${entry.result.detail ? `: ${entry.result.detail}` : ''}`,
    providerMessageId: entry.result.sent ? entry.result.providerMessageId : null,
    retryCount: entry.attempts,
  });

  if (!entry.result.sent && entry.result.reason !== 'unreachable') {
    await alertStaffOfFailedSend(
      db,
      { type: entry.type, summary: entry.title, reason: entry.result.reason, context: entry.data },
      entry.logger,
    );
  }
}

/** Only `unreachable` is worth retrying; the rest are permanent. */
function throwIfRetryable(result: SendOutcome): void {
  if (!result.sent && result.reason === 'unreachable') {
    throw new Error(`Brevo unreachable: ${result.detail ?? ''}`);
  }
}

// ── contact.received ────────────────────────────────────────────────────────

export async function processContactReceived(
  job: Job<ContactReceivedJob>,
  deps: CommunicationsDeps,
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { db } = deps.database;
  const id = job.data.contactMessageId;

  const [message] = await db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1);
  if (!message) {
    logger.warn({ contactMessageId: id }, 'Contact job found no message');
    return { sent: false, reason: 'no_message' };
  }

  const [already] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, 'contact.received'),
        eq(notifications.status, 'sent'),
        sql`${notifications.data}->>'contactMessageId' = ${id}`,
      ),
    )
    .limit(1);
  if (already) return { sent: false, reason: 'already_sent' };

  const to = await (deps.organisationEmail ?? readOrganisationEmail)(db);

  const title = 'New contact-form message';
  const data = { contactMessageId: id };

  if (!to) {
    // The message is safe in Admin → Messages (and counted on the dashboard);
    // the send log records why no email went out.
    await record(db, {
      recipientType: 'organisation',
      recipientId: null,
      type: 'contact.received',
      title,
      message: 'No organisation email is set in Admin → Settings.',
      data,
      result: { sent: false, reason: 'not_configured', detail: 'organisation email not set' },
      attempts: job.attemptsMade,
      logger,
    });
    return { sent: false, reason: 'no_address' };
  }

  const subjectLabel = CONTACT_SUBJECT_LABELS[message.subject] ?? message.subject;
  const text = `A message arrived through the website contact form.

From: ${message.name} <${message.email}>
About: ${subjectLabel}

${message.message}

It is also in Admin → Messages, where it can be marked handled.`;

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: to },
      subject: `Website message: ${subjectLabel}`,
      html: SHELL(`
  <p>A message arrived through the website contact form.</p>
  <p><strong>From:</strong> ${escapeHtml(message.name)} &lt;${escapeHtml(message.email)}&gt;<br>
  <strong>About:</strong> ${escapeHtml(subjectLabel)}</p>
  <p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>
  <p><a href="${escapeHtml(link(deps.appUrl, `/admin/messages/${message.id}`))}">Open it in Admin → Messages</a> to mark it handled.</p>`),
      text,
      tags: ['contact-message'],
    },
    logger,
  );

  await record(db, {
    recipientType: 'organisation',
    recipientId: null,
    type: 'contact.received',
    title,
    message: `About: ${subjectLabel}`,
    data,
    result,
    attempts: job.attemptsMade,
    logger,
  });
  throwIfRetryable(result);
  return { sent: result.sent };
}

// ── newsletter.confirm ──────────────────────────────────────────────────────

export async function processNewsletterConfirm(
  job: Job<NewsletterConfirmJob>,
  deps: CommunicationsDeps,
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { db } = deps.database;
  const [subscriber] = await db
    .select({
      id: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      status: newsletterSubscribers.status,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, job.data.subscriberId))
    .limit(1);

  if (!subscriber || subscriber.status !== 'pending') {
    return { sent: false, reason: 'not_pending' };
  }

  const confirmUrl = link(
    deps.appUrl,
    `/newsletter/confirm?token=${encodeURIComponent(job.data.confirmToken)}`,
  );
  const unsubscribeUrl = link(
    deps.appUrl,
    `/newsletter/unsubscribe?token=${encodeURIComponent(job.data.unsubscribeToken)}`,
  );

  const text = `Please confirm that you want the Sailent Foundation newsletter:

${confirmUrl}

The link works for 48 hours. If you did not ask for this, ignore this email and you will not be subscribed.

To unsubscribe at any time later, use: ${unsubscribeUrl}`;

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: subscriber.email },
      subject: 'Confirm your newsletter subscription',
      html: SHELL(`
  <p>Please confirm that you want the Sailent Foundation newsletter.</p>
  <p><a href="${escapeHtml(confirmUrl)}">Confirm my subscription</a></p>
  <p>The link works for 48 hours. If you did not ask for this, ignore this email and you will not be subscribed.</p>
  <p style="font-size:13px">To unsubscribe at any time later: <a href="${escapeHtml(unsubscribeUrl)}">unsubscribe</a>.</p>`),
      text,
      tags: ['newsletter-confirm'],
    },
    logger,
  );

  await record(db, {
    recipientType: 'subscriber',
    recipientId: subscriber.id,
    type: 'newsletter.confirm',
    title: 'Newsletter confirmation',
    message: 'Confirmation link sent.',
    // Never the token or the address.
    data: { subscriberId: subscriber.id },
    result,
    attempts: job.attemptsMade,
    logger,
  });
  throwIfRetryable(result);
  return { sent: result.sent };
}

// ── staff.invite / staff.password_reset ─────────────────────────────────────

async function processStaffToken(
  kind: 'invite' | 'reset',
  job: Job<StaffTokenJob>,
  deps: CommunicationsDeps,
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { db } = deps.database;
  const [user] = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName, status: users.status })
    .from(users)
    .where(eq(users.id, job.data.userId))
    .limit(1);

  const expected = kind === 'invite' ? 'invited' : 'active';
  if (!user || user.status !== expected) {
    return { sent: false, reason: 'not_applicable' };
  }

  const name = user.firstName?.trim() || 'there';
  const url = link(
    deps.appUrl,
    `${kind === 'invite' ? '/admin/accept-invite' : '/admin/reset-password'}#token=${job.data.token}`,
  );
  const type = kind === 'invite' ? 'staff.invite' : 'staff.password_reset';

  const subject =
    kind === 'invite'
      ? 'You have been invited to the Sailent Foundation admin'
      : 'Reset your Sailent Foundation admin password';
  const lead =
    kind === 'invite'
      ? 'You have been invited to the Sailent Foundation admin. Choose your password to activate the account:'
      : 'Somebody asked to reset the password for your Sailent Foundation admin account. Choose a new one here:';
  const expiry =
    kind === 'invite'
      ? 'The link works once, for 7 days.'
      : 'The link works once, for 1 hour. Setting a new password signs out every existing session.';
  const ignore =
    kind === 'invite'
      ? 'If you were not expecting this, ignore it — no account is usable until a password is set.'
      : 'If you did not ask for this, ignore it — your password has not changed.';

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: user.email, name: name === 'there' ? undefined : name },
      subject,
      html: SHELL(`
  <p>Hello ${escapeHtml(name)},</p>
  <p>${escapeHtml(lead)}</p>
  <p><a href="${escapeHtml(url)}">${kind === 'invite' ? 'Set my password' : 'Choose a new password'}</a></p>
  <p>${escapeHtml(expiry)}</p>
  <p style="font-size:13px">${escapeHtml(ignore)}</p>`),
      text: `Hello ${name},\n\n${lead}\n\n${url}\n\n${expiry}\n\n${ignore}`,
      tags: [kind === 'invite' ? 'staff-invite' : 'staff-password-reset'],
    },
    logger,
  );

  await record(db, {
    recipientType: 'user',
    recipientId: user.id,
    type,
    title: kind === 'invite' ? 'Staff invitation' : 'Staff password reset',
    message: kind === 'invite' ? 'Invitation link sent.' : 'Password-reset link sent.',
    // Never the token or the link.
    data: { userId: user.id },
    result,
    attempts: job.attemptsMade,
    logger,
  });
  throwIfRetryable(result);
  return { sent: result.sent };
}

export function processStaffInvite(
  job: Job<StaffTokenJob>,
  deps: CommunicationsDeps,
  logger: Logger,
) {
  return processStaffToken('invite', job, deps, logger);
}

export function processStaffPasswordReset(
  job: Job<StaffTokenJob>,
  deps: CommunicationsDeps,
  logger: Logger,
) {
  return processStaffToken('reset', job, deps, logger);
}
