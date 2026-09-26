import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { and, eq, inArray } from 'drizzle-orm';

import { eventRegistrations, events, notifications, type DatabaseClient } from '@sailent/database';

import { sendEmail, type BrevoConfig } from '../lib/brevo.js';
import { renderFromTemplate } from '../lib/templates.js';
import { alertStaffOfFailedSend } from '../lib/admin-alert.js';

export interface EventRegistrationConfirmedJob {
  registrationId: string;
}

export interface EventCancelledJob {
  eventId: string;
  title: string;
  reason: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The event's date and time, written the way a person reads it.
 *
 * `Asia/Kolkata` by default and by the event's own `timezone` where it has
 * one. The server runs in UTC, and an email that tells somebody to turn up at
 * 04:00 for a 09:30 camp is worse than no email.
 */
function formatWhen(start: Date, end: Date | null, timezone: string): string {
  const zone = timezone || 'Asia/Kolkata';
  const date = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: zone,
  }).format(start);

  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: zone,
  }).format(start);

  if (!end) return `${date}, ${time}`;

  const endTime = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: zone,
  }).format(end);

  return `${date}, ${time} – ${endTime}`;
}

function formatWhere(event: {
  isOnline: boolean;
  venueName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}): string {
  if (event.isOnline) return 'Online';
  return (
    [event.venueName, event.address, event.city, event.state].filter(Boolean).join(', ') ||
    'To be confirmed'
  );
}

/**
 * Confirm one person's registration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE STATE IS RE-READ BEFORE ANYTHING IS SENT.
 *
 * The queue guarantees at-least-once delivery, and this job can arrive after
 * the person has already cancelled, or after the event itself was called off.
 * Confirming a place somebody gave up — or one at an event that is no longer
 * happening — is worse than sending nothing, so a registration that is not
 * still live is a no-op rather than a failure.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE JOINING LINK IS IN THIS EMAIL AND NOWHERE PUBLIC. It goes to an address
 * read from the registration row, which the API wrote from the donor's own
 * account — never from a request body.
 */
export async function processEventRegistrationConfirmed(
  job: Job<EventRegistrationConfirmedJob>,
  deps: { database: DatabaseClient; brevo: BrevoConfig; appUrl: string },
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { registrationId } = job.data;
  const { db } = deps.database;

  const [row] = await db
    .select({
      registration: eventRegistrations,
      event: events,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(events.id, eventRegistrations.eventId))
    .where(eq(eventRegistrations.id, registrationId))
    .limit(1);

  if (!row) {
    logger.warn({ registrationId }, 'Registration confirmation job found no registration');
    return { sent: false, reason: 'not_found' };
  }

  if (row.registration.status === 'cancelled') {
    logger.info({ registrationId }, 'Registration was cancelled before the confirmation went out');
    return { sent: false, reason: 'cancelled' };
  }

  if (row.event.registrationStatus === 'cancelled') {
    logger.info({ registrationId }, 'Event was cancelled before the confirmation went out');
    return { sent: false, reason: 'event_cancelled' };
  }

  const when = formatWhen(row.event.startDate, row.event.endDate, row.event.timezone);
  const where = formatWhere(row.event);
  const eventUrl = `${deps.appUrl.replace(/\/$/, '')}/events/${row.event.slug}`;
  const name = row.registration.fullName?.trim() || 'there';
  const seats = row.registration.attendeeCount;

  const joiningLine = row.event.isOnline && row.event.meetingUrl ? row.event.meetingUrl : null;

  const text = `Hello ${name},

You are registered for ${row.event.title}.

When:  ${when}
Where: ${where}
${seats > 1 ? `Places: ${seats}\n` : ''}${joiningLine ? `Joining link: ${joiningLine}\n` : ''}
${
  row.event.organizer ? `Organised by ${row.event.organizer}.\n\n` : ''
}If you can no longer come, please cancel your place so somebody else can take it: ${eventUrl}

With thanks,
Sailent Foundation`;

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;color:#1f2933">
  <p>Hello ${escapeHtml(name)},</p>
  <p>You are registered for <strong>${escapeHtml(row.event.title)}</strong>.</p>
  <table style="border-collapse:collapse;margin:18px 0">
    <tbody>
      <tr><td style="padding:4px 16px 4px 0;color:#52606d">When</td><td style="padding:4px 0"><strong>${escapeHtml(when)}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#52606d">Where</td><td style="padding:4px 0">${escapeHtml(where)}</td></tr>
      ${seats > 1 ? `<tr><td style="padding:4px 16px 4px 0;color:#52606d">Places</td><td style="padding:4px 0">${seats}</td></tr>` : ''}
      ${joiningLine ? `<tr><td style="padding:4px 16px 4px 0;color:#52606d">Joining link</td><td style="padding:4px 0"><a href="${escapeHtml(joiningLine)}">${escapeHtml(joiningLine)}</a></td></tr>` : ''}
    </tbody>
  </table>
  ${row.event.organizer ? `<p style="color:#52606d">Organised by ${escapeHtml(row.event.organizer)}.</p>` : ''}
  <p style="font-size:13px;color:#52606d;border-top:1px solid #d9e2ec;padding-top:14px">
    If you can no longer come, please <a href="${eventUrl}">cancel your place</a> so somebody else can take it.
  </p>
  <p style="font-size:13px;color:#52606d">With thanks,<br>Sailent Foundation</p>
</div>`;

  const rendered = await renderFromTemplate(
    db,
    'event.registration.confirmed',
    {
      attendeeName: name,
      eventTitle: row.event.title,
      eventDate: when,
      eventLocation: where,
    },
    logger,
  );

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: row.registration.email, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? `You’re registered — ${row.event.title}`,
      html: rendered?.html ?? html,
      text: rendered?.text ?? text,
      tags: ['event-registration', row.event.slug],
    },
    logger,
  );

  // Recorded either way. A row with `status: 'failed'` and a reason is how an
  // unsent confirmation becomes visible; returning silently would mean nobody
  // knows somebody is waiting for an email that is never coming.
  await db.insert(notifications).values({
    recipientType: 'donor',
    recipientId: row.registration.donorId,
    type: 'event.registration.confirmed',
    title: `Registered for ${row.event.title}`,
    message: `${when} · ${where}`,
    data: { eventId: row.event.id, slug: row.event.slug, registrationId },
    channel: 'email',
    status: result.sent ? 'sent' : 'failed',
    sentAt: result.sent ? new Date() : null,
    error: result.sent ? null : `${result.reason}${result.detail ? `: ${result.detail}` : ''}`,
    providerMessageId: result.sent ? result.providerMessageId : null,
    templateId: rendered?.templateId ?? null,
    templateVersion: rendered?.templateVersion ?? null,
    retryCount: job.attemptsMade,
  });

  if (!result.sent) {
    await alertStaffOfFailedSend(
      db,
      {
        type: 'event.registration.confirmed',
        summary: `A registration confirmation for ${row.event.title} was not delivered`,
        reason: result.reason,
        context: { eventId: row.event.id, registrationId },
      },
      logger,
    );

    // Only `unreachable` is worth another attempt; the others are permanent and
    // retrying them four more times just delays the dead-letter a human needs.
    if (result.reason === 'unreachable') {
      throw new Error(`Brevo unreachable: ${result.detail ?? ''}`);
    }
    logger.warn({ registrationId, reason: result.reason }, 'Registration confirmation not sent');
    return { sent: false, reason: result.reason };
  }

  logger.info({ registrationId, eventId: row.event.id }, 'Registration confirmation sent');
  return { sent: true };
}

/**
 * Tell everyone holding a place that an event is off.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ONE JOB IN THIS SYSTEM THAT FANS OUT TO MANY PEOPLE.
 *
 * Three consequences, all of them deliberate:
 *
 *   • It re-reads the event and does nothing unless it is still cancelled. A
 *     cancel that was reversed within the minute must not send anyway.
 *
 *   • Recipients are the LIVE registrations only. Somebody who cancelled last
 *     week does not need to hear that the thing they left has been called off.
 *
 *   • A send that fails for one person does not abort the rest. Throwing
 *     halfway would retry the whole batch and re-send to everyone already
 *     reached — so failures are collected, recorded per person, and the job
 *     fails at the END if any address was merely unreachable.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function processEventCancelled(
  job: Job<EventCancelledJob>,
  deps: { database: DatabaseClient; brevo: BrevoConfig; appUrl: string },
  logger: Logger,
): Promise<{ sent: number; failed: number; reason?: string }> {
  const { eventId, reason } = job.data;
  const { db } = deps.database;

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);

  if (!event) {
    logger.warn({ eventId }, 'Cancellation job found no event');
    return { sent: 0, failed: 0, reason: 'not_found' };
  }

  if (event.registrationStatus !== 'cancelled') {
    logger.info({ eventId }, 'Event is no longer cancelled; no notices sent');
    return { sent: 0, failed: 0, reason: 'not_cancelled' };
  }

  const recipients = await db
    .select({
      id: eventRegistrations.id,
      donorId: eventRegistrations.donorId,
      fullName: eventRegistrations.fullName,
      email: eventRegistrations.email,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.status, ['registered', 'confirmed']),
      ),
    );

  if (recipients.length === 0) {
    logger.info({ eventId }, 'Event cancelled with nobody registered');
    return { sent: 0, failed: 0 };
  }

  const when = formatWhen(event.startDate, event.endDate, event.timezone);
  const eventUrl = `${deps.appUrl.replace(/\/$/, '')}/events/${event.slug}`;

  let sent = 0;
  let failed = 0;
  let retryable = false;

  for (const recipient of recipients) {
    const name = recipient.fullName?.trim() || 'there';

    const text = `Hello ${name},

${event.title}, which was to be held on ${when}, has been cancelled.

${reason ? `${reason}\n\n` : ''}We are sorry for the disruption. Your registration needs no action from you.

${eventUrl}

With apologies,
Sailent Foundation`;

    const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;color:#1f2933">
  <p>Hello ${escapeHtml(name)},</p>
  <p><strong>${escapeHtml(event.title)}</strong>, which was to be held on ${escapeHtml(when)}, has been <strong>cancelled</strong>.</p>
  ${reason ? `<p style="border-left:3px solid #d9e2ec;padding-left:12px;color:#52606d">${escapeHtml(reason)}</p>` : ''}
  <p>We are sorry for the disruption. Your registration needs no action from you.</p>
  <p><a href="${eventUrl}">See the event page</a></p>
  <p style="font-size:13px;color:#52606d">With apologies,<br>Sailent Foundation</p>
</div>`;

    const rendered = await renderFromTemplate(
      db,
      'event.cancelled',
      { attendeeName: name, eventTitle: event.title, eventDate: when },
      logger,
    );

    const result = await sendEmail(
      deps.brevo,
      {
        to: { email: recipient.email, name: name === 'there' ? undefined : name },
        subject: rendered?.subject ?? `Cancelled — ${event.title}`,
        html: rendered?.html ?? html,
        text: rendered?.text ?? text,
        tags: ['event-cancelled', event.slug],
      },
      logger,
    );

    await db.insert(notifications).values({
      recipientType: 'donor',
      recipientId: recipient.donorId,
      type: 'event.cancelled',
      title: `${event.title} has been cancelled`,
      message: reason || `The event scheduled for ${when} will not take place.`,
      data: { eventId, slug: event.slug, registrationId: recipient.id },
      channel: 'email',
      status: result.sent ? 'sent' : 'failed',
      sentAt: result.sent ? new Date() : null,
      error: result.sent ? null : `${result.reason}${result.detail ? `: ${result.detail}` : ''}`,
      providerMessageId: result.sent ? result.providerMessageId : null,
      templateId: rendered?.templateId ?? null,
      templateVersion: rendered?.templateVersion ?? null,
      retryCount: job.attemptsMade,
    });

    if (result.sent) {
      sent += 1;
    } else {
      failed += 1;
      await alertStaffOfFailedSend(
        db,
        {
          type: 'event.cancelled',
          summary: `A cancellation notice for ${event.title} was not delivered`,
          reason: result.reason,
          context: { eventId, registrationId: recipient.id },
        },
        logger,
      );
      if (result.reason === 'unreachable') retryable = true;
    }
  }

  logger.info({ eventId, sent, failed }, 'Event cancellation notices processed');

  if (retryable) {
    /**
     * Retried as a whole, and that is acceptable HERE specifically.
     *
     * A duplicate cancellation notice is a second copy of news the person has
     * already had — mildly annoying. A missing one means somebody travels to an
     * event that is not happening. Given the choice, send twice.
     */
    throw new Error(`Brevo unreachable for ${failed} of ${recipients.length} recipients`);
  }

  return { sent, failed };
}
