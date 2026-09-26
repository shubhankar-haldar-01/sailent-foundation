import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { currency, money, primaryId, timestamps } from './_shared.js';
import { paymentMethodEnum, paymentProviderEnum, paymentStatusEnum } from './enums.js';
import { donations } from './donations.js';
import { users } from './users.js';

/**
 * Payments.
 *
 * SCHEMA FOUNDATION ONLY in Phase 3 — no provider is integrated.
 *
 * `status` moves FORWARD ONLY, and the application state machine is its only
 * writer. That is what makes out-of-order webhook delivery safe (decision A4).
 */
export const payments = pgTable(
  'payments',
  {
    id: primaryId(),
    donationId: uuid('donation_id')
      .notNull()
      .references(() => donations.id, { onDelete: 'restrict' }),

    provider: paymentProviderEnum('provider').notNull().default('razorpay'),
    providerOrderId: varchar('provider_order_id', { length: 128 }),
    providerPaymentId: varchar('provider_payment_id', { length: 128 }),
    /** Stored for audit. Verification always uses the RAW request body. */
    providerSignature: varchar('provider_signature', { length: 256 }),

    amount: money('amount').notNull(),
    currency: currency(),
    method: paymentMethodEnum('method'),
    status: paymentStatusEnum('status').notNull().default('created'),

    paidAt: timestamp('paid_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    errorCode: varchar('error_code', { length: 64 }),

    bank: varchar('bank', { length: 64 }),
    wallet: varchar('wallet', { length: 64 }),
    cardLast4: varchar('card_last4', { length: 4 }),
    cardNetwork: varchar('card_network', { length: 32 }),
    /** FCRA guard: a foreign instrument must be identifiable and returnable. */
    isInternational: boolean('is_international').notNull().default(false),

    fee: money('fee'),
    tax: money('tax'),
    /** ADMIN-ONLY. Raw provider response, for incident forensics. */
    metadata: jsonb('metadata'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('payments_provider_payment_id_unique').on(table.providerPaymentId),
    index('payments_order_idx').on(table.providerOrderId),
    index('payments_donation_idx').on(table.donationId),
    index('payments_status_created_idx').on(table.status, table.createdAt),

    check('payments_amount_positive', sql`amount > 0`),
  ],
);

/** Append-only ledger of every payment state change — "what happened, in order". */
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: primaryId(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    fromStatus: paymentStatusEnum('from_status'),
    toStatus: paymentStatusEnum('to_status').notNull(),
    /** webhook | api_fetch | reconciliation | manual */
    source: varchar('source', { length: 24 }).notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('payment_transactions_payment_idx').on(table.paymentId, table.occurredAt)],
);

/**
 * Webhook idempotency ledger — the most important table for financial
 * correctness (decision A4).
 *
 * `providerEventId` is UNIQUE, and that single constraint IS the entire
 * deduplication strategy: a duplicate delivery becomes an insert conflict and a
 * no-op. `rawBody` holds the exact bytes received, because the HMAC is computed
 * over them and because an incident is answered with evidence, not recollection.
 */
export const paymentWebhooks = pgTable(
  'payment_webhooks',
  {
    id: primaryId(),
    provider: paymentProviderEnum('provider').notNull().default('razorpay'),
    providerEventId: varchar('provider_event_id', { length: 128 }).notNull(),
    eventType: varchar('event_type', { length: 96 }).notNull(),

    rawBody: text('raw_body').notNull(),
    signature: varchar('signature', { length: 256 }),
    signatureValid: boolean('signature_valid').notNull().default(false),
    headers: jsonb('headers'),

    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    /** pending | processed | failed | ignored */
    processingStatus: varchar('processing_status', { length: 16 }).notNull().default('pending'),
    error: text('error'),

    relatedPaymentId: uuid('related_payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('payment_webhooks_event_id_unique').on(table.providerEventId),
    index('payment_webhooks_queue_idx').on(table.processingStatus, table.receivedAt),
    index('payment_webhooks_type_idx').on(table.eventType),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentWebhook = typeof paymentWebhooks.$inferSelect;
