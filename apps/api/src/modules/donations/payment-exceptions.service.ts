import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { DatabaseClient } from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { EXPIRE_AFTER_HOURS, RECONCILE_AFTER_MINUTES } from './payment-reconciliation.service.js';

/** A webhook still `pending` after this long was not finished — a crash, most likely. */
const UNFINISHED_WEBHOOK_MINUTES = 15;
/** A pending donation older than this is listed. Older than `EXPIRE_AFTER_HOURS` is overdue. */
const STUCK_DONATION_MINUTES = 60;
const LIST_LIMIT = 100;

export interface WebhookException {
  id: string;
  providerEventId: string;
  eventType: string;
  processingStatus: string;
  error: string | null;
  receivedAt: string;
  processedAt: string | null;
  /** From the stored payload — identifiers only, never the payer's details. */
  providerPaymentId: string | null;
  providerOrderId: string | null;
  donationReference: string | null;
  donationStatus: string | null;
}

export interface StuckDonation {
  id: string;
  reference: string;
  status: string;
  /** Paise. */
  amount: number;
  campaignTitle: string | null;
  providerOrderId: string | null;
  createdAt: string;
  /** Older than the expiry cutoff: reconciliation should have resolved it and did not. */
  overdue: boolean;
}

/**
 * Payment exceptions, for the Finance → Payment exceptions page (Phase 11).
 *
 * READ-ONLY, BY DESIGN. It shows what needs a human — a webhook that failed or
 * never finished, an event flagged for review (an amount, currency or order
 * that did not match, a refund raised in the Razorpay dashboard), a donation
 * still pending long after it should have been settled — and offers no way to
 * change any of it. There is no "mark successful": the only route to a
 * successful donation is a payment Razorpay confirms.
 *
 * No donor identity and no raw webhook body: the body carries the payer's
 * email and phone. Identifiers are enough to look the payment up in the
 * Razorpay dashboard.
 */
@Injectable()
export class PaymentExceptionsService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async list(now: Date = new Date()) {
    const unfinishedBefore = new Date(now.getTime() - UNFINISHED_WEBHOOK_MINUTES * 60_000);
    const stuckBefore = new Date(now.getTime() - STUCK_DONATION_MINUTES * 60_000);
    const overdueBefore = new Date(now.getTime() - EXPIRE_AFTER_HOURS * 3_600_000);
    const cancelledSince = new Date(now.getTime() - 7 * 86_400_000);

    const webhooks = await this.database.db.execute<{
      id: string;
      provider_event_id: string;
      event_type: string;
      processing_status: string;
      error: string | null;
      received_at: string | Date;
      processed_at: string | Date | null;
      raw_body: string;
    }>(sql`
      SELECT id, provider_event_id, event_type, processing_status, error,
             received_at, processed_at, raw_body
        FROM payment_webhooks
       WHERE processing_status IN ('failed', 'needs_review')
          OR (processing_status = 'pending'
              AND received_at < ${unfinishedBefore.toISOString()}::timestamptz)
       ORDER BY received_at DESC
       LIMIT ${LIST_LIMIT}
    `);

    const webhookRows = (webhooks.rows ?? []).map((row) => ({
      row,
      ids: paymentIdentifiers(row.raw_body),
    }));

    const orderIds = [
      ...new Set(webhookRows.map(({ ids }) => ids.orderId).filter((id): id is string => !!id)),
    ];
    const byOrder = new Map<string, { reference: string; status: string }>();
    if (orderIds.length > 0) {
      const linked = await this.database.db.execute<{
        provider_order_id: string;
        reference: string;
        status: string;
      }>(sql`
        SELECT p.provider_order_id, d.reference, d.status
          FROM payments p
          JOIN donations d ON d.id = p.donation_id
         WHERE p.provider_order_id IN (${sql.join(
           orderIds.map((id) => sql`${id}`),
           sql`, `,
         )})
      `);
      for (const row of linked.rows ?? []) {
        byOrder.set(row.provider_order_id, { reference: row.reference, status: row.status });
      }
    }

    const webhookExceptions: WebhookException[] = webhookRows.map(({ row, ids }) => {
      const donation = ids.orderId ? byOrder.get(ids.orderId) : undefined;
      return {
        id: row.id,
        providerEventId: row.provider_event_id,
        eventType: row.event_type,
        processingStatus: row.processing_status,
        error: row.error,
        receivedAt: new Date(row.received_at).toISOString(),
        processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null,
        providerPaymentId: ids.paymentId,
        providerOrderId: ids.orderId,
        donationReference: donation?.reference ?? null,
        donationStatus: donation?.status ?? null,
      };
    });

    const stuck = await this.database.db.execute<{
      id: string;
      reference: string;
      status: string;
      amount: string | number;
      campaign_title: string | null;
      provider_order_id: string | null;
      created_at: string | Date;
    }>(sql`
      SELECT d.id, d.reference, d.status, d.amount, c.title AS campaign_title,
             p.provider_order_id, d.created_at
        FROM donations d
        LEFT JOIN campaigns c ON c.id = d.campaign_id
        LEFT JOIN payments p ON p.donation_id = d.id
       WHERE d.status IN ('pending', 'processing')
         AND d.created_at < ${stuckBefore.toISOString()}::timestamptz
       ORDER BY d.created_at ASC
       LIMIT ${LIST_LIMIT}
    `);

    const stuckDonations: StuckDonation[] = (stuck.rows ?? []).map((row) => {
      const createdAt = new Date(row.created_at);
      return {
        id: row.id,
        reference: row.reference,
        status: row.status,
        amount: Number(row.amount),
        campaignTitle: row.campaign_title,
        providerOrderId: row.provider_order_id,
        createdAt: createdAt.toISOString(),
        overdue: createdAt < overdueBefore,
      };
    });

    const [counts] = (
      await this.database.db.execute<{ cancelled: string | number }>(sql`
        SELECT count(*)::int AS cancelled
          FROM donations
         WHERE status = 'cancelled'
           AND updated_at > ${cancelledSince.toISOString()}::timestamptz
      `)
    ).rows ?? [{ cancelled: 0 }];

    return {
      generatedAt: now.toISOString(),
      thresholds: {
        unfinishedWebhookMinutes: UNFINISHED_WEBHOOK_MINUTES,
        stuckDonationMinutes: STUCK_DONATION_MINUTES,
        reconcileAfterMinutes: RECONCILE_AFTER_MINUTES,
        expireAfterHours: EXPIRE_AFTER_HOURS,
      },
      summary: {
        failedWebhooks: webhookExceptions.filter((item) => item.processingStatus === 'failed')
          .length,
        needsReview: webhookExceptions.filter((item) => item.processingStatus === 'needs_review')
          .length,
        unfinishedWebhooks: webhookExceptions.filter((item) => item.processingStatus === 'pending')
          .length,
        stuckDonations: stuckDonations.length,
        overdueDonations: stuckDonations.filter((item) => item.overdue).length,
        cancelledLast7Days: Number(counts?.cancelled ?? 0),
      },
      webhooks: webhookExceptions,
      stuckDonations,
    };
  }
}

/** The payment and order ids in a stored Razorpay payload, and nothing else. */
function paymentIdentifiers(rawBody: string): { paymentId: string | null; orderId: string | null } {
  try {
    const body = JSON.parse(rawBody) as {
      payload?: {
        payment?: { entity?: { id?: unknown; order_id?: unknown } };
        refund?: { entity?: { payment_id?: unknown } };
      };
    };
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    const paymentId =
      typeof payment?.id === 'string'
        ? payment.id
        : typeof refund?.payment_id === 'string'
          ? refund.payment_id
          : null;
    return {
      paymentId,
      orderId: typeof payment?.order_id === 'string' ? payment.order_id : null,
    };
  } catch {
    return { paymentId: null, orderId: null };
  }
}
