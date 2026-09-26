import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { eq } from 'drizzle-orm';

import {
  donationItems,
  donations,
  donors,
  notifications,
  receipts,
  type DatabaseClient,
} from '@sailent/database';

import { sendEmail, type BrevoConfig } from '../lib/brevo.js';
import { renderFromTemplate } from '../lib/templates.js';
import { alertStaffOfFailedSend } from '../lib/admin-alert.js';

export interface DonationConfirmationJob {
  donationId: string;
  receiptNumber: string;
}

/** Paise to a readable rupee figure. The one place this conversion happens here. */
function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
 * It states the SNAPSHOTTED prices, read from the donation's own line items
 * rather than the catalogue, so the email agrees with the receipt forever.
 *
 * ONLY FOR CAPTURED DONATIONS. The job re-reads the status and refuses to send
 * for anything else, because a race or a bad enqueue must not thank somebody
 * for a payment that failed.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function processDonationConfirmation(
  job: Job<DonationConfirmationJob>,
  deps: { database: DatabaseClient; brevo: BrevoConfig; appUrl: string },
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
      campaignTitle: receipts.campaignTitle,
      receiptNumber: receipts.receiptNumber,
      issuedAt: receipts.issuedAt,
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

  const name = [donation.donorName, donation.donorLastName].filter(Boolean).join(' ') || 'there';
  const campaign = donation.campaignTitle ?? 'our work';
  const statusUrl = `${deps.appUrl}/donation/${donation.reference}`;

  const itemsText = lines
    .map((line) =>
      line.itemType === 'custom'
        ? `  ${line.itemName}: ${rupees(line.totalPrice)}`
        : `  ${line.itemName} × ${line.quantity} @ ${rupees(line.unitPrice)} = ${rupees(line.totalPrice)}`,
    )
    .join('\n');

  const itemsHtml = lines
    .map(
      (line) =>
        `<tr><td style="padding:6px 12px 6px 0">${escapeHtml(line.itemName)}${
          line.itemType === 'custom' ? '' : ` × ${line.quantity}`
        }</td><td style="padding:6px 0;text-align:right;white-space:nowrap">${rupees(line.totalPrice)}</td></tr>`,
    )
    .join('');

  const text = `Dear ${name},

Thank you. Your donation to ${campaign} has been received.

Receipt number: ${receiptNumber}
Donation reference: ${donation.reference}
Date: ${donation.issuedAt?.toLocaleDateString('en-IN') ?? ''}

${itemsText}

  Total: ${rupees(donation.amount)}

You can view this donation at any time:
${statusUrl}

This is your receipt for the payment. It is not a tax-exemption certificate —
if you are claiming relief under Section 80G, the Income Tax Department issues
Form 10BE after our annual Form 10BD filing, and it will reach you separately.

With thanks,
Sailent Foundation`;

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;color:#1f2933">
  <p>Dear ${escapeHtml(name)},</p>
  <p>Thank you. Your donation to <strong>${escapeHtml(campaign)}</strong> has been received.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <tbody>${itemsHtml}</tbody>
    <tfoot>
      <tr><td style="padding:10px 12px 0 0;border-top:1px solid #d9e2ec"><strong>Total</strong></td>
      <td style="padding:10px 0 0;border-top:1px solid #d9e2ec;text-align:right"><strong>${rupees(donation.amount)}</strong></td></tr>
    </tfoot>
  </table>
  <p style="margin:0"><strong>Receipt number:</strong> ${escapeHtml(receiptNumber)}<br>
  <strong>Donation reference:</strong> ${escapeHtml(donation.reference)}</p>
  <p><a href="${statusUrl}">View this donation</a></p>
  <p style="font-size:13px;color:#52606d;border-top:1px solid #d9e2ec;padding-top:14px">
    This is your receipt for the payment. It is <strong>not</strong> a tax-exemption certificate.
    If you are claiming relief under Section 80G, the Income Tax Department issues Form 10BE after
    our annual Form 10BD filing, and it will reach you separately.
  </p>
  <p style="font-size:13px;color:#52606d">With thanks,<br>Sailent Foundation</p>
</div>`;

  /*
    THE STORED TEMPLATE WINS; THE BODY ABOVE IS THE FALLBACK.

    `itemsHtml` is passed as a RAW value — it is the only one in the platform,
    it is markup this function built, and every value inside it was escaped on
    the way in. The registry permits it for this slug and refuses it for every
    other, so an editor cannot reach for it elsewhere.
  */
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

  const result = await sendEmail(
    deps.brevo,
    {
      to: { email: donation.donorEmail, name: name === 'there' ? undefined : name },
      subject: rendered?.subject ?? `Thank you — your donation to ${campaign}`,
      html: rendered?.html ?? html,
      text: rendered?.text ?? text,
      tags: ['donation-confirmation', receiptNumber],
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
      throw new Error(`Brevo unreachable: ${result.detail ?? ''}`);
    }
    logger.warn({ donationId, reason: result.reason }, 'Donation confirmation was not sent');
    return { sent: false, reason: result.reason };
  }

  logger.info({ donationId, receiptNumber }, 'Donation confirmation sent');
  return { sent: true };
}
