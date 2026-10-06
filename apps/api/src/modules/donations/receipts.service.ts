import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import {
  campaigns,
  donationItems,
  donations,
  donors,
  programs,
  receipts,
  type DatabaseClient,
} from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { NotFoundException } from '../../common/exceptions.js';

type Tx = Parameters<Parameters<DatabaseClient['db']['transaction']>[0]>[0];

/**
 * The Indian financial year a date falls in.
 *
 * April to March, so a donation on 3 March 2027 belongs to FY 2026-27 and is
 * numbered in that year's book. Using the calendar year would split a financial
 * year across two receipt sequences, and the Form 10BD filing that these
 * eventually feed is filed per financial year.
 */
export function financialYearOf(date: Date): number {
  /*
    IN INDIA TIME, not the server's. The year turns at midnight on 1 April in
    India; a server running in UTC would otherwise number a donation made at
    00:30 on 1 April (18:30 UTC on 31 March) in the year that has just ended.
    India has no daylight saving, so a fixed +05:30 is exact.
  */
  const india = new Date(date.getTime() + IST_OFFSET_MS);
  // getUTCMonth() is zero-based: 3 is April.
  return india.getUTCMonth() >= 3 ? india.getUTCFullYear() : india.getUTCFullYear() - 1;
}

const IST_OFFSET_MS = 330 * 60_000;

/** SFL-2026-000001 */
export function formatReceiptNumber(financialYear: number, sequence: number): string {
  return `SFL-${financialYear}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Receipts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A RECEIPT IS NOT AN 80G CERTIFICATE (decision A7).
 *
 * This is the acknowledgement that money arrived, issued immediately. The 80G
 * tax certificate is Form 10BE, issued by the Income Tax Department to the
 * donor after the organisation files its annual Form 10BD — months later, by a
 * different party. No copy produced here says otherwise, and
 * `eightyGEligible` records only what was TRUE on the issue date, which is a
 * fact about the donation rather than a promise about anyone's tax return.
 *
 * NUMBERING IS GAPLESS, and that is why `issue` takes a transaction rather than
 * opening its own. The counter is a row taken FOR UPDATE inside the caller's
 * transaction, so if the capture rolls back the number is released with it. A
 * Postgres sequence would not roll back and would leave a hole that somebody
 * has to explain to an auditor.
 *
 * EVERYTHING DISPLAYED IS SNAPSHOTTED onto the row. The donor's name, the
 * campaign title, the line items — all copied, none joined at render time. A
 * receipt reprinted in five years must read what the donor was sent, whatever
 * the catalogue has been renamed to since.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class ReceiptsService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  /**
   * Issue the receipt for a captured donation.
   *
   * MUST be called inside the capture transaction. Called on its own it would
   * still work, but a failure later in the capture would leave a receipt for a
   * donation that is not marked paid.
   */
  async issue(
    tx: Tx,
    input: { donationId: string; paymentReference?: string },
  ): Promise<{ id: string; receiptNumber: string }> {
    const [donation] = await tx
      .select({
        id: donations.id,
        amount: donations.amount,
        currency: donations.currency,
        donorId: donations.donorId,
        anonymous: donations.anonymous,
        donorFirst: donors.firstName,
        donorLast: donors.lastName,
        donorEmail: donors.email,
        campaignTitle: campaigns.title,
        programTitle: programs.title,
      })
      .from(donations)
      .leftJoin(donors, eq(donors.id, donations.donorId))
      .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
      .leftJoin(programs, eq(programs.id, donations.programId))
      .where(eq(donations.id, input.donationId))
      .limit(1);

    if (!donation) throw new NotFoundException('Donation');

    const lines = await tx
      .select({
        itemType: donationItems.itemType,
        itemName: donationItems.itemName,
        quantity: donationItems.quantity,
        unitPrice: donationItems.unitPrice,
        totalPrice: donationItems.totalPrice,
      })
      .from(donationItems)
      .where(eq(donationItems.donationId, input.donationId));

    const issuedAt = new Date();
    const financialYear = financialYearOf(issuedAt);
    const sequence = await this.nextSequence(tx, financialYear);

    /**
     * The donor's name on the receipt.
     *
     * `anonymous` governs PUBLIC display — a donor wall, a campaign page. It is
     * not a reason to send someone a receipt addressed to "Anonymous": the
     * receipt is theirs, it is how they claim a deduction, and it has to carry
     * their name.
     */
    const donorName =
      [donation.donorFirst, donation.donorLast].filter(Boolean).join(' ') || 'Donor';

    const [created] = await tx
      .insert(receipts)
      .values({
        receiptNumber: formatReceiptNumber(financialYear, sequence),
        financialYear,
        sequence,
        donationId: donation.id,
        donorId: donation.donorId,
        donorName,
        donorEmail: donation.donorEmail,
        campaignTitle: donation.campaignTitle,
        programTitle: donation.programTitle,
        amount: donation.amount,
        currency: donation.currency,
        lineItems: lines,
        paymentReference: input.paymentReference ?? null,
        /**
         * Left NULL until the organisation's real 80G registration is
         * configured. A hard-coded `true` here would print a tax claim this
         * platform has no basis for, on a document a donor may hand to an
         * accountant.
         */
        eightyGEligible: null,
        registrationNumber: null,
        issuedAt,
      })
      .returning({ id: receipts.id, receiptNumber: receipts.receiptNumber });

    if (!created) throw new Error('Receipt insert returned no row');
    return created;
  }

  /**
   * The next number in this financial year's book.
   *
   * `INSERT … ON CONFLICT DO UPDATE … RETURNING` is a single atomic statement
   * that both creates the year's counter on its first use and increments it,
   * taking the row lock as it goes. Two captures arriving together serialise
   * here; the second waits and gets the next number.
   *
   * The returned value is the one THIS caller took, computed as the new
   * `next_value` minus one, so no number is ever handed out twice.
   */
  private async nextSequence(tx: Tx, financialYear: number): Promise<number> {
    const result = await tx.execute<{ next_value: number }>(sql`
      INSERT INTO receipt_sequences (financial_year, next_value)
           VALUES (${financialYear}, 2)
      ON CONFLICT (financial_year)
        DO UPDATE SET next_value = receipt_sequences.next_value + 1,
                      updated_at = now()
        RETURNING next_value
    `);

    const next = result.rows?.[0]?.next_value;
    if (typeof next !== 'number') throw new Error('Receipt sequence did not return a value');
    return next - 1;
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /** A receipt by its printed number. */
  async getByNumber(receiptNumber: string) {
    const [row] = await this.database.db
      .select()
      .from(receipts)
      .where(eq(receipts.receiptNumber, receiptNumber))
      .limit(1);

    if (!row) throw new NotFoundException('Receipt');
    return row;
  }

  /**
   * The receipt for a donation, addressed by the donation's public reference.
   *
   * This is how a guest donor reaches their own receipt without an account: the
   * reference is in their confirmation email and nowhere else. It is a
   * capability, so it is generated with enough entropy to be unguessable, and
   * the response carries no payment identifiers.
   */
  async getByDonationReference(reference: string) {
    const [row] = await this.database.db
      .select({
        receiptNumber: receipts.receiptNumber,
        issuedAt: receipts.issuedAt,
        donorName: receipts.donorName,
        campaignTitle: receipts.campaignTitle,
        programTitle: receipts.programTitle,
        amount: receipts.amount,
        currency: receipts.currency,
        lineItems: receipts.lineItems,
      })
      .from(receipts)
      .innerJoin(donations, eq(donations.id, receipts.donationId))
      .where(eq(donations.reference, reference))
      .limit(1);

    if (!row) throw new NotFoundException('Receipt');
    return row;
  }
}
