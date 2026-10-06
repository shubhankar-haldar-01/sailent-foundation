import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { campaigns, categories, programs, type DatabaseClient } from '@sailent/database';
import {
  campaignProgress,
  canTransitionCampaign,
  daysRemaining,
  type CampaignStatus,
} from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { CategoriesService } from './categories.service.js';
import { SlugService } from './slug.service.js';
import type { AuditContext } from './programs.service.js';
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

export interface CampaignWriteInput {
  title: string;
  slug?: string;
  programId?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  beneficiaryContext?: string | null;
  coverImage?: string | null;
  categoryId?: string | null;
  location?: string | null;
  state?: string | null;
  city?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  fundraisingGoal?: number;
  beneficiaryTarget?: number | null;
  fundUtilization?: string | null;
  stopAtGoal?: boolean;
  allowCustomAmount?: boolean;
  minDonationAmount?: number;
  isFeatured?: boolean;
  featuredOrder?: number | null;
  impactNotes?: { label: string; value: number; unit?: string }[] | null;
  internalNotes?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CampaignListQuery extends PaginationQuery {
  status?: CampaignStatus | 'all';
  categoryId?: string;
  programId?: string;
  state?: string;
  startsAfter?: Date;
  endsBefore?: Date;
}

const SORTABLE = {
  createdAt: campaigns.createdAt,
  updatedAt: campaigns.updatedAt,
  title: campaigns.title,
  endDate: campaigns.endDate,
  startDate: campaigns.startDate,
  amountRaised: campaigns.amountRaised,
  fundraisingGoal: campaigns.fundraisingGoal,
  status: campaigns.status,
} as const;

/**
 * Campaign administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO INVARIANTS GOVERN THIS FILE.
 *
 * 1. `amountRaised`, `donorCount` and `beneficiariesReached` are NEVER written
 *    from a request payload. They are derived counters (decision A6), moved
 *    only inside the transaction that records a captured payment. The
 *    protection is structural: `writableFields()` is an allow-list and they
 *    are not on it, so there is no code path from a request body to those
 *    columns — not one that is checked and passes, one that does not exist.
 *
 * 2. Status changes go through `canTransitionCampaign`. A request naming any
 *    other transition is refused here, server-side, whatever the UI offered.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * CONCURRENCY, for Phase 5. When payment capture lands it must update the
 * counters as:
 *
 *     BEGIN;
 *     SELECT amount_raised FROM campaigns WHERE id = $1 FOR UPDATE;
 *     UPDATE campaigns SET amount_raised = amount_raised + $2 ... WHERE id = $1;
 *     COMMIT;
 *
 * — the increment expressed IN SQL, under a row lock taken in the same
 * transaction that writes the donation. Read-modify-write in application code
 * loses concurrent donations silently, and the ones it loses are real money.
 * Nothing in this service takes that lock, because nothing here changes those
 * columns.
 */
@Injectable()
export class CampaignsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly slugs: SlugService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: CampaignListQuery) {
    const filters: SQL[] = [isNull(campaigns.deletedAt)];

    if (query.status && query.status !== 'all') filters.push(eq(campaigns.status, query.status));
    if (query.categoryId) filters.push(eq(campaigns.categoryId, query.categoryId));
    if (query.programId) filters.push(eq(campaigns.programId, query.programId));
    if (query.state) filters.push(eq(campaigns.state, query.state));
    if (query.startsAfter) filters.push(sql`${campaigns.startDate} >= ${query.startsAfter}`);
    if (query.endsBefore) filters.push(sql`${campaigns.endDate} <= ${query.endsBefore}`);

    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(campaigns.title, term),
        ilike(campaigns.shortDescription, term),
        ilike(campaigns.slug, term),
        ilike(campaigns.location, term),
      );
      if (search) filters.push(search);
    }

    const where = and(...filters);
    const { column, direction } = resolveSort(query.sort, SORTABLE, 'updatedAt');

    const [rows, [count]] = await Promise.all([
      this.database.db
        .select({
          id: campaigns.id,
          title: campaigns.title,
          slug: campaigns.slug,
          shortDescription: campaigns.shortDescription,
          coverImage: campaigns.coverImage,
          status: campaigns.status,
          category: campaigns.category,
          categoryId: campaigns.categoryId,
          location: campaigns.location,
          state: campaigns.state,
          fundraisingGoal: campaigns.fundraisingGoal,
          amountRaised: campaigns.amountRaised,
          currency: campaigns.currency,
          donorCount: campaigns.donorCount,
          beneficiaryTarget: campaigns.beneficiaryTarget,
          beneficiariesReached: campaigns.beneficiariesReached,
          startDate: campaigns.startDate,
          endDate: campaigns.endDate,
          isFeatured: campaigns.isFeatured,
          featuredOrder: campaigns.featuredOrder,
          publishedAt: campaigns.publishedAt,
          createdAt: campaigns.createdAt,
          updatedAt: campaigns.updatedAt,
          programId: campaigns.programId,
          programTitle: programs.title,
          programSlug: programs.slug,
          // Raw SQL with an alias — see the note in categories.service.ts.
          productCount: sql<number>`(
            SELECT count(*)::int FROM campaign_products cp
            WHERE cp.campaign_id = campaigns.id AND cp.deleted_at IS NULL
          )`,
        })
        .from(campaigns)
        // Joined, not fetched per row: a list of twenty campaigns issuing
        // twenty programme lookups is the N+1 this join exists to avoid.
        .leftJoin(programs, eq(programs.id, campaigns.programId))
        .leftJoin(categories, eq(categories.id, campaigns.categoryId))
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
        .orderBy(direction === 'desc' ? desc(column) : asc(column), campaigns.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(where),
    ]);

    return paginate(
      rows.map((row) => this.withProgress(row)),
      query.page,
      query.limit,
      count?.value ?? 0,
    );
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select({
        campaign: campaigns,
        programTitle: programs.title,
        programSlug: programs.slug,
        categoryName: categories.name,
      })
      .from(campaigns)
      .leftJoin(programs, eq(programs.id, campaigns.programId))
      .leftJoin(categories, eq(categories.id, campaigns.categoryId))
      .where(and(eq(campaigns.id, id), isNull(campaigns.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Campaign');

    const slugHistory = await this.slugs.history('campaign', id);

    return {
      ...this.withProgress(row.campaign),
      programTitle: row.programTitle,
      programSlug: row.programSlug,
      categoryName: row.categoryName,
      slugHistory,
    };
  }

  /** Attach the single, shared progress calculation to a campaign row. */
  private withProgress<
    T extends {
      fundraisingGoal: number;
      amountRaised: number;
      endDate: Date | null;
      beneficiaryTarget?: number | null;
      beneficiariesReached?: number;
    },
  >(row: T) {
    return {
      ...row,
      progress: campaignProgress(row.fundraisingGoal, row.amountRaised),
      daysRemaining: daysRemaining(row.endDate),
    };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(input: CampaignWriteInput, actor: AuthenticatedActor, context: AuditContext) {
    await this.assertProgramExists(input.programId);
    const category = await this.categories.resolveForWrite(input.categoryId, 'campaign');
    const slug = await this.slugs.allocate('campaign', { title: input.title, slug: input.slug });

    this.assertDatesCoherent(input.startDate ?? null, input.endDate ?? null);

    const [created] = await this.database.db
      .insert(campaigns)
      .values({
        ...this.writableFields(input),
        title: input.title,
        slug,
        // Zero is permitted ONLY while the campaign is a draft — the database
        // check and `assertPublishable` both require a real goal before it can
        // become public. It lets an operator save a campaign before they know
        // the number.
        fundraisingGoal: input.fundraisingGoal ?? 0,
        categoryId: category?.id ?? null,
        category: category?.name ?? null,
        status: 'draft',
      })
      .returning({ id: campaigns.id });

    if (!created) throw new ConflictException('Could not create the campaign.');

    await this.audit.record({
      action: 'campaign.create',
      entityType: 'campaign',
      entityId: created.id,
      userId: actor.id,
      newValues: { title: input.title, slug, fundraisingGoal: input.fundraisingGoal ?? 0 },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: Partial<CampaignWriteInput>,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);

    if (input.programId !== undefined) await this.assertProgramExists(input.programId);

    const category =
      input.categoryId === undefined
        ? undefined
        : await this.categories.resolveForWrite(input.categoryId, 'campaign');

    this.assertDatesCoherent(
      input.startDate !== undefined ? input.startDate : before.startDate,
      input.endDate !== undefined ? input.endDate : before.endDate,
    );

    /**
     * Lowering a goal below what has already been raised is refused. It would
     * make the campaign instantly over-funded and the progress bar meaningless,
     * and it is almost always a typo rather than an intention.
     */
    if (input.fundraisingGoal !== undefined && input.fundraisingGoal < before.amountRaised) {
      throw new ValidationException(
        [
          {
            field: 'fundraisingGoal',
            code: 'below_raised',
            message: `The goal cannot be less than the ${(before.amountRaised / 100).toLocaleString('en-IN')} rupees already raised.`,
          },
        ],
        'That goal is lower than the amount already raised.',
      );
    }

    let slug = before.slug;
    if (input.slug !== undefined && input.slug !== before.slug) {
      slug = await this.slugs.allocate('campaign', {
        title: input.title ?? before.title,
        slug: input.slug,
        exceptId: id,
      });
    }

    await this.database.db.transaction(async (tx) => {
      if (slug !== before.slug) {
        await this.slugs.retire('campaign', id, before.slug, actor.id, tx);
      }

      await tx
        .update(campaigns)
        .set({
          ...this.writableFields(input),
          slug,
          ...(category === undefined
            ? {}
            : { categoryId: category?.id ?? null, category: category?.name ?? null }),
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, id));
    });

    // A change to the fundraising goal is called out separately in the audit
    // trail: it is the one edit that changes what the campaign is asking for.
    if (input.fundraisingGoal !== undefined && input.fundraisingGoal !== before.fundraisingGoal) {
      await this.audit.record({
        action: 'campaign.goal_changed',
        entityType: 'campaign',
        entityId: id,
        userId: actor.id,
        oldValues: { fundraisingGoal: before.fundraisingGoal },
        newValues: { fundraisingGoal: input.fundraisingGoal },
        severity: 'warning',
        ...context,
      });
    }

    await this.audit.record({
      action: 'campaign.update',
      entityType: 'campaign',
      entityId: id,
      userId: actor.id,
      oldValues: { title: before.title, slug: before.slug, status: before.status },
      newValues: { ...input, slug },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Move a campaign through its lifecycle.
   *
   * Every transition is validated against the shared table and written to the
   * audit log with the previous status, the new one, who did it and why — the
   * record the brief asks for, and the one an operator needs six months later
   * when somebody asks why a campaign stopped.
   */
  async setStatus(
    id: string,
    status: CampaignStatus,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    const from = before.status as CampaignStatus;

    if (!canTransitionCampaign(from, status)) {
      throw new ConflictException(`A campaign cannot go from ${from} to ${status}.`);
    }

    if (status === 'published' || status === 'active') {
      this.assertPublishable(before);
    }

    // Pausing and completing are the two an operator will be asked to justify.
    if ((status === 'paused' || status === 'completed') && !reason?.trim()) {
      throw new ValidationException(
        [{ field: 'reason', code: 'required', message: 'Give a reason for this change.' }],
        'A reason is required when pausing or completing a campaign.',
      );
    }

    await this.database.db
      .update(campaigns)
      .set({
        status,
        publishedAt:
          status === 'published' || status === 'active'
            ? (before.publishedAt ?? new Date())
            : before.publishedAt,
        pauseReason: status === 'paused' ? (reason ?? null) : null,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id));

    await this.audit.record({
      action: `campaign.${status}`,
      entityType: 'campaign',
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

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  private async assertProgramExists(programId: string | null | undefined): Promise<void> {
    if (!programId) return;

    const [row] = await this.database.db
      .select({ id: programs.id })
      .from(programs)
      .where(and(eq(programs.id, programId), isNull(programs.deletedAt)))
      .limit(1);

    if (!row) {
      throw new ValidationException([
        { field: 'programId', code: 'not_found', message: 'That programme does not exist.' },
      ]);
    }
  }

  private assertDatesCoherent(start: Date | null, end: Date | null): void {
    if (start && end && end.getTime() < start.getTime()) {
      throw new ValidationException([
        {
          field: 'endDate',
          code: 'before_start',
          message: 'The end date cannot be before the start date.',
        },
      ]);
    }
  }

  /** What a campaign must have before the public can see it. */
  private assertPublishable(campaign: {
    title: string;
    shortDescription: string | null;
    fundraisingGoal: number;
    programId: string | null;
  }) {
    const missing: { field: string; code: string; message: string }[] = [];

    if (!campaign.shortDescription?.trim()) {
      missing.push({
        field: 'shortDescription',
        code: 'required',
        message: 'A short description is required — it is what appears on every card.',
      });
    }

    // A public campaign asking for an unspecified amount has no progress bar
    // and no way for a donor to judge what their gift does.
    if (!campaign.fundraisingGoal || campaign.fundraisingGoal <= 0) {
      missing.push({
        field: 'fundraisingGoal',
        code: 'required',
        message: 'Set a fundraising goal above zero before publishing.',
      });
    }

    // Decision A5: a campaign funds a specific piece of a programme. One
    // without a programme cannot be attributed, reported on, or rolled up.
    if (!campaign.programId) {
      missing.push({
        field: 'programId',
        code: 'required',
        message: 'Attach this campaign to a programme before publishing.',
      });
    }

    if (missing.length > 0) {
      throw new ValidationException(missing, 'This campaign is not ready to publish.');
    }
  }

  /**
   * The fields a client may write.
   *
   * `amountRaised`, `donorCount`, `beneficiariesReached`, `status` and
   * `publishedAt` are absent BY CONSTRUCTION. See the invariants at the top of
   * this file — there is no path from a payload to those columns.
   */
  private writableFields(input: Partial<CampaignWriteInput>): Partial<CampaignWriteInput> {
    const allowed = [
      'title',
      'programId',
      'shortDescription',
      'description',
      'beneficiaryContext',
      'coverImage',
      'location',
      'state',
      'city',
      'startDate',
      'endDate',
      'fundraisingGoal',
      'beneficiaryTarget',
      'fundUtilization',
      'stopAtGoal',
      'allowCustomAmount',
      'minDonationAmount',
      'isFeatured',
      'featuredOrder',
      'impactNotes',
      'internalNotes',
      'metaTitle',
      'metaDescription',
    ] as const;

    const fields: Partial<CampaignWriteInput> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) {
        (fields as Record<string, unknown>)[key] = input[key];
      }
    }
    return fields;
  }
}
