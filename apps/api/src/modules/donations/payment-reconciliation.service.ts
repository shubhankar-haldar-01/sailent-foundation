import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { DatabaseClient } from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { DonationCaptureService } from './donation-capture.service.js';
import {
  PaymentMismatchException,
  PaymentVerificationService,
} from './payment-verification.service.js';
import { RazorpayClient, type RazorpayPayment } from './razorpay.client.js';

/** A pending donation younger than this is left to the browser and the webhook. */
export const RECONCILE_AFTER_MINUTES = 15;
/** A pending donation with nothing paid after this long is cancelled. */
export const EXPIRE_AFTER_HOURS = 24;
/** How far back a FAILED donation is re-checked for a later successful retry. */
export const FAILED_LOOKBACK_HOURS = 72;
/** How far back a pending donation is considered at all. */
export const PENDING_LOOKBACK_DAYS = 30;
/** Donations examined per run. Oldest first. */
export const RECONCILE_BATCH = 100;

export interface ReconciliationSummary {
  examined: number;
  /** Payments found captured at Razorpay and recorded here by this run. */
  captured: number;
  /** Captured at Razorpay, but already recorded by the webhook or the browser. */
  alreadyCaptured: number;
  /** Pending donations expired to `cancelled`. */
  cancelled: number;
  /** A captured payment that disagreed with the donation (amount, currency, order). */
  mismatches: number;
  /** More than one captured payment on one order — money a human must look at. */
  multipleCaptured: number;
  /** An authorised-but-not-captured payment kept the donation from expiring. */
  heldForAuthorisation: number;
  /** Nothing to do yet. */
  skipped: number;
  /** Razorpay or the database could not be reached for this donation. */
  errors: number;
}

interface Candidate {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  providerOrderId: string | null;
}

/**
 * Payment reconciliation and pending expiry (Phase 11).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IT IS FOR.
 *
 * A donation is recorded when the browser's verify call or Razorpay's webhook
 * arrives. If BOTH are lost — the donor closed the tab, the webhook exhausted
 * its retries — the money is at Razorpay and the donation sits `pending` here
 * forever. This asks Razorpay directly, for every donation old enough that
 * one of those two should have arrived.
 *
 * WHAT IT DOES, per donation (oldest first, `RECONCILE_BATCH` at a time):
 *   - a CAPTURED payment on the donation's order → recorded through
 *     `captureVerifiedPayment`: the same checks (order, currency, amount) and
 *     the same exactly-once capture the browser and webhook use. If one of
 *     them got there first, the capture is a no-op.
 *   - nothing captured, and the donation is `pending` past
 *     `EXPIRE_AFTER_HOURS` → `cancelled` (never deleted). Not if Razorpay
 *     holds an AUTHORISED payment for it — that is money in flight, left for
 *     a human (it shows in the admin payment exceptions).
 *   - no Razorpay order at all (order creation failed) → nothing to ask;
 *     cancelled once past the same cutoff.
 *   - a `failed` donation is re-checked for `FAILED_LOOKBACK_HOURS`, because a
 *     donor can fail once and then pay on the same order. It is captured if
 *     a payment turns up, and otherwise left `failed`, never cancelled.
 *
 * SAFE TO RUN ANY NUMBER OF TIMES, AND ALONGSIDE THE WEBHOOK. Every write is
 * conditional: capture only from a non-successful state, cancellation only
 * from `pending`/`processing`. If the webhook captures while this run is
 * deciding to cancel, the cancel matches no row; if this run cancels and the
 * money arrives later, capture still records it.
 *
 * Errors on one donation are counted and the run carries on with the next.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly razorpay: RazorpayClient,
    private readonly verification: PaymentVerificationService,
    private readonly capture: DonationCaptureService,
  ) {}

  /**
   * One reconciliation pass. `donationIds` narrows it to particular donations
   * (a targeted run, and how the tests stay independent of other rows); the
   * scheduled run passes nothing and takes the oldest candidates.
   */
  async run(
    options: { now?: Date; limit?: number; donationIds?: string[] } = {},
  ): Promise<ReconciliationSummary> {
    const now = options.now ?? new Date();
    const summary: ReconciliationSummary = {
      examined: 0,
      captured: 0,
      alreadyCaptured: 0,
      cancelled: 0,
      mismatches: 0,
      multipleCaptured: 0,
      heldForAuthorisation: 0,
      skipped: 0,
      errors: 0,
    };

    const candidates = await this.candidates(
      now,
      options.limit ?? RECONCILE_BATCH,
      options.donationIds,
    );
    for (const donation of candidates) {
      summary.examined += 1;
      try {
        await this.reconcileOne(donation, now, summary);
      } catch (error) {
        summary.errors += 1;
        this.logger.error(
          `Reconciliation of donation ${donation.reference} failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    this.logger.log(`Payment reconciliation: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async reconcileOne(
    donation: Candidate,
    now: Date,
    summary: ReconciliationSummary,
  ): Promise<void> {
    const expired = now.getTime() - donation.createdAt.getTime() >= EXPIRE_AFTER_HOURS * 3_600_000;
    const pending = donation.status === 'pending' || donation.status === 'processing';

    // No order: the provider call failed after the donation was written.
    // There is nothing at Razorpay to find.
    if (!donation.providerOrderId) {
      if (pending && expired) {
        await this.cancel(donation, 'No payment order was created for this donation.', summary);
      } else {
        summary.skipped += 1;
      }
      return;
    }

    let attempts: RazorpayPayment[];
    try {
      attempts = await this.razorpay.fetchOrderPayments(donation.providerOrderId);
    } catch (error) {
      summary.errors += 1;
      this.logger.warn(
        `Could not fetch payments for donation ${donation.reference}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return;
    }

    const captured = attempts.filter((payment) => payment.status === 'captured');

    if (captured.length > 0) {
      if (captured.length > 1) {
        // Razorpay should not allow it, and only one can be recorded against
        // one donation. The rest is money with nowhere to go — say so loudly.
        summary.multipleCaptured += 1;
        this.logger.error(
          `Donation ${donation.reference}: ${captured.length} captured payments on one order. Only one can be recorded; reconcile the rest by hand.`,
        );
      }

      for (const payment of captured) {
        try {
          const outcome = await this.verification.captureVerifiedPayment(donation, payment);
          if (outcome.applied) summary.captured += 1;
          else summary.alreadyCaptured += 1;
        } catch (error) {
          if (error instanceof PaymentMismatchException) {
            // Already logged at error level where it was detected. The
            // donation stays as it is — never cancelled with money behind it.
            summary.mismatches += 1;
          } else {
            throw error;
          }
        }
      }
      return;
    }

    // A failed donation is only ever moved forward, by a capture.
    if (!pending || !expired) {
      summary.skipped += 1;
      return;
    }

    if (attempts.some((payment) => payment.status === 'authorized')) {
      summary.heldForAuthorisation += 1;
      this.logger.warn(
        `Donation ${donation.reference} has an authorised payment that was never captured; left pending for review.`,
      );
      return;
    }

    await this.cancel(
      donation,
      `No payment was completed within ${EXPIRE_AFTER_HOURS} hours.`,
      summary,
    );
  }

  private async cancel(
    donation: Candidate,
    reason: string,
    summary: ReconciliationSummary,
  ): Promise<void> {
    const moved = await this.capture.markCancelled({
      donationId: donation.id,
      reason,
      source: 'reconciliation',
    });
    // Not moved means the state changed under us — most likely a capture. Fine.
    if (moved) summary.cancelled += 1;
    else summary.skipped += 1;
  }

  /**
   * The donations worth asking Razorpay about, oldest first.
   *
   * `pending`/`processing` older than `RECONCILE_AFTER_MINUTES` (and newer than
   * `PENDING_LOOKBACK_DAYS`), and `failed` ones with an order from the last
   * `FAILED_LOOKBACK_HOURS`. Successful and cancelled donations never appear.
   */
  private async candidates(now: Date, limit: number, donationIds?: string[]): Promise<Candidate[]> {
    if (donationIds && donationIds.length === 0) return [];
    const reconcileBefore = new Date(now.getTime() - RECONCILE_AFTER_MINUTES * 60_000);
    const pendingSince = new Date(now.getTime() - PENDING_LOOKBACK_DAYS * 86_400_000);
    const failedSince = new Date(now.getTime() - FAILED_LOOKBACK_HOURS * 3_600_000);

    const result = await this.database.db.execute<{
      id: string;
      reference: string;
      amount: string | number;
      currency: string;
      status: string;
      created_at: string | Date;
      provider_order_id: string | null;
    }>(sql`
      SELECT d.id, d.reference, d.amount, d.currency, d.status, d.created_at,
             p.provider_order_id
        FROM donations d
        LEFT JOIN payments p ON p.donation_id = d.id
       WHERE d.created_at < ${reconcileBefore.toISOString()}::timestamptz
         AND (
               (d.status IN ('pending', 'processing')
                 AND d.created_at > ${pendingSince.toISOString()}::timestamptz)
            OR (d.status = 'failed'
                 AND p.provider_order_id IS NOT NULL
                 AND d.created_at > ${failedSince.toISOString()}::timestamptz)
             )
         ${
           donationIds
             ? sql`AND d.id IN (${sql.join(
                 donationIds.map((id) => sql`${id}::uuid`),
                 sql`, `,
               )})`
             : sql``
         }
       ORDER BY d.created_at ASC
       LIMIT ${limit}
    `);

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      reference: row.reference,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at),
      providerOrderId: row.provider_order_id,
    }));
  }
}
