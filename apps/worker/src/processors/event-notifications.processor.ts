import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { and, eq, inArray } from 'drizzle-orm';

import QRCode from 'qrcode';

import { eventRegistrations, events, notifications, type DatabaseClient } from '@sailent/database';
import { passNumberFor, passesOf } from '@sailent/validation';

import { SAILENT_LOGO_PNG, SAILENT_LOGO_SIZE } from '@sailent/documents';
import { sendEmail, type EmailAttachment, type Mailer } from '../lib/email.js';
import { readOrganisationContact } from '../lib/organisation.js';
import { renderPassPdf } from '../lib/pass-pdf.js';
import { registrationEmail } from './event-registration-email.js';
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
/** "18 November 2026 at 10:55 pm", India time: when a booking was made and paid. */
const BOOKED_AT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

/** "Friday, 20 November 2026" in the event's zone. */
function eventDate(start: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(start);
}

/** "10:00 am – 8:00 pm" in the event's zone. */
function eventTime(start: Date, end: Date | null, timeZone: string): string {
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
  return end ? `${time.format(start)} – ${time.format(end)}` : time.format(start);
}

/**
 * A pass's QR code as a PNG. It holds the pass number exactly as the gate
 * scanner reads it — the same value the pass on the website encodes.
 */
export async function passQrPng(passNumber: string): Promise<Buffer> {
  return QRCode.toBuffer(passNumber, {
    type: 'png',
    width: 264,
    margin: 4,
    errorCorrectionLevel: 'M',
  });
}

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
  venueName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}): string {
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
  deps: { database: DatabaseClient; mailer: Mailer; appUrl: string },
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
  const zone = row.event.timezone || 'Asia/Kolkata';

  /*
    The stored template keeps the SUBJECT editable. Its body is shown only once
    an administrator has written their own (it differs from the shipped
    wording; see `isCustomised`), as "A note from the organisers": the shipped
    wording says what the layout below already says, and would only repeat it.
  */
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

  /*
    ══════════════════════════════════════════════════════════════════════════
    THE PASSES, THE PDF AND THE PAYMENT, IN EVERY CONFIRMATION.

    A guest who registered without an account has no other copy of their
    pass, so the email carries everything needed at the gate: each person's
    QR code inline, and the passes as a PDF (one page per person, the same
    design as the website's download).

    The passes are `passesOf`, the same numbers the gate scanner checks. The
    payment is the registration's own record — the amount actually paid and
    Razorpay's payment id — never recomputed from today's fee. The
    registration is written only once the payment is verified, so its time is
    the payment's.

    A QR image or the PDF that cannot be drawn is left out with a warning;
    it never stops the confirmation.
    ══════════════════════════════════════════════════════════════════════════
  */
  const passes = passesOf({
    id: row.registration.id,
    fullName: row.registration.fullName,
    attendees: row.registration.attendees,
  });
  const paidAmount = row.registration.paidAmount ?? 0;
  const bookingReference = passNumberFor(row.registration.id);
  const venueLine =
    [row.event.address, row.event.city, row.event.state].filter(Boolean).join(', ') || null;
  const contact = await readOrganisationContact(db);

  let pdf: Buffer | null = null;
  try {
    pdf = await renderPassPdf({
      eventTitle: row.event.title,
      startDate: row.event.startDate,
      endDate: row.event.endDate,
      timezone: zone,
      venueName: row.event.venueName,
      venueLine,
      functionName: row.registration.functionName,
      passes,
      feePerPass: paidAmount > 0 ? Math.round(paidAmount / passes.length) : null,
      issuedAt: row.registration.registeredAt,
      supportLine: [contact.email, contact.phone].filter(Boolean).join(' | ') || null,
    });
  } catch (error) {
    logger.warn({ registrationId, err: String(error) }, 'Could not build the pass PDF');
  }

  /*
    The PDF carries the passes and their QR codes, so the body does not repeat
    them. Only without it are the QR codes drawn for the email itself — the
    one copy a guest without an account would otherwise lack.
  */
  const images: (Buffer | null)[] = pdf
    ? passes.map(() => null)
    : await Promise.all(
        passes.map((pass) =>
          passQrPng(pass.passNumber).catch((error: unknown) => {
            logger.warn({ registrationId, err: String(error) }, 'Could not draw a pass QR code');
            return null;
          }),
        ),
      );

  const email = registrationEmail({
    name,
    eventTitle: row.event.title,
    date: eventDate(row.event.startDate, zone),
    time: eventTime(row.event.startDate, row.event.endDate, zone),
    venueName: row.event.venueName,
    venueLine,
    functionName: row.registration.functionName,
    joiningUrl: row.event.meetingUrl ?? null,
    eventUrl,
    bookingReference,
    bookedOn: BOOKED_AT.format(row.registration.registeredAt),
    passes: passes.map((pass, index) => ({
      fullName: pass.fullName,
      passNumber: pass.passNumber,
      qrContentId: images[index] ? `pass-${index + 1}` : null,
    })),
    pdfAttached: pdf !== null,
    payment:
      paidAmount > 0
        ? {
            total: paidAmount,
            perPass: paidAmount % passes.length === 0 ? paidAmount / passes.length : null,
            reference: row.registration.paymentId ?? null,
            paidOn: BOOKED_AT.format(row.registration.registeredAt),
          }
        : null,
    contact,
    replyable: deps.mailer.replyTo !== null,
    customMessage:
      rendered && rendered.customised ? { html: rendered.html, text: rendered.text } : null,
  });

  const attachments: EmailAttachment[] = [
    {
      filename: 'sailent-foundation.png',
      content: SAILENT_LOGO_PNG,
      contentType: 'image/png',
      contentId: 'sailent-logo',
    },
    ...passes.flatMap((pass, index) => {
      const image = images[index];
      return image
        ? [
            {
              filename: `${pass.passNumber}.png`,
              content: image,
              contentType: 'image/png',
              contentId: `pass-${index + 1}`,
            },
          ]
        : [];
    }),
    ...(pdf
      ? [
          {
            filename: `${passes.length > 1 ? 'Entry-passes' : 'Entry-pass'}-${bookingReference}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ]
      : []),
  ];

  const result = await sendEmail(
    deps.mailer,
    {
      to: { email: row.registration.email, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? `Booking confirmed — ${row.event.title}`,
      html: email.html,
      text: email.text,
      preheader: email.preheader,
      tags: ['event-registration', row.event.slug],
      attachments,
      headerLogo: {
        contentId: 'sailent-logo',
        width: 160,
        height: Math.round((160 * SAILENT_LOGO_SIZE.height) / SAILENT_LOGO_SIZE.width),
      },
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
      throw new Error(`Email provider unreachable: ${result.detail ?? ''}`);
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
  deps: { database: DatabaseClient; mailer: Mailer; appUrl: string },
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
      deps.mailer,
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
    throw new Error(`Email provider unreachable for ${failed} of ${recipients.length} recipients`);
  }

  return { sent, failed };
}
