import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { currency, money, primaryId, timestamps } from './_shared.js';
import { donations } from './donations.js';
import { donors } from './donors.js';

/**
 * The gapless receipt counter.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A POSTGRES SEQUENCE WOULD BE WRONG HERE, and the reason is the whole point
 * of this table.
 *
 * `nextval()` does not roll back. A transaction that takes number 41 and then
 * fails leaves 41 consumed forever, and the receipt book reads 40, 42, 43. For
 * an ordinary surrogate key that is harmless and exactly why sequences are
 * fast. For a financial document it is a missing receipt that somebody has to
 * explain to an auditor.
 *
 * So the counter is an ordinary ROW, taken with `SELECT … FOR UPDATE` inside
 * the same transaction that writes the receipt. If that transaction rolls back,
 * the number is released with it. The cost is that receipt allocation
 * serialises — two simultaneous captures queue behind this row. At the volume
 * of an NGO's donations that is invisible, and it buys a book with no holes.
 *
 * One row per financial year, so the count restarts each year and the lock is
 * only ever contended within the current one.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const receiptSequences = pgTable(
  'receipt_sequences',
  {
    /** Indian financial year in which the receipt falls, e.g. 2026 for FY 2026-27. */
    financialYear: smallint('financial_year').primaryKey(),
    /** The number the NEXT receipt in this year will take. */
    nextValue: integer('next_value').notNull().default(1),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [check('receipt_sequences_next_positive', sql`${table.nextValue} > 0`)],
);

/**
 * Receipts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A RECEIPT IS NOT AN 80G CERTIFICATE, and no copy anywhere may say it is
 * (decision A7).
 *
 * This is the transactional acknowledgement that money was received: issued
 * immediately, one per captured donation. The 80G tax certificate is Form 10BE,
 * which the Income Tax Department issues to the donor AFTER the organisation
 * files its annual Form 10BD. The two are months apart and come from different
 * parties. Conflating them promises a donor a tax benefit this platform cannot
 * deliver.
 *
 * `eightyGEligible` therefore records what was TRUE AT ISSUE — whether the
 * organisation held a live 80G registration on that date — and is a fact about
 * the donation, not a promise about the donor's assessment.
 *
 * IMMUTABLE. No soft delete, no update path in the services. A receipt that
 * needs correcting is superseded by a fresh one that references it, so the
 * trail shows both. That is why `supersededById` exists and why there is no
 * `deletedAt`.
 *
 * Everything the receipt DISPLAYS is snapshotted onto it. Not joined: a
 * receipt reprinted in two years must read exactly what the donor was sent,
 * whatever the donor record, the campaign title or the catalogue say by then.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const receipts = pgTable(
  'receipts',
  {
    id: primaryId(),

    /** The printed number: SFL-2026-000001. Unique across all time. */
    receiptNumber: varchar('receipt_number', { length: 32 }).notNull(),
    financialYear: smallint('financial_year').notNull(),
    /** The counter value this took, kept so a gap is provable rather than argued. */
    sequence: integer('sequence').notNull(),

    donationId: uuid('donation_id')
      .notNull()
      .references(() => donations.id, { onDelete: 'restrict' }),
    donorId: uuid('donor_id').references(() => donors.id, { onDelete: 'restrict' }),

    /** SNAPSHOTS. See the note above — none of these is a join at render time. */
    donorName: varchar('donor_name', { length: 255 }).notNull(),
    donorEmail: varchar('donor_email', { length: 255 }),
    campaignTitle: varchar('campaign_title', { length: 240 }),
    programTitle: varchar('program_title', { length: 240 }),

    amount: money('amount').notNull(),
    currency: currency(),

    /**
     * The line items as they were, frozen.
     *
     * JSON rather than a join to `donation_items`, because a receipt is a
     * document: it must render identically in five years from its own contents,
     * without depending on rows that later fulfilment may have annotated since.
     */
    lineItems: jsonb('line_items').notNull(),

    /** The payment this acknowledges, for reconciliation. */
    paymentReference: varchar('payment_reference', { length: 128 }),

    /**
     * Whether a live 80G registration was held on the issue date. A FACT ABOUT
     * THE DONATION, recorded at issue — never a claim about the donor's tax
     * position, and never rendered as "80G certificate".
     */
    eightyGEligible: timestamp('eighty_g_eligible_at', { withTimezone: true }),
    registrationNumber: varchar('registration_number', { length: 64 }),

    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when a correction replaces this one. The original is never removed. */
    supersededById: uuid('superseded_by_id'),
    supersededReason: text('superseded_reason'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('receipts_number_unique').on(table.receiptNumber),
    /** One receipt per donation, enforced rather than assumed. */
    uniqueIndex('receipts_donation_unique').on(table.donationId),
    /** The gapless guarantee, as a constraint: no year may issue a number twice. */
    uniqueIndex('receipts_year_sequence_unique').on(table.financialYear, table.sequence),
    index('receipts_donor_idx').on(table.donorId),
    index('receipts_issued_idx').on(table.issuedAt),

    check('receipts_amount_positive', sql`amount > 0`),
    check('receipts_sequence_positive', sql`sequence > 0`),
  ],
);

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type ReceiptSequence = typeof receiptSequences.$inferSelect;
