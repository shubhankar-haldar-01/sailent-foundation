/**
 * The registration confirmation email: the body, as HTML and plain text.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LAID OUT THE WAY TICKETING EMAILS ARE: confirmation first, then the event,
 * the passes, the payment, what to bring, and where to get help — each a
 * section with a heading, so it reads at a glance on a phone. It sits inside
 * the shared shell (`lib/email-layout.ts`) and is built from email-safe
 * parts only: tables, inline styles, a table-based button.
 *
 * Everything shown is a record: the passes are the numbers the gate checks,
 * the payment is the booking's own amount and Razorpay reference, and the
 * help section shows only contact details the organisation has entered.
 *
 * Colours follow AGENTS.md §11 item 12: orange #EB6A1F only as a fill (the
 * button, with a white label); orange TEXT is the darker #B3450E.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  C,
  FONT_MONO,
  button,
  contactLinksHtml,
  detailRow,
  escapeHtml,
  heading,
  noteBox,
  rupees,
  statusPill,
} from '../lib/email-parts.js';

export interface RegistrationEmailPass {
  fullName: string;
  passNumber: string;
  /** The inline QR image's content id, or null when it could not be drawn. */
  qrContentId: string | null;
}

export interface RegistrationEmailData {
  name: string;
  eventTitle: string;
  /** e.g. "Friday, 20 November 2026". */
  date: string;
  /** e.g. "10:00 am – 8:00 pm". */
  time: string;
  venueName: string | null;
  venueLine: string | null;
  functionName: string | null;
  joiningUrl: string | null;
  eventUrl: string;
  /** The booking's base pass number, e.g. SF-EVT-D6104E36. */
  bookingReference: string;
  /** e.g. "18 November 2026 at 10:55 pm". */
  bookedOn: string;
  passes: RegistrationEmailPass[];
  pdfAttached: boolean;
  payment: {
    /** Paise, as paid. */
    total: number;
    /** Paise per pass, when the total divides evenly. */
    perPass: number | null;
    reference: string | null;
    paidOn: string;
  } | null;
  contact: { email: string | null; phone: string | null };
  /** Replies to the email reach a person (a reply-to address is set). */
  replyable: boolean;
  /** An administrator's own wording for this email (an edited template). */
  customMessage: { html: string; text: string } | null;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function registrationEmail(data: RegistrationEmailData): {
  html: string;
  text: string;
  preheader: string;
} {
  const count = data.passes.length;
  const passWord = plural(count, 'pass', 'passes');
  const paid = data.payment !== null;

  // ── HTML ────────────────────────────────────────────────────────────────
  /*
    The passes travel as the attached PDF (one page per person, QR codes and
    all), so the body does not list them again. Only if the PDF could not be
    made does the email carry the passes itself — a guest without an account
    has no other copy.
  */
  const listPasses = !data.pdfAttached;
  const intro = `Hi ${escapeHtml(data.name)}, your booking is confirmed${
    paid ? ' and your payment has been received' : ''
  }. ${
    listPasses
      ? `Your entry ${passWord} ${plural(count, 'is', 'are')} below.`
      : `Your entry ${passWord} ${plural(count, 'is', 'are')} attached to this email as a PDF, to print or keep on your phone.`
  }`;

  const eventRows = [
    detailRow('Date', escapeHtml(data.date)),
    detailRow('Time', `${escapeHtml(data.time)} (IST)`),
    detailRow(
      'Venue',
      data.venueName || data.venueLine
        ? `${escapeHtml(data.venueName ?? '')}${
            data.venueLine
              ? `${data.venueName ? '<br>' : ''}<span style="font-weight:400;color:${C.faint}">${escapeHtml(data.venueLine)}</span>`
              : ''
          }`
        : 'Details on the event page',
    ),
    ...(data.functionName ? [detailRow('Activity', escapeHtml(data.functionName))] : []),
    ...(data.joiningUrl
      ? [
          detailRow(
            'Join online',
            `<a href="${escapeHtml(data.joiningUrl)}" style="color:${C.orangeText}">${escapeHtml(data.joiningUrl)}</a>`,
          ),
        ]
      : []),
  ].join('\n    ');

  const passRows = data.passes
    .map(
      (
        pass,
        index,
      ) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${C.line};border-radius:12px;border-collapse:separate;margin:0 0 10px">
    <tr>
      ${
        pass.qrContentId
          ? `<td class="sf-stack sf-stack-first" style="padding:12px;width:132px;vertical-align:middle"><img src="cid:${escapeHtml(pass.qrContentId)}" width="132" height="132" alt="QR code for pass ${escapeHtml(pass.passNumber)}" style="display:block;border:0"></td>`
          : ''
      }
      <td class="sf-stack" style="padding:14px 16px;vertical-align:middle">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.orangeText}">${
          count > 1 ? `Pass ${index + 1} of ${count}` : 'Entry pass'
        }</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:${C.ink}">${escapeHtml(pass.fullName)}</div>
        <div style="margin-top:4px;font-family:${FONT_MONO};font-size:15px;letter-spacing:0.04em;white-space:nowrap;color:${C.ink}">${escapeHtml(pass.passNumber)}</div>
      </td>
    </tr>
  </table>`,
    )
    .join('\n  ');

  const payment = data.payment;
  const paymentHtml = payment
    ? `${heading('Payment summary')}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-size:14px">
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.rule};color:${C.ink}">Entry ${passWord} × ${count}${
        payment.perPass !== null
          ? `<br><span style="font-size:13px;color:${C.faint}">${rupees(payment.perPass)} each</span>`
          : ''
      }</td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.rule};color:${C.ink};vertical-align:top">${rupees(payment.total)}</td>
    </tr>
    <tr>
      <td style="padding:12px 0;font-weight:700;color:${C.ink}">Total paid</td>
      <td align="right" style="padding:12px 0;font-size:16px;font-weight:700;color:${C.ink}">${rupees(payment.total)}</td>
    </tr>
  </table>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:13px;color:${C.muted}">
    <tr><td style="padding:3px 18px 3px 0">Payment method</td><td style="padding:3px 0;color:${C.ink}">Online (Razorpay)</td></tr>
    ${
      payment.reference
        ? `<tr><td style="padding:3px 18px 3px 0">Payment reference</td><td style="padding:3px 0;font-family:${FONT_MONO};color:${C.ink}">${escapeHtml(payment.reference)}</td></tr>`
        : ''
    }
    <tr><td style="padding:3px 18px 3px 0">Paid on</td><td style="padding:3px 0;color:${C.ink}">${escapeHtml(payment.paidOn)}</td></tr>
  </table>`
    : '';

  const customHtml = data.customMessage
    ? noteBox('A note from the organisers', data.customMessage.html)
    : '';

  const contactLinks = contactLinksHtml(data.contact);
  const helpHtml = contactLinks
    ? `Questions, or can't make it? Please ${contactLinks} so your seat can go to someone else.`
    : data.replyable
      ? "Questions, or can't make it? Just reply to this email so your seat can go to someone else."
      : `Questions, or can't make it? See the <a href="${escapeHtml(data.eventUrl)}" style="color:${C.orangeText}">event page</a>.`;

  const html = `${statusPill('BOOKING CONFIRMED')}
  <h1 style="margin:12px 0 8px;text-align:center;font-size:24px;line-height:1.25;color:${C.navy}">You&#39;re going to ${escapeHtml(data.eventTitle)}!</h1>
  <p style="margin:0 0 24px;text-align:center;font-size:15px;line-height:1.6;color:${C.muted}">${intro}</p>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${C.line};border-radius:12px;border-collapse:separate">
    <tr><td style="padding:20px 22px">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.orangeText}">Event details</div>
      <div style="margin:6px 0 12px;font-size:19px;font-weight:700;line-height:1.3;color:${C.ink}">${escapeHtml(data.eventTitle)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
    ${eventRows}
      </table>
      ${button(data.eventUrl, 'View event details')}
    </td></tr>
  </table>
  ${customHtml}

  ${
    listPasses
      ? `${heading(`Your entry ${passWord}`)}
  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${C.muted}">Booking reference <strong style="font-family:${FONT_MONO};color:${C.ink}">${escapeHtml(data.bookingReference)}</strong> &middot; ${count} ${passWord} &middot; booked on ${escapeHtml(data.bookedOn)}</p>
  ${passRows}
  <p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:${C.muted}">Show ${plural(count, 'the QR code', 'each QR code')} at the entrance on your phone. Each pass admits one person.</p>`
      : ''
  }
  ${paymentHtml}

  ${heading('Before you go')}
  <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.75;color:${C.ink}">
    ${
      listPasses
        ? ''
        : `<li>Show ${plural(count, 'the QR code', 'each person&#39;s QR code')} from the attached PDF at the entrance, on your phone or printed.</li>`
    }
    <li>Carry a valid government photo ID matching the name on ${plural(count, 'the pass', 'each pass')}.</li>
    <li>Arrive at least 20 minutes before the start.</li>
    <li>Passes are personal: they can&#39;t be transferred or resold.</li>
  </ul>

  ${heading('Need help?')}
  <p style="margin:0;font-size:14px;line-height:1.6;color:${C.ink}">${helpHtml}</p>

  <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.faint}">You&#39;re receiving this email because you registered for ${escapeHtml(data.eventTitle)}. Keep it as your booking and payment confirmation.</p>`;

  // ── Plain text ──────────────────────────────────────────────────────────
  const lines: string[] = [
    'BOOKING CONFIRMED',
    '',
    `You're going to ${data.eventTitle}!`,
    '',
    `Hi ${data.name}, your booking is confirmed${paid ? ' and your payment has been received' : ''}.${
      data.pdfAttached
        ? ` Your entry ${passWord} ${plural(count, 'is', 'are')} attached as a PDF.`
        : ''
    }`,
    '',
    'EVENT DETAILS',
    `  ${data.eventTitle}`,
    `  Date:  ${data.date}`,
    `  Time:  ${data.time} (IST)`,
    `  Venue: ${[data.venueName, data.venueLine].filter(Boolean).join(', ') || 'Details on the event page'}`,
    ...(data.functionName ? [`  Activity: ${data.functionName}`] : []),
    ...(data.joiningUrl ? [`  Join online: ${data.joiningUrl}`] : []),
    `  ${data.eventUrl}`,
    ...(data.customMessage ? ['', 'A NOTE FROM THE ORGANISERS', data.customMessage.text] : []),
    ...(listPasses
      ? [
          '',
          `YOUR ENTRY ${passWord.toUpperCase()}`,
          `  Booking reference: ${data.bookingReference} (${count} ${passWord}, booked on ${data.bookedOn})`,
          ...data.passes.map(
            (pass, index) =>
              `  ${count > 1 ? `Pass ${index + 1} of ${count}: ` : ''}${pass.fullName}, ${pass.passNumber}`,
          ),
          `  Show ${plural(count, 'the QR code', 'each QR code')} at the entrance. Each pass admits one person.`,
        ]
      : []),
    ...(payment
      ? [
          '',
          'PAYMENT SUMMARY',
          `  Entry ${passWord} x ${count}${
            payment.perPass !== null ? ` (${rupees(payment.perPass)} each)` : ''
          }: ${rupees(payment.total)}`,
          `  Total paid: ${rupees(payment.total)}`,
          '  Payment method: Online (Razorpay)',
          ...(payment.reference ? [`  Payment reference: ${payment.reference}`] : []),
          `  Paid on: ${payment.paidOn}`,
        ]
      : []),
    '',
    'BEFORE YOU GO',
    ...(listPasses
      ? []
      : [
          `  - Show ${plural(count, 'the QR code', "each person's QR code")} from the attached PDF at the entrance, on your phone or printed.`,
        ]),
    `  - Carry a valid government photo ID matching the name on ${plural(count, 'the pass', 'each pass')}.`,
    '  - Arrive at least 20 minutes before the start.',
    "  - Passes are personal: they can't be transferred or resold.",
    '',
    'NEED HELP?',
    `  ${
      contactLinks
        ? `Questions, or can't make it? ${[
            data.contact.email ? `Email ${data.contact.email}` : null,
            data.contact.phone ? `call ${data.contact.phone}` : null,
          ]
            .filter(Boolean)
            .join(' or ')}, so your seat can go to someone else.`
        : data.replyable
          ? "Questions, or can't make it? Just reply to this email."
          : `Questions, or can't make it? See ${data.eventUrl}`
    }`,
    '',
    'Sailent Foundation',
  ];

  return {
    html,
    text: lines.join('\n'),
    preheader: `${count} ${passWord} for ${data.eventTitle} on ${data.date}${paid ? ' · payment received' : ''}`,
  };
}
