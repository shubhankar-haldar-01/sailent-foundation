import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';

import {
  campaignProducts,
  campaigns,
  donationItems,
  products,
  type DatabaseClient,
} from '@sailent/database';
import { canTransitionProduct, slugify, type ProductStatus } from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import {
  offsetFor,
  paginate,
  resolveSort,
  type PaginationQuery,
} from '../../common/dto/pagination.dto.js';

export interface ProductWriteInput {
  name: string;
  slug?: string;
  description: string;
  image?: string | null;
  /** Paise. */
  defaultPrice: number;
  unit?: string;
}

export interface ProductListQuery extends PaginationQuery {
  status?: ProductStatus | 'all';
  /** Restrict to products this campaign does NOT already offer. */
  notInCampaignId?: string;
}

const SORTABLE = {
  name: products.name,
  defaultPrice: products.defaultPrice,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  status: products.status,
} as const;

/**
 * The PRODUCT CATALOGUE — the master list of things a donor can fund.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A product exists INDEPENDENTLY of any campaign. "School Kit" is one row,
 * described once, and three appeals offering it are three rows in
 * `campaign_products` pointing at it — not three copies of the same sentence
 * drifting apart.
 *
 * TWO INVARIANTS GOVERN THIS FILE.
 *
 * 1. `defaultPrice` IS A SUGGESTION, NOT A LIVE LOOKUP. It seeds the price
 *    field when an operator adds this product to a campaign, and is never read
 *    again. Editing it here changes nothing about what any campaign currently
 *    charges, and nothing whatsoever about a donation already taken — those
 *    snapshot their price onto the line (decision A5).
 *
 *    This is the difference between a catalogue and a price list. A price list
 *    that rewrites history cannot produce a receipt.
 *
 * 2. NOTHING IS DELETED. `archive()` is the strongest operation here. A
 *    product cited by a donation from two years ago must still resolve, or
 *    that donation's receipt has a hole in it — so the foreign keys are
 *    `ON DELETE RESTRICT` and there is no hard-delete path in this service.
 *    `remove()` exists and refuses, loudly, with the reason.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class ProductsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: ProductListQuery) {
    const filters: SQL[] = [isNull(products.deletedAt)];

    // Archived is EXCLUDED by default. An operator picking a product for a
    // campaign should not have to scroll past things the organisation retired,
    // but `status=all` is there for the person auditing the catalogue.
    if (query.status && query.status !== 'all') {
      filters.push(eq(products.status, query.status));
    } else if (!query.status) {
      filters.push(inArray(products.status, ['active', 'inactive']));
    }

    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(products.name, term),
        ilike(products.slug, term),
        ilike(products.description, term),
      );
      if (search) filters.push(search);
    }

    /**
     * The selector's filter: hide what this campaign already offers.
     *
     * This is what stops an operator creating a duplicate "School Kit" because
     * the one already on the campaign was not visible in the picker. The
     * unique index would refuse the insert anyway; this makes the refusal
     * unnecessary rather than merely survivable.
     */
    if (query.notInCampaignId) {
      filters.push(
        // Literal identifiers — see the note on `campaignCount` below for why
        // `${campaignProducts.productId}` cannot be used here. The campaign id
        // stays interpolated because it is a BOUND PARAMETER, which Drizzle
        // handles correctly; only column references are the hazard.
        sql`NOT EXISTS (
          SELECT 1 FROM campaign_products cp
          WHERE cp.product_id = products.id
            AND cp.campaign_id = ${query.notInCampaignId}
            AND cp.deleted_at IS NULL
        )`,
      );
    }

    const where = and(...filters);
    const { column, direction } = resolveSort(query.sort, SORTABLE, 'name');

    const [rows, [count]] = await Promise.all([
      this.database.db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          image: products.image,
          defaultPrice: products.defaultPrice,
          currency: products.currency,
          unit: products.unit,
          status: products.status,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          /**
           * How many campaigns offer this. Shown in the catalogue so an
           * operator can see, before editing or archiving, whether the change
           * is about to affect four live appeals or none.
           *
           * A correlated subquery rather than a join + GROUP BY: the join would
           * multiply the product row and force a grouping over every selected
           * column for one integer.
           *
           * ══════════════════════════════════════════════════════════════════
           * WRITTEN AS LITERAL SQL, not with `${campaignProducts.productId}`
           * interpolation, and that is not a style preference.
           *
           * Inside a `sql` template, Drizzle emits column references
           * UNQUALIFIED: `${campaignProducts.productId}` becomes `"product_id"`
           * rather than `"campaign_products"."product_id"`. In a correlated
           * subquery that is silently catastrophic — the bare name binds to the
           * INNER table whenever it has a column of that name, so
           * `WHERE "product_id" = "id"` compares campaign_products.product_id
           * to campaign_products.id and is false for every row. No error, no
           * warning, a count of zero forever.
           *
           * It is worse than an outright failure because it sometimes works:
           * where the inner table happens to LACK the column, the name falls
           * through to the outer scope and the query is correct by accident.
           * Two subqueries written identically, one right and one wrong.
           * Qualified literal SQL is the only form that cannot do this.
           * ══════════════════════════════════════════════════════════════════
           */
          campaignCount: sql<number>`(
            SELECT count(*)::int FROM campaign_products cp
            WHERE cp.product_id = products.id
              AND cp.deleted_at IS NULL
          )`,
        })
        .from(products)
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
        .orderBy(direction === 'desc' ? desc(column) : asc(column), products.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(products)
        .where(where),
    ]);

    return paginate(rows, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select()
      .from(products)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Product');

    // Which campaigns offer it, and at what price. This is the answer to "what
    // will I break if I change this", and it is the reason the detail view
    // exists as more than an edit form.
    const usage = await this.database.db
      .select({
        campaignProductId: campaignProducts.id,
        campaignId: campaigns.id,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        campaignStatus: campaigns.status,
        price: campaignProducts.price,
        targetQuantity: campaignProducts.targetQuantity,
        providedQuantity: campaignProducts.providedQuantity,
        isActive: campaignProducts.isActive,
      })
      .from(campaignProducts)
      .innerJoin(campaigns, eq(campaigns.id, campaignProducts.campaignId))
      .where(and(eq(campaignProducts.productId, id), isNull(campaignProducts.deletedAt)))
      .orderBy(asc(campaigns.title));

    return { ...row, campaigns: usage, campaignCount: usage.length };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(input: ProductWriteInput, actor: AuthenticatedActor, context: AuditContext) {
    const slug = await this.allocateSlug(input.slug ?? slugify(input.name));

    const [created] = await this.database.db
      .insert(products)
      .values({
        name: input.name.trim(),
        slug,
        description: input.description.trim(),
        image: input.image ?? null,
        defaultPrice: input.defaultPrice,
        unit: input.unit?.trim() || 'unit',
        // Created ACTIVE. A catalogue entry with no campaign attached is
        // already invisible to the public, so a separate draft state would be
        // a second way of expressing the same thing.
        status: 'active',
      })
      .returning({ id: products.id });

    if (!created) throw new ConflictException('Could not create the product.');

    await this.audit.record({
      action: 'product.create',
      entityType: 'product',
      entityId: created.id,
      userId: actor.id,
      newValues: {
        name: input.name,
        slug,
        defaultPrice: input.defaultPrice,
        unit: input.unit ?? 'unit',
      },
      ...context,
    });

    return this.getById(created.id);
  }

  /**
   * Edit a catalogue product.
   *
   * A CHANGE HERE DOES NOT PROPAGATE. Campaign prices are independent columns
   * and historical donation lines are snapshots; neither is touched. The audit
   * row for a `defaultPrice` change says so explicitly, because "I changed the
   * price and the campaigns did not update" is the question this design will
   * be asked most often, and the log should answer it.
   */
  async update(
    id: string,
    input: Partial<ProductWriteInput>,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);

    if (before.status === 'archived') {
      throw new ConflictException(
        'This product is archived. Restore it before editing, so the change is deliberate.',
      );
    }

    let slug = before.slug;
    if (input.slug !== undefined && input.slug !== before.slug) {
      slug = await this.allocateSlug(input.slug, id);
    }

    const fields: Record<string, unknown> = { slug, updatedAt: new Date() };
    if (input.name !== undefined) fields.name = input.name.trim();
    if (input.description !== undefined) fields.description = input.description.trim();
    if (input.image !== undefined) fields.image = input.image;
    if (input.defaultPrice !== undefined) fields.defaultPrice = input.defaultPrice;
    if (input.unit !== undefined) fields.unit = input.unit.trim() || 'unit';

    await this.database.db.update(products).set(fields).where(eq(products.id, id));

    if (input.defaultPrice !== undefined && input.defaultPrice !== before.defaultPrice) {
      await this.audit.record({
        action: 'product.default_price_changed',
        entityType: 'product',
        entityId: id,
        userId: actor.id,
        oldValues: { defaultPrice: before.defaultPrice },
        newValues: {
          defaultPrice: input.defaultPrice,
          // Recorded as data, not prose in a comment, so the person reading
          // the log a year from now does not have to take it on trust.
          affectsExistingCampaignPrices: false,
          affectsHistoricalDonations: false,
          campaignsOffering: before.campaignCount,
        },
        severity: 'warning',
        ...context,
      });
    }

    await this.audit.record({
      action: 'product.update',
      entityType: 'product',
      entityId: id,
      userId: actor.id,
      oldValues: { name: before.name, slug: before.slug, unit: before.unit },
      newValues: { ...input, slug },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Move a product between `active`, `inactive` and `archived`.
   *
   * ARCHIVING IS THE DESTRUCTIVE-LOOKING OPERATION THAT IS NOT DESTRUCTIVE.
   * The row stays, every donation that cites it still resolves, and every
   * campaign offering it keeps its own record of having done so — the product
   * simply stops being addable and stops being offerable.
   *
   * It is refused while live campaigns still offer it. Withdrawing something
   * from under four appeals that are actively asking for it is a decision to
   * make campaign by campaign, not a side effect of one click on a catalogue
   * page.
   */
  async setStatus(
    id: string,
    status: ProductStatus,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    const from = before.status as ProductStatus;

    if (from === status) {
      throw new ConflictException(`This product is already ${status}.`);
    }

    if (!canTransitionProduct(from, status)) {
      throw new ConflictException(`A product cannot go from ${from} to ${status}.`);
    }

    if (status === 'archived') {
      const blocking = before.campaigns.filter(
        (row) => row.isActive && !['completed', 'archived'].includes(row.campaignStatus),
      );

      if (blocking.length > 0) {
        throw new ConflictException(
          `${blocking.length} live campaign${blocking.length === 1 ? '' : 's'} still offer this product: ` +
            `${blocking.map((row) => row.campaignTitle).join(', ')}. ` +
            'Remove it from each one first.',
        );
      }

      if (!reason?.trim()) {
        throw new ValidationException(
          [{ field: 'reason', code: 'required', message: 'Say why this is being archived.' }],
          'A reason is required when archiving a product.',
        );
      }
    }

    await this.database.db
      .update(products)
      .set({ status, updatedAt: new Date() })
      .where(eq(products.id, id));

    await this.audit.record({
      action: `product.${status === 'archived' ? 'archive' : status === 'active' ? 'activate' : 'deactivate'}`,
      entityType: 'product',
      entityId: id,
      userId: actor.id,
      oldValues: { status: from },
      newValues: { status },
      reason,
      severity: status === 'archived' ? 'critical' : 'warning',
      ...context,
    });

    return this.getById(id);
  }

  /**
   * There is no delete. This says so, with the specifics.
   *
   * A 409 naming the campaigns and the donation count is worth more than a
   * missing route: an operator who reaches for delete gets told what the
   * product is holding up and what to do instead, rather than wondering
   * whether the button is missing or broken.
   */
  async remove(id: string): Promise<never> {
    const product = await this.getById(id);

    const [donations] = await this.database.db
      .select({ value: sql<number>`count(*)::int` })
      .from(donationItems)
      .where(eq(donationItems.productId, id));

    const cited = donations?.value ?? 0;

    throw new ConflictException(
      'Products are archived, never deleted. ' +
        `“${product.name}” is offered by ${product.campaignCount} campaign${product.campaignCount === 1 ? '' : 's'} ` +
        `and cited by ${cited} donation line${cited === 1 ? '' : 's'}; deleting it would leave those records ` +
        'pointing at nothing. Archive it instead — it disappears from every picker and stays readable on every receipt.',
    );
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  /**
   * Slugs are unique ACROSS THE CATALOGUE, not per campaign.
   *
   * That is the change Phase 5 makes. Before, "school-kit" was unique within a
   * campaign, so three campaigns each had their own — which is exactly the
   * duplication a master catalogue exists to end. One "school-kit" now, and
   * the second attempt is told which one already holds it.
   */
  private async allocateSlug(candidate: string, exceptId?: string): Promise<string> {
    const slug = slugify(candidate);

    if (!slug) {
      throw new ValidationException([
        { field: 'slug', code: 'required', message: 'Enter a URL for this product.' },
      ]);
    }

    const [clash] = await this.database.db
      .select({ id: products.id, name: products.name, status: products.status })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    if (clash && clash.id !== exceptId) {
      throw new ConflictException(
        clash.status === 'archived'
          ? `“${clash.name}” already uses the URL “${slug}”. It is archived — restore it rather than creating a second one.`
          : `“${clash.name}” already uses the URL “${slug}”.`,
      );
    }

    return slug;
  }
}
