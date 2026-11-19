import {
  C,
  FONT_MONO,
  button,
  contactLinksHtml,
  contactLinksText,
  detailRow,
  escapeHtml,
  heading,
  noteBox,
  rupees,
  statusPill,
  type ContactDetails,
} from '../lib/email-parts.js';

/**
 * The donor's thank-you and receipt email: the body, as HTML and plain text.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LAID OUT THE WAY DONATION RECEIPTS ARE: the thanks first, the amount large
 * enough to read at a glance, what the gift was made of, the receipt details
 * a donor or an accountant will look for, then the tax note and where to get
 * help. The receipt itself travels as the attached PDF.
 *
 * Everything shown is a record: the lines are the donation's own snapshot,
 * the payment reference is the one the capture recorded, and the help section
 * shows only contact details the organisation has entered.
 *
 * IT SAYS A RECEIPT, NEVER A CERTIFICATE. Section 80G relief comes from Form
 * 10BE, issued by the Income Tax Department after the organisation's annual
 * Form 10BD filing (decision A7). The note below is the approved wording; it
 * is what stops a donor believing they already hold a certificate.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface DonationEmailLine {
  itemName: string;
  itemType: string;
  quantity: number;
  /** Paise. */
  totalPrice: number;
}

export interface DonationEmailData {
  /** How to greet the donor: their first name, or "there". */
  greetingName: string;
  /** The name on the receipt. */
  donorName: string;
  campaignTitle: string;
  programTitle: string | null;
  /** Paise. */
  amount: number;
  lines: DonationEmailLine[];
  receiptNumber: string;
  donationReference: string;
  paymentReference: string | null;
  /** e.g. "19 November 2026, 2:15 am IST", or null if the receipt has no date. */
  paidOn: string | null;
  statusUrl: string;
  pdfAttached: boolean;
  contact: ContactDetails;
  /** Replies to the email reach a person (a reply-to address is set). */
  replyable: boolean;
  /** An administrator's own wording for this email (an edited template). */
  customMessage: { html: string; text: string } | null;
}

export const RECEIPT_NOTE_TEXT =
  'This is your receipt for the payment. It is not a tax-exemption certificate. ' +
  'If you are claiming relief under Section 80G, the Income Tax Department issues Form 10BE ' +
  'after our annual Form 10BD filing, and it will reach you separately.';

export function donationEmail(data: DonationEmailData): {
  html: string;
  text: string;
  preheader: string;
} {
  const amount = rupees(data.amount);

  // ── HTML ────────────────────────────────────────────────────────────────
  const intro = `Your donation to <strong style="color:${C.ink}">${escapeHtml(data.campaignTitle)}</strong> has been received. ${
    data.pdfAttached
      ? 'Your receipt is attached to this email as a PDF, to keep for your records.'
      : 'Your receipt details are below; keep this email for your records.'
  }`;

  const lineRows = data.lines
    .map(
      (line) => `<tr>
      <td style="padding:10px 12px 10px 0;border-bottom:1px solid ${C.rule};color:${C.ink}">${escapeHtml(line.itemName)}${
        line.itemType === 'custom'
          ? ''
          : `<span style="color:${C.faint}"> &times; ${line.quantity}</span>`
      }</td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.rule};color:${C.ink};white-space:nowrap;vertical-align:top">${rupees(line.totalPrice)}</td>
    </tr>`,
    )
    .join('\n    ');

  const receiptRows = [
    detailRow(
      'Receipt number',
      `<span style="font-family:${FONT_MONO}">${escapeHtml(data.receiptNumber)}</span>`,
    ),
    detailRow('Received from', escapeHtml(data.donorName)),
    ...(data.paidOn ? [detailRow('Date', escapeHtml(data.paidOn))] : []),
    detailRow('Payment method', 'Online (Razorpay)'),
    ...(data.paymentReference
      ? [
          detailRow(
            'Payment reference',
            `<span style="font-family:${FONT_MONO}">${escapeHtml(data.paymentReference)}</span>`,
          ),
        ]
      : []),
    detailRow(
      'Donation reference',
      `<span style="font-family:${FONT_MONO}">${escapeHtml(data.donationReference)}</span>`,
    ),
  ].join('\n    ');

  const contactHtml = contactLinksHtml(data.contact);
  const helpHtml = contactHtml
    ? `Questions about your donation or receipt? Please ${contactHtml}, quoting your receipt number.`
    : data.replyable
      ? 'Questions about your donation or receipt? Just reply to this email, quoting your receipt number.'
      : `Questions about your donation or receipt? You can see it at any time on <a href="${escapeHtml(data.statusUrl)}" style="color:${C.orangeText}">its page</a>.`;

  const html = `${statusPill('DONATION RECEIVED')}
  <h1 style="margin:12px 0 8px;text-align:center;font-size:24px;line-height:1.25;color:${C.navy}">Thank you, ${escapeHtml(data.greetingName)}!</h1>
  <p style="margin:0 0 24px;text-align:center;font-size:15px;line-height:1.6;color:${C.muted}">${intro}</p>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${C.orangeSoft};border:1px solid ${C.orangeLine};border-radius:12px;border-collapse:separate">
    <tr><td align="center" style="padding:22px 22px 20px">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.orangeText}">Amount donated</div>
      <div style="margin:6px 0 4px;font-size:32px;font-weight:800;line-height:1.2;color:${C.ink}">${amount}</div>
      <div style="font-size:14px;color:${C.muted}">to ${escapeHtml(data.campaignTitle)}${
        data.programTitle ? ` &middot; ${escapeHtml(data.programTitle)}` : ''
      }</div>
      ${button(data.statusUrl, 'View your donation')}
    </td></tr>
  </table>
  ${data.customMessage ? noteBox('A note from our team', data.customMessage.html) : ''}

  ${heading('Your gift')}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-size:14px">
    ${lineRows}
    <tr>
      <td style="padding:12px 0;font-weight:700;color:${C.ink}">Total</td>
      <td align="right" style="padding:12px 0;font-size:16px;font-weight:700;color:${C.ink}">${amount}</td>
    </tr>
  </table>

  ${heading('Receipt details')}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
    ${receiptRows}
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:24px;background-color:${C.panel};border:1px solid ${C.line};border-radius:12px;border-collapse:separate">
    <tr><td style="padding:14px 18px;font-size:13px;line-height:1.6;color:${C.muted}">
      <div style="margin-bottom:4px;font-weight:700;color:${C.ink}">About your receipt</div>
      This is your receipt for the payment. It is <strong>not</strong> a tax-exemption certificate. If you are claiming relief under Section 80G, the Income Tax Department issues Form 10BE after our annual Form 10BD filing, and it will reach you separately.
    </td></tr>
  </table>

  ${heading('Need help?')}
  <p style="margin:0;font-size:14px;line-height:1.6;color:${C.ink}">${helpHtml}</p>

  <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.faint}">You&#39;re receiving this email because you made a donation to Sailent Foundation. Please keep it${
    data.pdfAttached ? ', with the attached receipt,' : ''
  } for your records.</p>`;

  // ── Plain text ──────────────────────────────────────────────────────────
  const contactText = contactLinksText(data.contact);
  const lines: string[] = [
    'DONATION RECEIVED',
    '',
    `Thank you, ${data.greetingName}!`,
    '',
    `Your donation to ${data.campaignTitle} has been received.${
      data.pdfAttached ? ' Your receipt is attached as a PDF.' : ''
    }`,
    '',
    `Amount donated: ${amount}`,
    `  to ${data.campaignTitle}${data.programTitle ? ` (${data.programTitle})` : ''}`,
    ...(data.customMessage ? ['', 'A NOTE FROM OUR TEAM', data.customMessage.text] : []),
    '',
    'YOUR GIFT',
    ...data.lines.map(
      (line) =>
        `  ${line.itemName}${line.itemType === 'custom' ? '' : ` x ${line.quantity}`}: ${rupees(line.totalPrice)}`,
    ),
    `  Total: ${amount}`,
    '',
    'RECEIPT DETAILS',
    `  Receipt number: ${data.receiptNumber}`,
    `  Received from: ${data.donorName}`,
    ...(data.paidOn ? [`  Date: ${data.paidOn}`] : []),
    '  Payment method: Online (Razorpay)',
    ...(data.paymentReference ? [`  Payment reference: ${data.paymentReference}`] : []),
    `  Donation reference: ${data.donationReference}`,
    '',
    `View your donation: ${data.statusUrl}`,
    '',
    'ABOUT YOUR RECEIPT',
    RECEIPT_NOTE_TEXT,
    '',
    'NEED HELP?',
    `  ${
      contactText
        ? `Questions about your donation or receipt? Please ${contactText}, quoting your receipt number.`
        : data.replyable
          ? 'Questions about your donation or receipt? Just reply to this email, quoting your receipt number.'
          : `Questions about your donation or receipt? See ${data.statusUrl}`
    }`,
    '',
    'With thanks,',
    'Sailent Foundation',
  ];

  return {
    html,
    text: lines.join('\n'),
    preheader: `Receipt ${data.receiptNumber} for your ${amount} donation to ${data.campaignTitle}`,
  };
}
