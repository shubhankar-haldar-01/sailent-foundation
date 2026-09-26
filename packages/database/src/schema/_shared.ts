import { sql } from 'drizzle-orm';
import { bigint, char, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Column helpers shared by every table, so conventions cannot drift.
 * See docs/database-architecture.md §1.
 */

/**
 * Primary key: UUID — time-ordered v7 supplied by the application where it
 * matters. Index locality is good and insert order is meaningful, without
 * exposing a sequential count of donors to anyone who can read an id.
 */
export const primaryId = () => uuid('id').primaryKey().defaultRandom();

/** `created_at` / `updated_at`, always timestamptz in UTC. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
};

/**
 * Soft delete — for CONTENT and CATALOGUE entities only.
 *
 * Never applied to donations, payments, receipts or audit logs: those are
 * immutable financial history (docs/database-architecture.md §1).
 */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

/**
 * Money (decision A2).
 *
 * Every monetary value is an INTEGER COUNT OF PAISE stored as `bigint`. ₹900 is
 * 90000. There is no numeric, no decimal, no float anywhere in this schema.
 *
 * `mode: 'number'` keeps the TypeScript ergonomics of a plain number. That is
 * safe here: JavaScript integers are exact to 2^53, which is roughly ₹90
 * trillion — several orders of magnitude beyond any plausible donation, and the
 * database column remains a true 64-bit integer regardless.
 *
 * Why not `numeric`: Postgres numeric is exact, but it round-trips through
 * JavaScript as a string and invites accidental `parseFloat`. An integer count
 * of the smallest unit is the representation that cannot be got wrong.
 */
export const money = (name: string) => bigint(name, { mode: 'number' });

/** Currency. INR-only for v1, but the column exists so adding one is a data change. */
export const currency = (name = 'currency') => char(name, { length: 3 }).notNull().default('INR');
