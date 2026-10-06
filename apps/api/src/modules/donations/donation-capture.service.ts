import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import {
  donationItems,
  donations,
  payments,
  paymentTransactions,
  type DatabaseClient,
} from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { QueueService, QUEUE_NAMES, jobKey } from '../queue/queue.service.js';
import { ReceiptsService } from './receipts.service.js';
import type { RazorpayPayment } from './razorpay.client.js';

export type CaptureSource = 'webhook' | 'api_fetch' | 'reconciliation' | 'manual';

export interface CaptureOutcome {
  /** False when this call did nothing because the donation was already captured. */
  applied: boolean;
  donationId: string;
  reference: string;
  status: string;
  receiptNumber?: string;
}

/**
 * Turning a verified payment into a recorded donation.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS THE ONLY PLACE IN THE CODEBASE THAT MOVES MONEY-DERIVED COUNTERS.
 *
 * `campaigns.amount_raised`, `campaigns.donor_count`,
 * `campaign_products.provided_quantity`, `donors.total_donated` — all of them
 * are written here and nowhere else, inside one transaction, only ever after a
 * payment has been verified against the provider.
 *
 * TWO CALLERS, ONE BEHAVIOUR. The webhook is the authoritative path; the
 * browser's return from Checkout is the fast path so the donor sees a result
 * without waiting for Razorpay to call us. Whichever arrives first performs the
 * work; the second observes that it is done and returns `applied: false`. They
 * race constantly in production and that is fine.
 *
 * IDEMPOTENCY IS A CONDITIONAL UPDATE, NOT A READ-THEN-WRITE.
 *
 *     UPDATE donations SET status='successful'
 *      WHERE id = $1 AND status <> 'successful'
 *
 * The row count from that statement is the lock. Checking `SELECT status` first
 * and then updating leaves a window between the two in which the other caller
 * does the same, and both proceed to increment the campaign — a donation
 * counted twice, which is the single worst bug this system could have. Here,
 * exactly one transaction can observe a row count of 1.
 *
 * EVERYTHING FINANCIAL IS IN THE TRANSACTION. Status, line items, payment row,
 * campaign counters, product counters, donor totals and the receipt number
 * commit together or not at all. The email is not: it is enqueued after the
 * commit, because a mail provider having a bad afternoon must not roll back a
 * donation that has been paid for.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class DonationCaptureService {
  private readonly logger = new Logger(DonationCaptureService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly receipts: ReceiptsService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Record a captured payment.
   *
   * `providerPayment` must already have been FETCHED FROM RAZORPAY by the
   * caller — not taken from a request body, not taken from a webhook payload
   * without verification. This method trusts its argument completely, which is
   * why every caller is responsible for earning that trust first.
   */
  async capture(input: {
    donationId: string;
    providerPayment: RazorpayPayment;
    source: CaptureSource;
    actorId?: string;
  }): Promise<CaptureOutcome> {
    const result = await this.database.db.transaction(async (tx) => {
      const [donation] = await tx
        .select()
        .from(donations)
        .where(eq(donations.id, input.donationId))
        .limit(1);

      if (!donation) {
        throw new Error(`Donation ${input.donationId} not found during capture`);
      }

      /**
       * THE GATE. One statement, and its row count decides everything.
       *
       * `status <> 'successful'` rather than `status = 'pending'` on purpose: a
       * donation that somehow reached `failed` and then genuinely captured
       * should still be corrected forward. What must never happen twice is the
       * transition INTO successful, and that is exactly what this prevents.
       */
      const claimed = await tx.execute<{ id: string }>(sql`
        UPDATE donations
           SET status = 'successful',
               completed_at = now(),
               provider_transaction_id = ${input.providerPayment.id},
               failed_reason = NULL,
               updated_at = now()
         WHERE id = ${input.donationId}::uuid
           AND status <> 'successful'
        RETURNING id
      `);

      if ((claimed.rows?.length ?? 0) === 0) {
        // Somebody else got here first. Not an error — the expected outcome
        // roughly half the time, since the webhook and the browser race.
        return { applied: false as const, donation };
      }

      await this.recordPayment(tx, donation.id, input);

      /**
       * Counters, incremented IN SQL under a row lock.
       *
       * `SET amount_raised = amount_raised + $1` rather than reading the value
       * into JavaScript and writing it back. Read-modify-write loses concurrent
       * donations silently, and the ones it loses are real money. The `FOR
       * UPDATE` above the update serialises two captures against the same
       * campaign so `donor_count` is also exact.
       *
       * `donor_count` COUNTS DONORS, NOT DONATIONS. It goes up only for a
       * donor's FIRST successful donation to this campaign; a repeat gift adds
       * to `amount_raised` and nothing else. The donor is `donor_id` — one row
       * per email address (`donors_email_lower_unique`), so the same person
       * giving twice, anonymously or not, is the same donor.
       *
       * The check excludes THIS donation, which the gate above has already
       * marked successful. It is safe under concurrency because of the lock:
       * a second capture for the same donor and campaign waits on the `FOR
       * UPDATE`, and its statement then sees the first one's committed row
       * (READ COMMITTED takes a fresh snapshot per statement), so it adds 0.
       * A donation with no donor cannot be matched to another, so it counts
       * as one donor.
       */
      await tx.execute(
        sql`SELECT id FROM campaigns WHERE id = ${donation.campaignId}::uuid FOR UPDATE`,
      );
      await tx.execute(sql`
        UPDATE campaigns
           SET amount_raised = amount_raised + ${donation.amount},
               donor_count = donor_count + CASE
                 WHEN ${donation.donorId}::uuid IS NULL OR NOT EXISTS (
                   SELECT 1
                     FROM donations
                    WHERE campaign_id = ${donation.campaignId}::uuid
                      AND donor_id = ${donation.donorId}::uuid
                      AND status = 'successful'
                      AND id <> ${donation.id}::uuid
                 )
                 THEN 1 ELSE 0
               END,
               updated_at = now()
         WHERE id = ${donation.campaignId}::uuid
      `);

      await this.creditProducts(tx, donation.id);

      /**
       * Donor totals. Also derived, also only here.
       *
       * `first_donated_at` uses COALESCE so a donor's first gift keeps its date
       * forever, while `last_donated_at` always moves.
       */
      if (donation.donorId) {
        await tx.execute(sql`
          UPDATE donors
             SET total_donated = total_donated + ${donation.amount},
                 donation_count = donation_count + 1,
                 first_donated_at = COALESCE(first_donated_at, now()),
                 last_donated_at = now(),
                 updated_at = now()
           WHERE id = ${donation.donorId}::uuid
        `);
      }

      // Inside the transaction: the receipt number comes from a counter row
      // taken FOR UPDATE, so a rollback releases it and the book stays gapless.
      const receipt = await this.receipts.issue(tx, {
        donationId: donation.id,
        paymentReference: input.providerPayment.id,
      });

      await tx
        .update(donations)
        .set({ receiptId: receipt.id, updatedAt: new Date() })
        .where(eq(donations.id, donation.id));

      return { applied: true as const, donation, receipt };
    });

    if (!result.applied) {
      this.logger.log(
        `Donation ${result.donation.reference} was already captured; ${input.source} was a no-op`,
      );
      return {
        applied: false,
        donationId: result.donation.id,
        reference: result.donation.reference,
        status: result.donation.status,
      };
    }

    this.logger.log(
      `Donation ${result.donation.reference} captured via ${input.source}, receipt ${result.receipt.receiptNumber}`,
    );

    // AFTER the commit, and failures here are logged rather than thrown: the
    // money is recorded, and a mail queue being down must not turn a successful
    // donation into an error the donor sees.
    await this.enqueueConfirmation(result.donation.id, result.receipt.receiptNumber).catch(
      (error: unknown) => {
        this.logger.error(
          `Donation ${result.donation.reference} captured but its confirmation could not be queued: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      },
    );

    return {
      applied: true,
      donationId: result.donation.id,
      reference: result.donation.reference,
      status: 'successful',
      receiptNumber: result.receipt.receiptNumber,
    };
  }

  /**
   * Record a payment that did NOT succeed.
   *
   * Deliberately narrow: it moves a donation to `failed` and records why, and
   * it touches no counter at all. There is no path from here to `successful`.
   *
   * A donation already `successful` is left alone. Razorpay can report a failed
   * attempt after a later successful one on the same order, and letting a
   * stale failure overwrite a capture would un-count real money.
   */
  async markFailed(input: {
    donationId: string;
    reason: string;
    errorCode?: string;
    providerPaymentId?: string;
    source: CaptureSource;
  }): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const moved = await tx.execute<{ id: string }>(sql`
        UPDATE donations
           SET status = 'failed',
               failed_reason = ${input.reason},
               updated_at = now()
         WHERE id = ${input.donationId}::uuid
           AND status <> 'successful'
        RETURNING id
      `);

      if ((moved.rows?.length ?? 0) === 0) return;

      const [payment] = await tx
        .select({ id: payments.id, status: payments.status })
        .from(payments)
        .where(eq(payments.donationId, input.donationId))
        .limit(1);

      if (!payment) return;

      await tx
        .update(payments)
        .set({
          status: 'failed',
          failureReason: input.reason,
          errorCode: input.errorCode ?? null,
          providerPaymentId: input.providerPaymentId ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      await tx.insert(paymentTransactions).values({
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: 'failed',
        source: input.source,
        notes: input.reason,
      });
    });

    this.logger.log(`Donation ${input.donationId} marked failed via ${input.source}`);
  }

  /**
   * Expire a donation that was never paid for (Phase 11).
   *
   * Narrower still than `markFailed`: it moves ONLY a `pending` or
   * `processing` donation, so a successful, failed or already cancelled one is
   * never touched, and nothing is deleted. It touches no counter. The payment
   * row follows, and the move is recorded in the payment history.
   *
   * `cancelled` IS NOT A DEAD END. Capture's gate is `status <> 'successful'`,
   * so if money for this donation turns up later — a webhook, a donor who kept
   * the tab open, the next reconciliation — it is still recorded, exactly once.
   * Cancellation only stops an abandoned checkout holding stock and sitting in
   * the pending list.
   *
   * Returns whether it moved anything.
   */
  async markCancelled(input: {
    donationId: string;
    reason: string;
    source: CaptureSource;
  }): Promise<boolean> {
    const moved = await this.database.db.transaction(async (tx) => {
      const updated = await tx.execute<{ id: string }>(sql`
        UPDATE donations
           SET status = 'cancelled',
               failed_reason = ${input.reason},
               updated_at = now()
         WHERE id = ${input.donationId}::uuid
           AND status IN ('pending', 'processing')
        RETURNING id
      `);

      if ((updated.rows?.length ?? 0) === 0) return false;

      const [payment] = await tx
        .select({ id: payments.id, status: payments.status })
        .from(payments)
        .where(eq(payments.donationId, input.donationId))
        .limit(1);

      if (payment && payment.status !== 'successful') {
        await tx
          .update(payments)
          .set({ status: 'cancelled', failureReason: input.reason, updatedAt: new Date() })
          .where(eq(payments.id, payment.id));

        await tx.insert(paymentTransactions).values({
          paymentId: payment.id,
          fromStatus: payment.status,
          toStatus: 'cancelled',
          source: input.source,
          notes: input.reason,
        });
      }

      return true;
    });

    if (moved) {
      this.logger.log(`Donation ${input.donationId} cancelled via ${input.source}`);
    }
    return moved;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async recordPayment(
    tx: Parameters<Parameters<DatabaseClient['db']['transaction']>[0]>[0],
    donationId: string,
    input: { providerPayment: RazorpayPayment; source: CaptureSource; actorId?: string },
  ): Promise<void> {
    const provider = input.providerPayment;

    const [existing] = await tx
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(eq(payments.donationId, donationId))
      .limit(1);

    const values = {
      providerPaymentId: provider.id,
      providerOrderId: provider.order_id ?? undefined,
      status: 'successful' as const,
      method: this.mapMethod(provider.method),
      paidAt: new Date(),
      bank: provider.bank ?? null,
      wallet: provider.wallet ?? null,
      cardLast4: provider.card?.last4 ?? null,
      cardNetwork: provider.card?.network ?? null,
      // FCRA: a foreign instrument must be identifiable and returnable. The
      // organisation is not FCRA-registered, so this flags a contribution that
      // has to be handed back rather than one that may be kept.
      isInternational: provider.international ?? false,
      fee: provider.fee ?? null,
      tax: provider.tax ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      await tx.update(payments).set(values).where(eq(payments.id, existing.id));
      await tx.insert(paymentTransactions).values({
        paymentId: existing.id,
        fromStatus: existing.status,
        toStatus: 'successful',
        source: input.source,
        actorId: input.actorId ?? null,
      });
      return;
    }

    const [created] = await tx
      .insert(payments)
      .values({
        donationId,
        provider: 'razorpay',
        amount: provider.amount,
        currency: provider.currency,
        ...values,
      })
      .returning({ id: payments.id });

    if (created) {
      await tx.insert(paymentTransactions).values({
        paymentId: created.id,
        toStatus: 'successful',
        source: input.source,
        actorId: input.actorId ?? null,
      });
    }
  }

  /**
   * Credit the product counters.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * The increment is honest even when it takes an offering past its target.
   *
   * A donor who paid for seven school kits gave seven school kits, and clamping
   * the count to make a progress bar tidy would understate what was received —
   * which is falsifying a record to protect a layout. `quantityProgress` caps
   * the BAR at 100% and reports the true figure alongside it, so
   * over-subscription already has somewhere to go.
   *
   * The reservation check at creation time is what keeps this rare. It cannot
   * make it impossible: a hold can expire between order and capture. When that
   * happens the money has already been taken, and recording it correctly is the
   * only available right answer.
   * ══════════════════════════════════════════════════════════════════════════
   */
  private async creditProducts(
    tx: Parameters<Parameters<DatabaseClient['db']['transaction']>[0]>[0],
    donationId: string,
  ): Promise<void> {
    const lines = await tx
      .select({
        campaignProductId: donationItems.campaignProductId,
        quantity: donationItems.quantity,
      })
      .from(donationItems)
      .where(and(eq(donationItems.donationId, donationId), eq(donationItems.itemType, 'product')));

    // Sorted by id so two captures touching the same offerings take the locks
    // in the same order and cannot deadlock.
    const ordered = lines
      .filter((line): line is { campaignProductId: string; quantity: number } =>
        Boolean(line.campaignProductId),
      )
      .sort((a, b) => a.campaignProductId.localeCompare(b.campaignProductId));

    for (const line of ordered) {
      await tx.execute(sql`
        UPDATE campaign_products
           SET provided_quantity = provided_quantity + ${line.quantity},
               updated_at = now()
         WHERE id = ${line.campaignProductId}::uuid
      `);
    }
  }

  private mapMethod(method: string | undefined) {
    switch (method) {
      case 'upi':
      case 'card':
      case 'netbanking':
      case 'wallet':
        return method;
      default:
        // Razorpay adds methods; an unknown one is stored as null rather than
        // failing a capture over a label.
        return null;
    }
  }

  private async enqueueConfirmation(donationId: string, receiptNumber: string): Promise<void> {
    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'donation.confirmation',
      { donationId, receiptNumber },
      // The receipt number as the job id: a retried capture cannot enqueue a
      // second copy of the same thank-you email.
      //
      // Built with `jobKey` rather than a template string. BullMQ refuses a
      // colon in a custom id and throws — and the `.catch()` above, which is
      // there so a queue outage cannot fail a donation that has taken the
      // money, was swallowing that throw. Every confirmation email was being
      // discarded at this line.
      { jobId: jobKey('donation-confirmation', receiptNumber) },
    );
  }
}
