import type { Job } from 'bullmq';
import type { Logger } from 'pino';

import { notifications, type DatabaseClient } from '@sailent/database';

import { sendEmail, type BrevoConfig } from '../lib/brevo.js';
import { renderFromTemplate } from '../lib/templates.js';
import { alertStaffOfFailedSend } from '../lib/admin-alert.js';

export interface DonorLoginCodeJob {
  /** Where to send it. Resolved by the API from the donor record, never from the request. */
  email: string;
  name: string | null;
  code: string;
  /** Minutes the code remains valid, for the copy. */
  ttlMinutes: number;
  /**
   * Phase 12: the same kind of code also confirms a NEW email address. The
   * wording differs, and the stored `donor.login_code` template (which talks
   * about signing in) is not used for it.
   */
  purpose?: 'login' | 'email_change';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Deliver a donor's sign-in code.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY EMAIL, WHEN THE CODE IS KEYED ON A PHONE NUMBER.
 *
 * SMS is the intended channel and is still not available: sending transactional
 * SMS in India needs a DLT-registered sender id and pre-approved templates, and
 * the vendor is still undecided (Phase 0 open question 3). Until that lands,
 * the alternative to email is that a donor cannot sign in at all.
 *
 * The phone number remains the IDENTIFIER — it is what the code is issued
 * against and what the donor types in. Email is only the delivery channel, and
 * the address is read from the donor record on the server. Nothing about which
 * account is being accessed comes from the request.
 *
 * A donor with no email on file gets no message, which is a real gap and is
 * documented as one in docs/phase-7.md rather than papered over here.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE CODE IS NEVER LOGGED. Not on success, not on failure, not in the job's
 * error message. The whole point of hashing it in the database is undone by one
 * helpful log line, so this file does not have one.
 */
export async function processDonorLoginCode(
  job: Job<DonorLoginCodeJob>,
  deps: { brevo: BrevoConfig; appUrl: string; database: DatabaseClient },
  logger: Logger,
): Promise<{ sent: boolean }> {
  const { email, name, code, ttlMinutes } = job.data;
  const emailChange = job.data.purpose === 'email_change';

  if (!email) {
    logger.warn({ jobId: job.id }, 'Donor sign-in code job had no address; nothing sent');
    return { sent: false };
  }

  const greeting = name?.trim() ? `Hello ${escapeHtml(name.trim())},` : 'Hello,';

  const text = [
    greeting.replace(/<[^>]*>/g, ''),
    '',
    emailChange
      ? `Your code to confirm this as your new Sailent Foundation email address is ${code}`
      : `Your Sailent Foundation sign-in code is ${code}`,
    '',
    `It is valid for ${ttlMinutes} minutes and can be used once.`,
    '',
    emailChange
      ? 'If you did not ask to use this address, ignore this message — the address'
      : 'If you did not ask to sign in, you can ignore this message — nobody can',
    emailChange
      ? 'will not be added to any account without this code.'
      : 'use this code without it, and it will expire on its own.',
    '',
    'We will never ask you for this code by phone, email or message.',
    '',
    'Sailent Foundation',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
      <p style="font-size:15px;margin:0 0 16px">${greeting}</p>
      <p style="font-size:15px;margin:0 0 20px">${
        emailChange ? 'Your code to confirm this new email address is:' : 'Your sign-in code is:'
      }</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:0.18em;margin:0 0 20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(code)}</p>
      <p style="font-size:14px;color:#555;margin:0 0 20px">Valid for ${ttlMinutes} minutes, and it can be used once.</p>
      <p style="font-size:14px;color:#555;margin:0 0 20px">${
        emailChange
          ? 'If you did not ask to use this address, ignore this message. It will not be added to any account without this code.'
          : 'If you did not ask to sign in, you can ignore this message. Nobody can use this code without it and it will expire on its own.'
      }</p>
      <p style="font-size:14px;color:#555;margin:0 0 24px">
        <strong>We will never ask you for this code</strong> by phone, email or message.
      </p>
      <p style="font-size:13px;color:#888;margin:0">Sailent Foundation</p>
    </div>
  `.trim();

  // The stored template is the SIGN-IN email; an email-change code uses the
  // built-in wording above.
  const rendered = emailChange
    ? null
    : await renderFromTemplate(
        deps.database.db,
        'donor.login_code',
        { code, minutes: ttlMinutes },
        logger,
      );

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email, ...(name ? { name } : {}) },
      subject:
        rendered?.subject ??
        (emailChange
          ? 'Confirm your new Sailent Foundation email address'
          : 'Your Sailent Foundation sign-in code'),
      html: rendered?.html ?? html,
      text: rendered?.text ?? text,
      // No tag carrying the code or the phone number — Brevo stores tags.
      tags: [emailChange ? 'donor-email-change' : 'donor-login'],
    },
    logger,
  );

  /*
    ══════════════════════════════════════════════════════════════════════════
    A LOG ENTRY WITH NO SECRET IN IT.

    §4.21 asks that every transactional email have a log entry and a delivery
    status, and this one had neither — the only send in the platform that left
    no trace. So it has one now, and what it does NOT contain is the point:

      • not the code, which is hashed in the database precisely so that it
        exists nowhere in plaintext;
      • not the address, because `notifications.data` is readable by every
        administrator with `notification.read`, and a sign-in attempt is not
        theirs to browse.

    What is recorded is that a sign-in code was sent and whether it arrived,
    which is what an administrator debugging "I never got the email" needs and
    the most they are entitled to.
    ══════════════════════════════════════════════════════════════════════════
  */
  await deps.database.db.insert(notifications).values({
    recipientType: 'donor',
    type: 'donor.login_code',
    title: emailChange ? 'Email change code' : 'Sign-in code',
    message: emailChange
      ? 'A code to confirm a new email address was requested.'
      : 'A one-time sign-in code was requested.',
    data: null,
    channel: 'email',
    status: result.sent ? 'sent' : 'failed',
    sentAt: result.sent ? new Date() : null,
    error: result.sent ? null : result.reason,
    providerMessageId: result.sent ? result.providerMessageId : null,
    templateId: rendered?.templateId ?? null,
    templateVersion: rendered?.templateVersion ?? null,
    retryCount: job.attemptsMade,
  });

  if (!result.sent) {
    /*
      No context at all on this one. A sign-in code that did not arrive is
      worth telling an administrator about; WHOSE is not theirs to see.
    */
    await alertStaffOfFailedSend(
      deps.database.db,
      {
        type: 'donor.login_code',
        summary: 'A sign-in code was not delivered',
        reason: result.reason,
      },
      logger,
    );

    // `reason` is a category, never the address or the code.
    logger.warn({ jobId: job.id, reason: result.reason }, 'Donor sign-in code was not delivered');
  }

  return { sent: result.sent };
}
