import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';

import {
  campaigns,
  donationItems,
  donations,
  donors,
  payments,
  receipts,
  type DatabaseClient,
} from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { NotFoundException } from '../../common/exceptions.js';
import {
  offsetFor,
  paginate,
  resolveSort,
  type PaginationQuery,
} from '../../common/dto/pagination.dto.js';

export interface AdminDonationQuery extends PaginationQuery {
  status?: string;
  campaignId?: string;
  donorId?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
}

const SORTABLE = {
  createdAt: donations.createdAt,
  completedAt: donations.completedAt,
  amount: donations.amount,
  status: donations.status,
} as const;

/**
 * Reading donations, for staff.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO LEVELS OF DETAIL, SPLIT ON PERMISSION, NOT ON ROUTE.
 *
 * `donation.read` gets the money and the state. `donation.read_pii` gets the
 * donor's name, email and phone, and is a SENSITIVE permission requiring a
 * recent re-authentication.
 *
 * The split is enforced HERE, in the query, by `includePii`. Fetching a donor's
 * email and then dropping it in a serialiser means it has been read into a
 * process, put in a heap dump and possibly logged by an interceptor that did
 * not know it was sensitive. A field the query never selects cannot leak.
 *
 * There is NO write path in this service, and deliberately no way for an
 * administrator to mark a donation successful by hand. The only routes into
 * `successful` are a verified Razorpay payment and a reconciliation that
 * re-fetches one. An admin who could flip that flag could manufacture a
 * donation, and the audit log would show them doing it — which is a control,
 * not a defence.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class AdminDonationsService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async list(query: AdminDonationQuery, options: { includePii: boolean }) {
    const filters: SQL[] = [];

    if (query.status && query.status !== 'all') {
      filters.push(sql`${donations.status} = ${query.status}`);
    }
    if (query.campaignId) filters.push(eq(donations.campaignId, query.campaignId));
    if (query.donorId) filters.push(eq(donations.donorId, query.donorId));
    if (query.from) filters.push(gte(donations.createdAt, query.from));
    if (query.to) filters.push(lte(donations.createdAt, query.to));
    if (query.minAmount) filters.push(gte(donations.amount, query.minAmount));

    /**
     * Search covers the REFERENCE always, and the donor's name and email only
     * for a caller allowed to see them. Otherwise a staff member without
     * `donation.read_pii` could confirm an address by searching for it and
     * reading the result count — an oracle is a disclosure.
     */
    if (query.q) {
      const term = `%${query.q}%`;
      const clauses = [ilike(donations.reference, term)];
      if (options.includePii) {
        clauses.push(ilike(donors.email, term), ilike(donors.firstName, term));
      }
      const search = or(...clauses);
      if (search) filters.push(search);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const { column, direction } = resolveSort(query.sort, SORTABLE, 'createdAt');

    const [rows, [count]] = await Promise.all([
      this.database.db
        .select({
          id: donations.id,
          reference: donations.reference,
          status: donations.status,
          donationType: donations.donationType,
          amount: donations.amount,
          currency: donations.currency,
          anonymous: donations.anonymous,
          createdAt: donations.createdAt,
          completedAt: donations.completedAt,
          campaignId: donations.campaignId,
          campaignTitle: campaigns.title,
          campaignSlug: campaigns.slug,
          receiptNumber: receipts.receiptNumber,
          // Selected conditionally — see the note above.
          donorName: options.includePii
            ? sql<string | null>`concat_ws(' ', ${donors.firstName}, ${donors.lastName})`
            : sql<string | null>`NULL`,
          donorEmail: options.includePii ? donors.email : sql<string | null>`NULL`,
        })
        .from(donations)
        .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
        .leftJoin(donors, eq(donors.id, donations.donorId))
        .leftJoin(receipts, eq(receipts.donationId, donations.id))
        .where(where)
        /*
          A DETERMINISTIC TIEBREAKER.

          Rows seeded or written in one statement share a `created_at` to the
          microsecond, and Postgres gives no defined order among ties — so two
          identical queries can return them in different orders. On a paginated
          list that is not cosmetic: a row can appear on page one AND page two,
          or on neither. It surfaced as a cross-suite test failure that passed
          in isolation, which is what an unstable sort looks like from outside.
        */
        .orderBy(direction === 'desc' ? desc(column) : column, donations.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(donations)
        .leftJoin(donors, eq(donors.id, donations.donorId))
        .where(where),
    ]);

    return paginate(rows, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string, options: { includePii: boolean; includePayment: boolean }) {
    const [row] = await this.database.db
      .select({
        id: donations.id,
        reference: donations.reference,
        status: donations.status,
        donationType: donations.donationType,
        amount: donations.amount,
        currency: donations.currency,
        anonymous: donations.anonymous,
        donorMessage: donations.donorMessage,
        source: donations.source,
        ipCountry: donations.ipCountry,
        createdAt: donations.createdAt,
        completedAt: donations.completedAt,
        failedReason: donations.failedReason,
        campaignId: donations.campaignId,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        receiptNumber: receipts.receiptNumber,
        receiptIssuedAt: receipts.issuedAt,
        donorId: donations.donorId,
        donorName: options.includePii
          ? sql<string | null>`concat_ws(' ', ${donors.firstName}, ${donors.lastName})`
          : sql<string | null>`NULL`,
        donorEmail: options.includePii ? donors.email : sql<string | null>`NULL`,
        donorPhone: options.includePii ? donors.phone : sql<string | null>`NULL`,
      })
      .from(donations)
      .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
      .leftJoin(donors, eq(donors.id, donations.donorId))
      .leftJoin(receipts, eq(receipts.donationId, donations.id))
      .where(eq(donations.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('Donation');

    const items = await this.database.db
      .select({
        itemType: donationItems.itemType,
        itemName: donationItems.itemName,
        quantity: donationItems.quantity,
        unitPrice: donationItems.unitPrice,
        totalPrice: donationItems.totalPrice,
        productId: donationItems.productId,
      })
      .from(donationItems)
      .where(eq(donationItems.donationId, id));

    /**
     * Payment identifiers are gated on `payment.read`.
     *
     * A Razorpay order id is not a secret, but it is the handle to the
     * provider dashboard, and a role that can see donation totals is not
     * automatically a role that should be able to look a payment up there.
     */
    const payment = options.includePayment
      ? ((
          await this.database.db
            .select({
              provider: payments.provider,
              providerOrderId: payments.providerOrderId,
              providerPaymentId: payments.providerPaymentId,
              status: payments.status,
              method: payments.method,
              bank: payments.bank,
              wallet: payments.wallet,
              cardLast4: payments.cardLast4,
              cardNetwork: payments.cardNetwork,
              isInternational: payments.isInternational,
              fee: payments.fee,
              tax: payments.tax,
              paidAt: payments.paidAt,
              failureReason: payments.failureReason,
              errorCode: payments.errorCode,
            })
            .from(payments)
            .where(eq(payments.donationId, id))
            .limit(1)
        )[0] ?? null)
      : null;

    return { ...row, items, payment };
  }
}
