import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { campaigns, categories, programs, type DatabaseClient } from '@sailent/database';
import { canTransitionProgram, type ProgramStatus } from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { CategoriesService } from './categories.service.js';
import { SlugService } from './slug.service.js';
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

export interface ProgramWriteInput {
  title: string;
  slug?: string;
  tagline?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  problem?: string | null;
  approach?: string | null;
  beneficiaries?: string | null;
  impactSummary?: string | null;
  coverImage?: string | null;
  accentIcon?: string | null;
  categoryId?: string | null;
  goals?: { title: string; description: string }[] | null;
  activities?: { title: string; description: string }[] | null;
  metrics?: { label: string; value: number; unit?: string }[] | null;
  locations?: { district: string; state: string }[] | null;
  displayOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface ProgramListQuery extends PaginationQuery {
  status?: ProgramStatus | 'all';
  categoryId?: string;
}

const SORTABLE = {
  displayOrder: programs.displayOrder,
  title: programs.title,
  createdAt: programs.createdAt,
  updatedAt: programs.updatedAt,
  status: programs.status,
} as const;

/**
 * Programme administration.
 *
 * The public read path lives in `ContentService` and is deliberately separate:
 * this service returns drafts and archived records, and a single service with
 * an `includeUnpublished` flag is one forgotten argument away from publishing
 * a draft.
 */
@Injectable()
export class ProgramsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly slugs: SlugService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: ProgramListQuery) {
    const filters: SQL[] = [isNull(programs.deletedAt)];

    if (query.status && query.status !== 'all') {
      filters.push(eq(programs.status, query.status));
    }
    if (query.categoryId) {
      filters.push(eq(programs.categoryId, query.categoryId));
    }
    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(programs.title, term),
        ilike(programs.shortDescription, term),
        ilike(programs.slug, term),
      );
      if (search) filters.push(search);
    }

    const where = and(...filters);
    const { column, direction } = resolveSort(query.sort, SORTABLE, 'displayOrder');

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          id: programs.id,
          title: programs.title,
          slug: programs.slug,
          shortDescription: programs.shortDescription,
          coverImage: programs.coverImage,
          category: programs.category,
          categoryId: programs.categoryId,
          categoryName: categories.name,
          status: programs.status,
          displayOrder: programs.displayOrder,
          publishedAt: programs.publishedAt,
          createdAt: programs.createdAt,
          updatedAt: programs.updatedAt,
          /**
           * Campaign count, computed rather than read from the denormalised
           * `campaign_count` column — an admin list is where a drifted cache
           * would be noticed, so it shows the truth.
           */
          // Raw SQL with an alias — see the note in categories.service.ts for
          // why an interpolated correlation silently returns zero here.
          campaignCount: sql<number>`(
            SELECT count(*)::int FROM campaigns ca
            WHERE ca.program_id = programs.id AND ca.deleted_at IS NULL
          )`,
        })
        .from(programs)
        .leftJoin(categories, eq(categories.id, programs.categoryId))
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
        .orderBy(direction === 'desc' ? desc(column) : asc(column), programs.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(programs)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select({ program: programs, categoryName: categories.name })
      .from(programs)
      .leftJoin(categories, eq(categories.id, programs.categoryId))
      .where(and(eq(programs.id, id), isNull(programs.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Programme');

    const [related, slugHistory] = await Promise.all([
      this.database.db
        .select({
          id: campaigns.id,
          title: campaigns.title,
          slug: campaigns.slug,
          status: campaigns.status,
          fundraisingGoal: campaigns.fundraisingGoal,
          amountRaised: campaigns.amountRaised,
        })
        .from(campaigns)
        .where(and(eq(campaigns.programId, id), isNull(campaigns.deletedAt)))
        .orderBy(desc(campaigns.createdAt))
        .limit(50),
      this.slugs.history('program', id),
    ]);

    return { ...row.program, categoryName: row.categoryName, campaigns: related, slugHistory };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(input: ProgramWriteInput, actor: AuthenticatedActor, context: AuditContext) {
    const category = await this.categories.resolveForWrite(input.categoryId, 'program');
    const slug = await this.slugs.allocate('program', { title: input.title, slug: input.slug });

    const [created] = await this.database.db
      .insert(programs)
      .values({
        ...this.writableFields(input),
        title: input.title,
        slug,
        categoryId: category?.id ?? null,
        category: category?.name ?? null,
        // Always created as a draft. A record that goes live the instant it is
        // saved leaves no moment to read it back before the public does.
        status: 'draft',
      })
      .returning({ id: programs.id });

    if (!created) throw new ConflictException('Could not create the programme.');

    await this.audit.record({
      action: 'program.create',
      entityType: 'program',
      entityId: created.id,
      userId: actor.id,
      newValues: { title: input.title, slug, category: category?.name ?? null },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: Partial<ProgramWriteInput>,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);

    const category =
      input.categoryId === undefined
        ? undefined
        : await this.categories.resolveForWrite(input.categoryId, 'program');

    /**
     * A slug change retires the old one INSIDE the same transaction as the
     * update. Committing a rename without its redirect is precisely the silent
     * breakage the slug-history rule exists to prevent.
     */
    let slug = before.slug;
    if (input.slug !== undefined && input.slug !== before.slug) {
      slug = await this.slugs.allocate('program', {
        title: input.title ?? before.title,
        slug: input.slug,
        exceptId: id,
      });
    }

    await this.database.db.transaction(async (tx) => {
      if (slug !== before.slug) {
        await this.slugs.retire('program', id, before.slug, actor.id, tx);
      }

      await tx
        .update(programs)
        .set({
          ...this.writableFields(input),
          slug,
          ...(category === undefined
            ? {}
            : { categoryId: category?.id ?? null, category: category?.name ?? null }),
          updatedAt: new Date(),
        })
        .where(eq(programs.id, id));
    });

    await this.audit.record({
      action: 'program.update',
      entityType: 'program',
      entityId: id,
      userId: actor.id,
      oldValues: { title: before.title, slug: before.slug, category: before.category },
      newValues: { ...input, slug },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Move a programme through its lifecycle.
   *
   * The transition table is checked HERE, server-side, on every call. The admin
   * UI reads the same table to decide which buttons to show, but that is a
   * convenience — a request naming any other transition is refused.
   */
  async setStatus(
    id: string,
    status: ProgramStatus,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    const from = before.status as ProgramStatus;

    if (!canTransitionProgram(from, status)) {
      throw new ConflictException(`A programme cannot go from ${from} to ${status}.`);
    }

    if (status === 'published') {
      this.assertPublishable(before);
    }

    await this.database.db
      .update(programs)
      .set({
        status,
        // Stamped on first publication and never overwritten: it is the date
        // the programme became public, not the date it was last touched.
        publishedAt:
          status === 'published' ? (before.publishedAt ?? new Date()) : before.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(programs.id, id));

    await this.audit.record({
      action: `program.${status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish'}`,
      entityType: 'program',
      entityId: id,
      userId: actor.id,
      oldValues: { status: from },
      newValues: { status },
      reason,
      severity: 'warning',
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Reorder programmes in one transaction.
   *
   * All-or-nothing on purpose: a partially applied reorder leaves two
   * programmes claiming the same position, and the listing order then depends
   * on which row the planner happens to return first.
   */
  async reorder(
    order: { id: string; displayOrder: number }[],
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    await this.database.db.transaction(async (tx) => {
      for (const entry of order) {
        await tx
          .update(programs)
          .set({ displayOrder: entry.displayOrder, updatedAt: new Date() })
          .where(eq(programs.id, entry.id));
      }
    });

    await this.audit.record({
      action: 'program.reorder',
      entityType: 'program',
      userId: actor.id,
      newValues: { order },
      ...context,
    });

    return this.list({ page: 1, limit: 100, status: 'all' });
  }

  /**
   * What a programme must have before it can be published.
   *
   * Checked at the transition rather than on every save, so a half-written
   * draft can still be saved — which is the entire purpose of a draft.
   */
  private assertPublishable(program: { title: string; shortDescription: string | null }) {
    const missing: { field: string; code: string; message: string }[] = [];

    if (!program.title?.trim()) {
      missing.push({ field: 'title', code: 'required', message: 'A title is required.' });
    }
    if (!program.shortDescription?.trim()) {
      missing.push({
        field: 'shortDescription',
        code: 'required',
        message:
          'A short description is required — it is what appears on every card and in search results.',
      });
    }

    if (missing.length > 0) {
      throw new ValidationException(missing, 'This programme is not ready to publish.');
    }
  }

  /**
   * The fields a client may write.
   *
   * An explicit allow-list, not a spread of the request body: `status`,
   * `publishedAt`, `campaignCount` and `totalRaised` are all system-controlled,
   * and the way they stay that way is by never being copied from a payload.
   */
  private writableFields(input: Partial<ProgramWriteInput>): Partial<ProgramWriteInput> {
    const allowed = [
      'title',
      'tagline',
      'shortDescription',
      'description',
      'problem',
      'approach',
      'beneficiaries',
      'impactSummary',
      'coverImage',
      'accentIcon',
      'goals',
      'activities',
      'metrics',
      'locations',
      'displayOrder',
      'metaTitle',
      'metaDescription',
    ] as const;

    const fields: Partial<ProgramWriteInput> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) {
        (fields as Record<string, unknown>)[key] = input[key];
      }
    }
    return fields;
  }
}

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}
