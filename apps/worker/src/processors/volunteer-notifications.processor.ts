import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { eq } from 'drizzle-orm';

import {
  notifications,
  volunteerAssignments,
  volunteerCertificates,
  volunteers,
  type DatabaseClient,
} from '@sailent/database';

import { sendEmail, type BrevoConfig } from '../lib/brevo.js';
import { renderFromTemplate, type RenderedTemplate } from '../lib/templates.js';
import { alertStaffOfFailedSend } from '../lib/admin-alert.js';

export interface VolunteerApplicationJob {
  volunteerId: string;
}
export interface VolunteerDecisionJob {
  volunteerId: string;
}
export interface VolunteerAssignedJob {
  assignmentId: string;
}
export interface VolunteerCertificateJob {
  certificateId: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(value: Date, timezone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(value);
}

/**
 * Record what happened, whether or not it was sent.
 *
 * A notification row with `status: 'failed'` and a reason is how an unsent
 * message becomes visible. Returning silently would mean nobody knows somebody
 * is waiting for an email that is never coming.
 */
async function record(
  db: DatabaseClient['db'],
  entry: {
    recipientId: string | null;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown>;
    result: Awaited<ReturnType<typeof sendEmail>>;
    /** Which stored template rendered this, when one did. */
    rendered?: RenderedTemplate | null;
    /** Attempts made before this one, from the job. */
    attempts?: number;
    /** Supplied so a failed send can raise an in-app alert. */
    logger?: Logger;
  },
): Promise<void> {
  await db.insert(notifications).values({
    recipientType: 'volunteer',
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
    templateId: entry.rendered?.templateId ?? null,
    templateVersion: entry.rendered?.templateVersion ?? null,
    retryCount: entry.attempts ?? 0,
  });

  /*
    One place for all four volunteer emails, because they all come through
    here. An administrator finds out from the bell rather than from the
    volunteer.
  */
  if (!entry.result.sent && entry.logger) {
    await alertStaffOfFailedSend(
      db,
      {
        type: entry.type,
        summary: entry.title,
        reason: entry.result.reason,
        context: entry.data,
      },
      entry.logger,
    );
  }
}

/** Only `unreachable` is worth retrying; the rest are permanent. */
function throwIfRetryable(result: Awaited<ReturnType<typeof sendEmail>>): void {
  if (!result.sent && result.reason === 'unreachable') {
    throw new Error(`Brevo unreachable: ${result.detail ?? ''}`);
  }
}

const SHELL = (body: string) =>
  `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;color:#1f2933">${body}
  <p style="font-size:13px;color:#52606d;border-top:1px solid #d9e2ec;padding-top:14px">Sailent Foundation</p>
</div>`;

/**
 * We have your application.
 *
 * Deliberately says nothing about timing or likelihood. An acknowledgement
 * that promises "we will be in touch within a week" is a promise a small
 * organisation cannot keep during a flood, and breaking it is worse than
 * never having made it.
 */
export async function processVolunteerApplication(
  job: Job<VolunteerApplicationJob>,
  deps: { database: DatabaseClient; brevo: BrevoConfig; appUrl: string },
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { db } = deps.database;
  const [volunteer] = await db
    .select()
    .from(volunteers)
    .where(eq(volunteers.id, job.data.volunteerId))
    .limit(1);

  if (!volunteer?.email) {
    logger.warn({ volunteerId: job.data.volunteerId }, 'Application job found no address');
    return { sent: false, reason: 'no_address' };
  }

  const name = volunteer.firstName?.trim() || 'there';
  const text = `Hello ${name},

Thank you for offering to volunteer with Sailent Foundation. We have your application and somebody will read it.

We will write to you once it has been considered. There is nothing you need to do in the meantime.

With thanks,
Sailent Foundation`;

  const rendered = await renderFromTemplate(
    db,
    'volunteer.application.received',
    { volunteerName: name },
    logger,
  );

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: volunteer.email, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? 'We have your volunteer application',
      html:
        rendered?.html ??
        SHELL(`
  <p>Hello ${escapeHtml(name)},</p>
  <p>Thank you for offering to volunteer with Sailent Foundation. We have your application and somebody will read it.</p>
  <p>We will write to you once it has been considered. There is nothing you need to do in the meantime.</p>`),
      text: rendered?.text ?? text,
      tags: ['volunteer-application'],
    },
    logger,
  );

  await record(db, {
    recipientId: volunteer.id,
    type: 'volunteer.application.received',
    title: 'Volunteer application received',
    message: 'We have your application and somebody will read it.',
    data: { volunteerId: volunteer.id },
    result,
    rendered,
    attempts: job.attemptsMade,
    logger,
  });

  throwIfRetryable(result);
  return { sent: result.sent };
}

/**
 * The decision.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A REJECTION CARRIES NO REASON, AND THAT IS DELIBERATE.
 *
 * The reason is recorded — on the application and in the audit log — and it is
 * ADMIN-ONLY. Quoting it here would turn every decline into a negotiation the
 * organisation has no obligation to have, and would push reviewers to write
 * notes that are diplomatic rather than candid, which destroys the value of
 * having them.
 *
 * The job payload carries only an id for the same reason: the processor cannot
 * accidentally include what it never received.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function processVolunteerDecision(
  job: Job<VolunteerDecisionJob>,
  deps: { database: DatabaseClient; brevo: BrevoConfig; appUrl: string },
  logger: Logger,
  outcome: 'approved' | 'rejected',
): Promise<{ sent: boolean; reason?: string }> {
  const { db } = deps.database;
  const [volunteer] = await db
    .select()
    .from(volunteers)
    .where(eq(volunteers.id, job.data.volunteerId))
    .limit(1);

  if (!volunteer?.email) {
    logger.warn({ volunteerId: job.data.volunteerId }, 'Decision job found no address');
    return { sent: false, reason: 'no_address' };
  }

  /*
    The state is RE-READ before sending. A decision reversed within the minute
    — which happens, because a reviewer clicks the wrong button — must not go
    out anyway.
  */
  const stillMatches =
    outcome === 'approved'
      ? ['approved', 'active'].includes(volunteer.status)
      : volunteer.status === 'rejected';

  if (!stillMatches) {
    logger.info(
      { volunteerId: volunteer.id, status: volunteer.status },
      'Decision changed before the message went out; nothing sent',
    );
    return { sent: false, reason: 'superseded' };
  }

  const name = volunteer.firstName?.trim() || 'there';
  const dashboard = `${deps.appUrl.replace(/\/$/, '')}/dashboard/volunteering`;

  const { subject, html, text } =
    outcome === 'approved'
      ? {
          subject: 'Welcome to the Sailent Foundation volunteer team',
          text: `Hello ${name},

Your application has been approved. Your volunteer number is ${volunteer.volunteerId}.

You can see your assignments, your hours and any certificates here: ${dashboard}

Sign in with this email address — we will send you a six-digit code. There is no password.

With thanks,
Sailent Foundation`,
          html: SHELL(`
  <p>Hello ${escapeHtml(name)},</p>
  <p>Your application has been <strong>approved</strong>. Your volunteer number is
     <strong>${escapeHtml(volunteer.volunteerId ?? '')}</strong>.</p>
  <p><a href="${dashboard}">See your assignments, hours and certificates</a></p>
  <p style="font-size:13px;color:#52606d">Sign in with this email address and we will send you a
     six-digit code. There is no password to create.</p>`),
        }
      : {
          subject: 'Your volunteer application',
          text: `Hello ${name},

Thank you for offering to volunteer with us. On this occasion we are not able to take your application forward.

We are grateful you asked, and we wish you well.

Sailent Foundation`,
          html: SHELL(`
  <p>Hello ${escapeHtml(name)},</p>
  <p>Thank you for offering to volunteer with us. On this occasion we are not able to take your
     application forward.</p>
  <p>We are grateful you asked, and we wish you well.</p>`),
        };

  /*
    The rejection template has NO variable for the internal reason, and this
    call supplies none. `volunteers.rejection_reason` is written for colleagues.
  */
  const rendered = await renderFromTemplate(
    db,
    outcome === 'approved' ? 'volunteer.approved' : 'volunteer.rejected',
    { volunteerName: name, volunteerId: volunteer.volunteerId ?? '' },
    logger,
  );

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: volunteer.email, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? subject,
      html: rendered?.html ?? html,
      text: rendered?.text ?? text,
      tags: [`volunteer-${outcome}`],
    },
    logger,
  );

  await record(db, {
    recipientId: volunteer.id,
    type: `volunteer.${outcome}`,
    title: outcome === 'approved' ? 'Volunteer application approved' : 'Volunteer application',
    message: subject,
    // No reason, on either branch. See the note above.
    data: { volunteerId: volunteer.id, volunteerCode: volunteer.volunteerId },
    result,
    rendered,
    attempts: job.attemptsMade,
    logger,
  });

  throwIfRetryable(result);
  return { sent: result.sent };
}

/** A volunteer has been given work. */
export async function processVolunteerAssigned(
  job: Job<VolunteerAssignedJob>,
  deps: { database: DatabaseClient; brevo: BrevoConfig; appUrl: string },
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { db } = deps.database;
  const [row] = await db
    .select({ assignment: volunteerAssignments, volunteer: volunteers })
    .from(volunteerAssignments)
    .innerJoin(volunteers, eq(volunteers.id, volunteerAssignments.volunteerId))
    .where(eq(volunteerAssignments.id, job.data.assignmentId))
    .limit(1);

  if (!row?.volunteer.email) {
    logger.warn({ assignmentId: job.data.assignmentId }, 'Assignment job found no address');
    return { sent: false, reason: 'no_address' };
  }

  if (row.assignment.status === 'cancelled') {
    logger.info({ assignmentId: row.assignment.id }, 'Assignment cancelled before notice went out');
    return { sent: false, reason: 'cancelled' };
  }

  const name = row.volunteer.firstName?.trim() || 'there';
  const when = formatWhen(row.assignment.startsAt);
  const where = row.assignment.location ?? 'To be confirmed';
  const dashboard = `${deps.appUrl.replace(/\/$/, '')}/dashboard/volunteering`;

  const rendered = await renderFromTemplate(
    db,
    'volunteer.assigned',
    {
      volunteerName: name,
      role: row.assignment.role,
      // The assignment carries a location, not an event title — an assignment
      // is not always to an event.
      eventTitle: where,
      startsAt: when,
    },
    logger,
  );
  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: row.volunteer.email, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? `You have been assigned — ${row.assignment.role}`,
      html:
        rendered?.html ??
        SHELL(`
  <p>Hello ${escapeHtml(name)},</p>
  <p>You have been assigned to <strong>${escapeHtml(row.assignment.role)}</strong>.</p>
  <table style="border-collapse:collapse;margin:18px 0">
    <tbody>
      <tr><td style="padding:4px 16px 4px 0;color:#52606d">When</td><td style="padding:4px 0"><strong>${escapeHtml(when)}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#52606d">Where</td><td style="padding:4px 0">${escapeHtml(where)}</td></tr>
    </tbody>
  </table>
  <p><a href="${dashboard}">See all your assignments</a></p>
  <p style="font-size:13px;color:#52606d">If you cannot make it, tell us as soon as you can so the
     place can go to somebody else.</p>`),
      text: `Hello ${name},

You have been assigned to ${row.assignment.role}.

When:  ${when}
Where: ${where}

${dashboard}

If you cannot make it, tell us as soon as you can.

Sailent Foundation`,
      tags: ['volunteer-assigned'],
    },
    logger,
  );

  await record(db, {
    recipientId: row.volunteer.id,
    type: 'volunteer.assigned',
    title: `Assigned — ${row.assignment.role}`,
    message: `${when} · ${where}`,
    data: { assignmentId: row.assignment.id, volunteerId: row.volunteer.id },
    result,
    rendered,
    attempts: job.attemptsMade,
    logger,
  });

  throwIfRetryable(result);
  return { sent: result.sent };
}

/**
 * A certificate has been issued.
 *
 * The email carries the VERIFICATION CODE, because the volunteer needs it to
 * give to an employer. It is the one place that code legitimately travels, and
 * it goes to the address on the volunteer's own record.
 */
export async function processVolunteerCertificate(
  job: Job<VolunteerCertificateJob>,
  deps: { database: DatabaseClient; brevo: BrevoConfig; appUrl: string },
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { db } = deps.database;
  const [row] = await db
    .select({ certificate: volunteerCertificates, volunteer: volunteers })
    .from(volunteerCertificates)
    .innerJoin(volunteers, eq(volunteers.id, volunteerCertificates.volunteerId))
    .where(eq(volunteerCertificates.id, job.data.certificateId))
    .limit(1);

  if (!row?.volunteer.email) {
    logger.warn({ certificateId: job.data.certificateId }, 'Certificate job found no address');
    return { sent: false, reason: 'no_address' };
  }

  // Withdrawn between issue and send. Announcing a certificate that no longer
  // stands would be worse than saying nothing.
  if (row.certificate.status !== 'issued') {
    logger.info({ certificateId: row.certificate.id }, 'Certificate withdrawn before notice sent');
    return { sent: false, reason: 'revoked' };
  }

  const name = row.volunteer.firstName?.trim() || 'there';
  const verifyUrl = `${deps.appUrl.replace(/\/$/, '')}/verify/${row.certificate.verificationCode}`;
  const hours = row.certificate.hoursCredited;

  const rendered = await renderFromTemplate(
    db,
    'volunteer.certificate.issued',
    {
      volunteerName: name,
      certificateCode: row.certificate.certificateNumber,
      hours,
    },
    logger,
  );
  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: row.volunteer.email, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? 'Your certificate of service',
      html:
        rendered?.html ??
        SHELL(`
  <p>Hello ${escapeHtml(name)},</p>
  <p>Thank you for the <strong>${hours} ${hours === 1 ? 'hour' : 'hours'}</strong> you gave between
     ${escapeHtml(row.certificate.periodStart)} and ${escapeHtml(row.certificate.periodEnd)}.</p>
  <p><strong>Certificate number:</strong> ${escapeHtml(row.certificate.certificateNumber)}</p>
  <p>Anybody can confirm this certificate is genuine at:<br>
     <a href="${verifyUrl}">${verifyUrl}</a></p>
  <p style="font-size:13px;color:#52606d">Keep that link — an employer can use it to verify your
     service without needing an account.</p>`),
      text: `Hello ${name},

Thank you for the ${hours} ${hours === 1 ? 'hour' : 'hours'} you gave between ${row.certificate.periodStart} and ${row.certificate.periodEnd}.

Certificate number: ${row.certificate.certificateNumber}

Anybody can confirm this certificate is genuine at:
${verifyUrl}

Keep that link — an employer can use it without needing an account.

With thanks,
Sailent Foundation`,
      tags: ['volunteer-certificate', row.certificate.certificateNumber],
    },
    logger,
  );

  await record(db, {
    recipientId: row.volunteer.id,
    type: 'volunteer.certificate.issued',
    title: 'Certificate of service issued',
    message: `${hours} hours, ${row.certificate.periodStart} to ${row.certificate.periodEnd}`,
    // The verification code is NOT stored on the notification row. It is in
    // the certificate table, and duplicating a secret buys nothing.
    data: {
      certificateId: row.certificate.id,
      certificateNumber: row.certificate.certificateNumber,
    },
    result,
    rendered,
    attempts: job.attemptsMade,
    logger,
  });

  throwIfRetryable(result);
  return { sent: result.sent };
}
