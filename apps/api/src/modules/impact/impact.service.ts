import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { campaigns, events, impactUpdates, programs, type DatabaseClient } from '@sailent/database';
import { canTransitionProgram, type ProgramStatus } from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { SlugService } from '../catalog/slug.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import type { CreateImpactInput, ImpactListQuery, UpdateImpactInput } from './dto/impact.dto.js';

const SORTABLE = {
  impactDate: impactUpdates.impactDate,
  title: impactUpdates.title,
  createdAt: impactUpdates.createdAt,
  updatedAt: impactUpdates.updatedAt,
  status: impactUpdates.status,
  metricValue: impactUpdates.metricValue,
} as const;

/**
 * Impact records.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THESE ROWS ARE THE EVIDENCE BEHIND EVERY NUMBER ON THE PUBLIC SITE THAT IS
 * NOT A LIVE DATABASE AGGREGATE (decision A14).
 *
 * Two rules follow, and both are enforced at the PUBLISH transition rather
 * than at save, so that a draft can be written before the count comes back
 * from the field:
 *
 *   1. A claimed figure needs a stated method. "1,240 children reached" with
 *      nothing saying how it was counted is the exact shape of the statistic
 *      the decision exists to keep off the site.
 *
 *   2. An impact record needs a parent — a campaign, a programme or an event.
 *      The database enforces this too (`impact_updates_has_parent`, widened by
 *      migration `0013`), because an unattributable figure is not a claim.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `verifiedBy` is stamped with the publisher's id at publication. It is not a
 * field anybody types into — the point of it is that it names the person who
 * put their name to the number, and a self-declared value would not.
 */
@Injectable()
export class ImpactService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly slugs: SlugService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: ImpactListQuery) {
    const filters: SQL[] = [];

    if (query.status && query.status !== 'all') {
      filters.push(eq(impactUpdates.status, query.status));
    }
    if (query.programId) filters.push(eq(impactUpdates.programId, query.programId));
    if (query.campaignId) filters.push(eq(impactUpdates.campaignId, query.campaignId));
    if (query.eventId) filters.push(eq(impactUpdates.eventId, query.eventId));
    if (query.metricType) filters.push(eq(impactUpdates.metricType, query.metricType));
    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(impactUpdates.title, term),
        ilike(impactUpdates.description, term),
        ilike(impactUpdates.location, term),
        ilike(impactUpdates.slug, term),
      );
      if (search) filters.push(search);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const { column, direction } = resolveSort(query.sort, SORTABLE, 'impactDate');

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          id: impactUpdates.id,
          title: impactUpdates.title,
          slug: impactUpdates.slug,
          coverImage: impactUpdates.coverImage,
          impactDate: impactUpdates.impactDate,
          location: impactUpdates.location,
          state: impactUpdates.state,
          metricType: impactUpdates.metricType,
          metricValue: impactUpdates.metricValue,
          metricUnit: impactUpdates.metricUnit,
          verificationMethod: impactUpdates.verificationMethod,
          status: impactUpdates.status,
          isPublic: impactUpdates.isPublic,
          publishedAt: impactUpdates.publishedAt,
          createdAt: impactUpdates.createdAt,
          campaignTitle: campaigns.title,
          programTitle: programs.title,
          eventTitle: events.title,
        })
        .from(impactUpdates)
        .leftJoin(campaigns, eq(campaigns.id, impactUpdates.campaignId))
        .leftJoin(programs, eq(programs.id, impactUpdates.programId))
        .leftJoin(events, eq(events.id, impactUpdates.eventId))
        .where(where)
        // Several updates routinely share one `impact_date` — a month-end
        // reporting run writes them all on the same day — so without the id
        // tiebreaker the paginated order is undefined and rows can repeat
        // across pages or be skipped entirely.
        .orderBy(direction === 'desc' ? desc(column) : asc(column), impactUpdates.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(impactUpdates)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select({
        update: impactUpdates,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        programTitle: programs.title,
        programSlug: programs.slug,
        eventTitle: events.title,
        eventSlug: events.slug,
      })
      .from(impactUpdates)
      .leftJoin(campaigns, eq(campaigns.id, impactUpdates.campaignId))
      .leftJoin(programs, eq(programs.id, impactUpdates.programId))
      .leftJoin(events, eq(events.id, impactUpdates.eventId))
      .where(eq(impactUpdates.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('Impact record');

    return {
      ...row.update,
      campaignTitle: row.campaignTitle,
      campaignSlug: row.campaignSlug,
      programTitle: row.programTitle,
      programSlug: row.programSlug,
      eventTitle: row.eventTitle,
      eventSlug: row.eventSlug,
      slugHistory: await this.slugs.history('impact', id),
    };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(input: CreateImpactInput, actor: AuthenticatedActor, context: AuditContext) {
    const parents = await this.resolveParents(input);
    const slug = await this.slugs.allocate('impact', { title: input.title, slug: input.slug });

    const [created] = await this.database.db
      .insert(impactUpdates)
      .values({
        ...this.writableFields(input),
        title: input.title,
        description: input.description,
        impactDate: input.impactDate,
        slug,
        campaignId: parents.campaignId,
        /**
         * A campaign's programme is INHERITED when no programme was named.
         *
         * It is how an update filed against a campaign also rolls up to the
         * programme without anybody having to remember. An explicitly supplied
         * programme wins — there are campaigns whose impact belongs somewhere
         * other than their own programme.
         */
        programId: parents.programId,
        eventId: parents.eventId,
        status: 'draft',
        isPublic: false,
      })
      .returning({ id: impactUpdates.id });

    if (!created) throw new ConflictException('Could not create the impact record.');

    await this.audit.record({
      action: 'impact.create',
      entityType: 'impact_update',
      entityId: created.id,
      userId: actor.id,
      newValues: {
        title: input.title,
        slug,
        impactDate: input.impactDate,
        metricType: input.metricType ?? null,
        metricValue: input.metricValue ?? null,
      },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: UpdateImpactInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);

    /**
     * The parent rule, checked against the MERGED record.
     *
     * A patch cannot be judged alone: sending `campaignId: null` is only wrong
     * if nothing else is holding the record up, and that is a question about
     * the stored row, not about the payload.
     */
    const merged = {
      campaignId: input.campaignId === undefined ? before.campaignId : input.campaignId,
      programId: input.programId === undefined ? before.programId : input.programId,
      eventId: input.eventId === undefined ? before.eventId : input.eventId,
    };

    if (!merged.campaignId && !merged.programId && !merged.eventId) {
      throw new ValidationException(
        [
          {
            field: 'campaignId',
            code: 'required',
            message:
              'Attach this to a campaign, a programme or an event — an unattributed figure is not a claim.',
          },
        ],
        'This impact record would be left unattributed.',
      );
    }

    const parents = await this.resolveParents(merged, { inheritProgramme: false });

    let slug = before.slug;
    if (input.slug !== undefined && input.slug !== before.slug) {
      slug = await this.slugs.allocate('impact', {
        title: input.title ?? before.title,
        slug: input.slug,
        exceptId: id,
      });
    }

    await this.database.db.transaction(async (tx) => {
      if (slug !== before.slug) {
        await this.slugs.retire('impact', id, before.slug, actor.id, tx);
      }

      await tx
        .update(impactUpdates)
        .set({
          ...this.writableFields(input),
          slug,
          campaignId: parents.campaignId,
          programId: parents.programId,
          eventId: parents.eventId,
          updatedAt: new Date(),
        })
        .where(eq(impactUpdates.id, id));
    });

    await this.audit.record({
      action: 'impact.update',
      entityType: 'impact_update',
      entityId: id,
      userId: actor.id,
      oldValues: {
        title: before.title,
        slug: before.slug,
        metricValue: before.metricValue,
        verificationMethod: before.verificationMethod,
      },
      newValues: { ...input, slug },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Publish, unpublish or archive.
   *
   * Reuses the programme transition table: three states, same rules. `status`
   * and `isPublic` move together, which is the contract
   * `ContentService.getImpact()` already reads.
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

    if (from === status) return before;
    if (!canTransitionProgram(from, status)) {
      throw new ConflictException(`An impact record cannot go from ${from} to ${status}.`);
    }
    if (status === 'published') this.assertPublishable(before);

    await this.database.db
      .update(impactUpdates)
      .set({
        status,
        isPublic: status === 'published',
        publishedAt:
          status === 'published' ? (before.publishedAt ?? new Date()) : before.publishedAt,
        /**
         * WHO PUT THEIR NAME TO THE NUMBER.
         *
         * Stamped from the authenticated actor, never from the payload — a
         * self-declared verifier verifies nothing. Kept when unpublishing: the
         * record of who published it in the first place does not become untrue
         * because the page came down.
         */
        verifiedBy: status === 'published' ? actor.id : before.verifiedBy,
        updatedAt: new Date(),
      })
      .where(eq(impactUpdates.id, id));

    await this.audit.record({
      action: `impact.${status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish'}`,
      entityType: 'impact_update',
      entityId: id,
      userId: actor.id,
      oldValues: { status: from },
      newValues: {
        status,
        metricType: before.metricType,
        metricValue: before.metricValue,
        verificationMethod: before.verificationMethod,
      },
      reason,
      severity: 'warning',
      ...context,
    });

    return this.getById(id);
  }

  /**
   * What a record needs before its figures go public.
   *
   * The verification rule is the whole of decision A14 in one condition: if
   * you are claiming a number, say how it was arrived at. A record with no
   * metric at all — a narrative update — is publishable without one, because
   * there is no figure to substantiate.
   */
  private assertPublishable(record: {
    description: string;
    metricValue: number | null;
    metricType: string | null;
    verificationMethod: string | null;
  }) {
    const missing: { field: string; code: string; message: string }[] = [];

    if (!record.description?.trim()) {
      missing.push({
        field: 'description',
        code: 'required',
        message: 'A description is required.',
      });
    }

    const claimsFigure = record.metricValue !== null || Boolean(record.metricType?.trim());
    if (claimsFigure && !record.verificationMethod?.trim()) {
      missing.push({
        field: 'verificationMethod',
        code: 'required',
        message:
          'Say how this figure was arrived at. A number nobody can check is a number that should not be published (decision A14).',
      });
    }

    if (missing.length > 0) {
      throw new ValidationException(missing, 'This impact record is not ready to publish.');
    }
  }

  /**
   * Check that the named parents exist, and inherit a campaign's programme.
   *
   * All three columns are `ON DELETE SET NULL`, so a bad id would be caught by
   * the foreign key only as a 500 naming a constraint. This turns it into a
   * field error.
   */
  private async resolveParents(
    input: { campaignId?: string | null; programId?: string | null; eventId?: string | null },
    options: { inheritProgramme?: boolean } = {},
  ) {
    const { inheritProgramme = true } = options;
    const problems: { field: string; code: string; message: string }[] = [];

    let campaignProgrammeId: string | null = null;

    if (input.campaignId) {
      const [row] = await this.database.db
        .select({ id: campaigns.id, programId: campaigns.programId })
        .from(campaigns)
        .where(and(eq(campaigns.id, input.campaignId), isNull(campaigns.deletedAt)))
        .limit(1);
      if (!row) {
        problems.push({
          field: 'campaignId',
          code: 'not_found',
          message: 'That campaign does not exist.',
        });
      } else {
        campaignProgrammeId = row.programId;
      }
    }

    if (input.programId) {
      const [row] = await this.database.db
        .select({ id: programs.id })
        .from(programs)
        .where(and(eq(programs.id, input.programId), isNull(programs.deletedAt)))
        .limit(1);
      if (!row) {
        problems.push({
          field: 'programId',
          code: 'not_found',
          message: 'That programme does not exist.',
        });
      }
    }

    if (input.eventId) {
      const [row] = await this.database.db
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.id, input.eventId), isNull(events.deletedAt)))
        .limit(1);
      if (!row) {
        problems.push({
          field: 'eventId',
          code: 'not_found',
          message: 'That event does not exist.',
        });
      }
    }

    if (problems.length > 0) {
      throw new ValidationException(
        problems,
        'This impact record refers to something that is not there.',
      );
    }

    return {
      campaignId: input.campaignId ?? null,
      programId:
        input.programId ?? (inheritProgramme ? (campaignProgrammeId ?? null) : null) ?? null,
      eventId: input.eventId ?? null,
    };
  }

  /**
   * The fields a client may write.
   *
   * `status`, `isPublic`, `publishedAt` and `verifiedBy` are all
   * system-controlled. `verifiedBy` especially: it is the name attached to a
   * published figure, and a payload that could set it would make the
   * attribution worthless.
   */
  private writableFields(input: Partial<CreateImpactInput>) {
    const allowed = [
      'title',
      'description',
      'coverImage',
      'images',
      'videos',
      'documents',
      'location',
      'state',
      'impactDate',
      'statistics',
      'metricType',
      'metricValue',
      'metricUnit',
      'verificationMethod',
    ] as const;

    const output: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) output[key] = input[key];
    }
    return output;
  }
}
