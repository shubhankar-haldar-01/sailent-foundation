import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { eq, inArray } from 'drizzle-orm';

import {
  donationItems,
  donations,
  donors,
  notifications,
  receipts,
  settings,
  type DatabaseClient,
} from '@sailent/database';
import {
  SAILENT_LOGO_PNG,
  SAILENT_LOGO_SIZE,
  ORGANISATION_SETTING_KEYS,
  organisationFromSettings,
  receiptLinesFrom,
  renderReceiptPdf,
  type ReceiptPdfLine,
} from '@sailent/documents';

import { sendEmail, type EmailAttachment, type Mailer } from '../lib/email.js';
import { escapeHtml, rupees } from '../lib/email-parts.js';
import { readOrganisationContact } from '../lib/organisation.js';
import { renderFromTemplate } from '../lib/templates.js';
import { alertStaffOfFailedSend } from '../lib/admin-alert.js';
import { donationEmail } from './donation-confirmation-email.js';

export interface DonationConfirmationJob {
  donationId: string;
  receiptNumber: string;
}

const PAID_ON_DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});
const PAID_ON_TIME = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

/**
 * The donor's confirmation.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE COPY IS AS CAREFUL AS THE CODE.
 *
 * It says a receipt, never a certificate. Section 80G relief comes from Form
 * 10BE, which the Income Tax Department issues to the donor after this
 * organisation files its annual Form 10BD — months later, by a different party
 * (decision A7). An email that promises a tax benefit at the moment of giving
 * is making a claim this platform cannot honour, to somebody who may act on it.
 *
 * It states the SNAPSHOTTED prices, read from the receipt's frozen lines (or
 * the donation's own, for an older receipt that froze none) rather than the
 * catalogue, so the email agrees with the receipt forever.
 *
 * THE RECEIPT TRAVELS AS A PDF (`lib/receipt-pdf.ts`), the body laid out like
 * a professional receipt email (`donation-confirmation-email.ts`): a guest
 * donor has no account, and this email is their only copy.
 *
 * ONLY FOR CAPTURED DONATIONS. The job re-reads the status and refuses to send
 * for anything else, because a race or a bad enqueue must not thank somebody
 * for a payment that failed.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function processDonationConfirmation(
  job: Job<DonationConfirmationJob>,
  deps: { database: DatabaseClient; mailer: Mailer; appUrl: string },
  logger: Logger,
): Promise<{ sent: boolean; reason?: string }> {
  const { donationId, receiptNumber } = job.data;
  const { db } = deps.database;

  const [donation] = await db
    .select({
      id: donations.id,
      reference: donations.reference,
      status: donations.status,
      amount: donations.amount,
      donorName: donors.firstName,
      donorLastName: donors.lastName,
      donorEmail: donors.email,
      donorPhone: donors.phone,
      donorCity: donors.city,
      donorState: donors.state,
      campaignTitle: receipts.campaignTitle,
      programTitle: receipts.programTitle,
      receiptNumber: receipts.receiptNumber,
      receiptDonorName: receipts.donorName,
      receiptLines: receipts.lineItems,
      registrationNumber: receipts.registrationNumber,
      issuedAt: receipts.issuedAt,
      // The payment id the capture recorded on the receipt (decision A6).
      paymentReference: receipts.paymentReference,
    })
    .from(donations)
    .leftJoin(donors, eq(donors.id, donations.donorId))
    .leftJoin(receipts, eq(receipts.donationId, donations.id))
    .where(eq(donations.id, donationId))
    .limit(1);

  if (!donation) {
    logger.error({ donationId }, 'Confirmation job for a donation that does not exist');
    return { sent: false, reason: 'not_found' };
  }

  /**
   * THE GUARD THAT MATTERS. A donation that is not captured gets no thank-you,
   * whatever the job says. This is the last line of defence against a failed
   * payment being confirmed to the donor.
   */
  if (donation.status !== 'successful') {
    logger.warn(
      { donationId, status: donation.status },
      'Refusing to send a confirmation for a donation that is not successful',
    );
    return { sent: false, reason: `status_${donation.status}` };
  }

  if (!donation.donorEmail) {
    logger.warn({ donationId }, 'Donation has no donor email; nothing to send');
    return { sent: false, reason: 'no_email' };
  }

  const lines = await db
    .select({
      itemName: donationItems.itemName,
      quantity: donationItems.quantity,
      unitPrice: donationItems.unitPrice,
      totalPrice: donationItems.totalPrice,
      itemType: donationItems.itemType,
    })
    .from(donationItems)
    .where(eq(donationItems.donationId, donationId));

  const fullName = [donation.donorName, donation.donorLastName].filter(Boolean).join(' ');
  const name = fullName || 'there';
  const campaign = donation.campaignTitle ?? 'our work';
  const statusUrl = `${deps.appUrl}/donation/${donation.reference}`;

  /*
    The lines the receipt froze at capture; the donation's own lines when an
    older receipt froze none. Both are snapshots, never today's catalogue.
  */
  const receiptLines = receiptLinesFrom(donation.receiptLines);
  const gift: ReceiptPdfLine[] = receiptLines.length > 0 ? receiptLines : lines;

  /*
    The receipt's own date and time, in India's time zone. The server runs in
    UTC, so without the zone a gift made after midnight IST was dated the day
    before.
  */
  const paidOn = donation.issuedAt
    ? `${PAID_ON_DATE.format(donation.issuedAt)}, ${PAID_ON_TIME.format(donation.issuedAt)} IST`
    : null;

  /*
    THE STORED TEMPLATE KEEPS THE SUBJECT EDITABLE. Its body is shown only once
    an administrator has written their own (`customised`), as "A note from our
    team": the shipped wording says what the layout below already says.

    `itemsHtml` is passed as a RAW value, for an edited body that uses it. It
    is the only one in the platform, it is markup this function built, and
    every value inside it was escaped on the way in. The registry permits it
    for this slug and refuses it for every other.
  */
  const itemsHtml = gift
    .map(
      (line) =>
        `<tr><td style="padding:6px 12px 6px 0">${escapeHtml(line.itemName)}${
          line.itemType === 'custom' ? '' : ` × ${line.quantity}`
        }</td><td style="padding:6px 0;text-align:right;white-space:nowrap">${rupees(line.totalPrice)}</td></tr>`,
    )
    .join('');
  const rendered = await renderFromTemplate(
    db,
    'donation.confirmation',
    {
      donorName: name,
      campaignTitle: campaign,
      amount: rupees(donation.amount),
      receiptNumber,
      reference: donation.reference,
      statusUrl,
      itemsHtml,
    },
    logger,
  );

  const contact = await readOrganisationContact(db);

  /*
    THE RECEIPT AS A PDF, drawn from the receipt row. A PDF that cannot be
    drawn is left out with a warning: the email still carries every receipt
    detail, and the confirmation is never held back for it.
  */
  let pdf: Buffer | null = null;
  if (donation.issuedAt) {
    const organisationRows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, [...ORGANISATION_SETTING_KEYS]));
    try {
      pdf = await renderReceiptPdf({
        receiptNumber,
        issuedAt: donation.issuedAt,
        donor: {
          name: donation.receiptDonorName ?? (fullName || 'Donor'),
          // This copy goes privately to the donor; the PDF masks both.
          email: donation.donorEmail,
          phone: donation.donorPhone,
          place: [donation.donorCity, donation.donorState].filter(Boolean).join(', ') || null,
        },
        organisation: organisationFromSettings(organisationRows),
        campaignTitle: donation.campaignTitle,
        programTitle: donation.programTitle,
        amount: donation.amount,
        lines: gift,
        donationReference: donation.reference,
        paymentReference: donation.paymentReference,
        registrationNumber: donation.registrationNumber,
        verifyUrl: statusUrl,
      });
    } catch (error) {
      logger.warn({ donationId, err: String(error) }, 'Could not build the receipt PDF');
    }
  }

  const email = donationEmail({
    greetingName: donation.donorName || 'there',
    donorName: donation.receiptDonorName ?? (fullName || 'Donor'),
    campaignTitle: campaign,
    programTitle: donation.programTitle,
    amount: donation.amount,
    lines: gift,
    receiptNumber,
    donationReference: donation.reference,
    paymentReference: donation.paymentReference,
    paidOn,
    statusUrl,
    pdfAttached: pdf !== null,
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
    ...(pdf
      ? [
          {
            filename: `Donation-receipt-${receiptNumber}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ]
      : []),
  ];

  const result = await sendEmail(
    deps.mailer,
    {
      to: { email: donation.donorEmail, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? `Thank you — your donation to ${campaign}`,
      html: email.html,
      text: email.text,
      tags: ['donation-confirmation', receiptNumber],
      preheader: email.preheader,
      attachments,
      headerLogo: {
        contentId: 'sailent-logo',
        width: 160,
        height: Math.round((160 * SAILENT_LOGO_SIZE.height) / SAILENT_LOGO_SIZE.width),
      },
    },
    logger,
  );

  /**
   * The outcome is RECORDED either way.
   *
   * A notification row with `status: 'failed'` and a reason is how an unsent
   * receipt becomes visible. Silently returning would mean nobody knows a donor
   * is waiting for an email that is never coming.
   */
  await db.insert(notifications).values({
    recipientType: 'donor',
    type: 'donation.confirmation',
    title: `Donation confirmation ${receiptNumber}`,
    message: `Receipt ${receiptNumber} for donation ${donation.reference}`,
    data: { donationId, receiptNumber, reference: donation.reference },
    channel: 'email',
    status: result.sent ? 'sent' : 'failed',
    sentAt: result.sent ? new Date() : null,
    error: result.sent ? null : `${result.reason}${result.detail ? `: ${result.detail}` : ''}`,
    providerMessageId: result.sent ? result.providerMessageId : null,
    // Which wording this donor actually received. Null means the built-in body.
    templateId: rendered?.templateId ?? null,
    templateVersion: rendered?.templateVersion ?? null,
    retryCount: job.attemptsMade,
  });

  if (!result.sent) {
    await alertStaffOfFailedSend(
      db,
      {
        type: 'donation.confirmation',
        summary: `Receipt ${receiptNumber} was not delivered`,
        reason: result.reason,
        context: { donationId, receiptNumber },
      },
      logger,
    );

    // `not_configured` and `rejected` are permanent: throwing would retry four
    // more times against the same answer and delay the dead-letter a human
    // needs to see. Only `unreachable` is worth another attempt.
    if (result.reason === 'unreachable') {
      throw new Error(`Email provider unreachable: ${result.detail ?? ''}`);
    }
    logger.warn({ donationId, reason: result.reason }, 'Donation confirmation was not sent');
    return { sent: false, reason: result.reason };
  }

  logger.info({ donationId, receiptNumber }, 'Donation confirmation sent');
  return { sent: true };
}
