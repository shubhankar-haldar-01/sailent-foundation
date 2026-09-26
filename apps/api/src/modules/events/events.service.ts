import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';

import {
  campaigns,
  eventRegistrations,
  events,
  programs,
  type DatabaseClient,
} from '@sailent/database';
import {
  canTransitionEventLifecycle,
  canTransitionEventPublish,
  registrationClosesAt,
  type EventLifecycle,
  type EventPublishStatus,
} from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { SlugService } from '../catalog/slug.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { QUEUE_NAMES, QueueService, jobKey } from '../queue/queue.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import type { CreateEventInput, EventListQuery, UpdateEventInput } from './dto/events.dto.js';

const SORTABLE = {
  startDate: events.startDate,
  title: events.title,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
  status: events.status,
  registeredCount: events.registeredCount,
} as const;

/**
 * Event administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * The public read path stays in `ContentService`, as it does for programmes
 * and campaigns. This service returns drafts, archived events and the private
 * joining link; a single service with an `includeUnpublished` flag is one
 * forgotten argument away from publishing a draft — and here it would also be
 * one forgotten argument away from publishing a meeting URL.
 *
 * REGISTRATIONS ARE NOT IN THIS FILE. They live in
 * `EventRegistrationsService`, because the rules there are about one person's
 * seat and are enforced under a row lock, and mixing them with content
 * editing would put a lock-holding transaction in the same class as a title
 * change.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class EventsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly slugs: SlugService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: EventListQuery) {
    const filters: SQL[] = [isNull(events.deletedAt)];

    if (query.status && query.status !== 'all') {
      filters.push(eq(events.status, query.status));
    }
    if (query.lifecycle) {
      filters.push(eq(events.registrationStatus, query.lifecycle));
    }
    if (query.when === 'past') {
      filters.push(sql`${events.startDate} < now()`);
    } else if (query.when === 'upcoming') {
      filters.push(sql`${events.startDate} >= now()`);
    }
    if (query.programId) filters.push(eq(events.programId, query.programId));
    if (query.campaignId) filters.push(eq(events.campaignId, query.campaignId));
    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(events.title, term),
        ilike(events.summary, term),
        ilike(events.slug, term),
        ilike(events.city, term),
      );
      if (search) filters.push(search);
    }

    const where = and(...filters);
    // Newest-first by date is wrong for an event list: the next one is the one
    // an organiser is working on. Ascending start date, so today is at the top.
    const { column, direction } = resolveSort(query.sort, SORTABLE, 'startDate');

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          id: events.id,
          title: events.title,
          slug: events.slug,
          summary: events.summary,
          coverImage: events.coverImage,
          startDate: events.startDate,
          endDate: events.endDate,
          venueName: events.venueName,
          city: events.city,
          isOnline: events.isOnline,
          capacity: events.capacity,
          registeredCount: events.registeredCount,
          registrationStatus: events.registrationStatus,
          registrationDeadline: events.registrationDeadline,
          organizer: events.organizer,
          status: events.status,
          publishedAt: events.publishedAt,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
          programTitle: programs.title,
          campaignTitle: campaigns.title,
          /**
           * Seats actually held, computed rather than read from
           * `registered_count`.
           *
           * The cached column is what registration enforces against, and an
           * admin list is where a drift would be noticed — so this shows the
           * truth beside it. They should always agree; if they ever do not,
           * this is the column that says so.
           *
           * Literal qualified SQL, not `${eventRegistrations.eventId}`: Drizzle
           * strips table qualifiers inside `sql` templates, and an interpolated
           * correlation silently compares the table to itself.
           */
          seatsHeld: sql<number>`(
            SELECT coalesce(sum(er.attendee_count), 0)::int
            FROM event_registrations er
            WHERE er.event_id = events.id
              AND er.status IN ('registered', 'confirmed', 'attended', 'no_show')
          )`,
        })
        .from(events)
        .leftJoin(programs, eq(programs.id, events.programId))
        .leftJoin(campaigns, eq(campaigns.id, events.campaignId))
        .where(where)
        // The id tiebreaker keeps pagination stable when several events share a
        // start time — seeded rows routinely do, and Postgres gives no defined
        // order among ties, so a row can otherwise appear on two pages or none.
        .orderBy(direction === 'desc' ? desc(column) : asc(column), events.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(events)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select({ event: events, programTitle: programs.title, campaignTitle: campaigns.title })
      .from(events)
      .leftJoin(programs, eq(programs.id, events.programId))
      .leftJoin(campaigns, eq(campaigns.id, events.campaignId))
      .where(and(eq(events.id, id), isNull(events.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Event');

    const [[counts], slugHistory] = await Promise.all([
      this.database.db
        .select({
          seatsHeld: sql<number>`coalesce(sum(${eventRegistrations.attendeeCount}) FILTER (
            WHERE ${eventRegistrations.status} IN ('registered', 'confirmed', 'attended', 'no_show')
          ), 0)::int`,
          registrations: sql<number>`count(*) FILTER (
            WHERE ${eventRegistrations.status} <> 'cancelled'
          )::int`,
          attended: sql<number>`count(*) FILTER (
            WHERE ${eventRegistrations.status} = 'attended'
          )::int`,
          cancelled: sql<number>`count(*) FILTER (
            WHERE ${eventRegistrations.status} = 'cancelled'
          )::int`,
        })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, id)),
      this.slugs.history('event', id),
    ]);

    return {
      ...row.event,
      programTitle: row.programTitle,
      campaignTitle: row.campaignTitle,
      counts: counts ?? { seatsHeld: 0, registrations: 0, attended: 0, cancelled: 0 },
      slugHistory,
    };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(input: CreateEventInput, actor: AuthenticatedActor, context: AuditContext) {
    await this.assertRelations(input.programId, input.campaignId);
    const slug = await this.slugs.allocate('event', { title: input.title, slug: input.slug });

    const [created] = await this.database.db
      .insert(events)
      .values({
        ...this.writableFields(input),
        title: input.title,
        slug,
        startDate: input.startDate,
        // Always a draft, and always with registration SHUT. An event that
        // starts taking sign-ups the moment it is saved gives nobody a chance
        // to read the date back before the public acts on it.
        status: 'draft',
        registrationStatus: 'closed',
      })
      .returning({ id: events.id });

    if (!created) throw new ConflictException('Could not create the event.');

    await this.audit.record({
      action: 'event.create',
      entityType: 'event',
      entityId: created.id,
      userId: actor.id,
      newValues: { title: input.title, slug, startDate: input.startDate.toISOString() },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: UpdateEventInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    await this.assertRelations(input.programId, input.campaignId);

    /**
     * Cross-field checks against the STORED row, not just the payload.
     *
     * The DTO can only compare fields that arrived together. Moving the start
     * date earlier than an existing deadline, or setting a deadline after an
     * existing start, are both single-field edits that are nevertheless wrong —
     * and they are only visible here, where the other half is known.
     */
    const startDate = input.startDate ?? before.startDate;
    const endDate = input.endDate === undefined ? before.endDate : input.endDate;
    const deadline =
      input.registrationDeadline === undefined
        ? before.registrationDeadline
        : input.registrationDeadline;

    const problems: { field: string; code: string; message: string }[] = [];
    if (endDate && endDate.getTime() < startDate.getTime()) {
      problems.push({
        field: 'endDate',
        code: 'out_of_range',
        message: 'The event would end before it starts.',
      });
    }
    if (deadline && deadline.getTime() > startDate.getTime()) {
      problems.push({
        field: 'registrationDeadline',
        code: 'out_of_range',
        message: 'Registration would close after the event has started.',
      });
    }
    if (
      input.capacity !== undefined &&
      input.capacity !== null &&
      input.capacity < before.counts.seatsHeld
    ) {
      problems.push({
        field: 'capacity',
        code: 'out_of_range',
        message: `${before.counts.seatsHeld} ${
          before.counts.seatsHeld === 1 ? 'place is' : 'places are'
        } already taken. Lowering the cap below that would leave the event over capacity.`,
      });
    }
    if (problems.length > 0) {
      throw new ValidationException(problems, 'This event cannot be saved as entered.');
    }

    let slug = before.slug;
    if (input.slug !== undefined && input.slug !== before.slug) {
      slug = await this.slugs.allocate('event', {
        title: input.title ?? before.title,
        slug: input.slug,
        exceptId: id,
      });
    }

    await this.database.db.transaction(async (tx) => {
      // The retirement is written INSIDE the same transaction as the rename, so
      // a committed slug change can never exist without its redirect.
      if (slug !== before.slug) {
        await this.slugs.retire('event', id, before.slug, actor.id, tx);
      }

      await tx
        .update(events)
        .set({ ...this.writableFields(input), slug, updatedAt: new Date() })
        .where(eq(events.id, id));
    });

    await this.audit.record({
      action: 'event.update',
      entityType: 'event',
      entityId: id,
      userId: actor.id,
      oldValues: {
        title: before.title,
        slug: before.slug,
        startDate: before.startDate.toISOString(),
        capacity: before.capacity,
      },
      newValues: { ...input, slug },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Publish, unpublish or archive.
   *
   * SEPARATE from `setLifecycle`, because they answer different questions and
   * conflating them is how a cancelled event ends up invisible to the people
   * holding a registration for it. See `@sailent/validation`'s `event.ts`.
   */
  async setPublishStatus(
    id: string,
    status: EventPublishStatus,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    const from = before.status as EventPublishStatus;

    if (from === status) return before;
    if (!canTransitionEventPublish(from, status)) {
      throw new ConflictException(`An event cannot go from ${from} to ${status}.`);
    }
    if (status === 'published') this.assertPublishable(before);

    /**
     * Archiving an event that still holds live registrations is refused.
     *
     * `archived` is a 404 to the public, so archiving here would take the page
     * away from everyone holding a place without telling any of them. Cancel it
     * first — that notifies them — and archive afterwards.
     */
    if (status === 'archived' && before.counts.registrations > 0) {
      const lifecycle = before.registrationStatus as EventLifecycle;
      if (lifecycle !== 'cancelled' && lifecycle !== 'completed') {
        throw new ConflictException(
          `${before.counts.registrations} ${
            before.counts.registrations === 1 ? 'person holds' : 'people hold'
          } a registration for this event. Cancel or complete it first — archiving would remove the page without telling them.`,
        );
      }
    }

    await this.database.db
      .update(events)
      .set({
        status,
        // Stamped on first publication and never overwritten: it is the date
        // the event became public, not the date it was last touched.
        publishedAt:
          status === 'published' ? (before.publishedAt ?? new Date()) : before.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id));

    await this.audit.record({
      action: `event.${status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish'}`,
      entityType: 'event',
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
   * Open, close, cancel or complete.
   *
   * Cancelling notifies every live registrant. That is the whole reason
   * cancellation is a state of its own rather than an archive.
   */
  async setLifecycle(
    id: string,
    lifecycle: EventLifecycle,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    const from = before.registrationStatus as EventLifecycle;

    if (from === lifecycle) return before;
    if (!canTransitionEventLifecycle(from, lifecycle)) {
      throw new ConflictException(
        from === 'completed'
          ? 'A completed event cannot be reopened.'
          : `An event cannot go from ${from} to ${lifecycle}.`,
      );
    }

    if (lifecycle === 'cancelled' && !reason?.trim()) {
      throw new ValidationException(
        [
          {
            field: 'reason',
            code: 'required',
            message: 'Give a reason — it is quoted to everyone who registered.',
          },
        ],
        'A cancellation needs a reason.',
      );
    }

    /**
     * Reopening is refused once registration could not succeed anyway.
     *
     * `open` means "a person may register now". If the deadline has passed,
     * setting it would produce a page whose button is enabled and whose every
     * submission is refused — which reads as a broken site, not a closed event.
     */
    if (lifecycle === 'open') {
      if (registrationClosesAt(before).getTime() <= Date.now()) {
        throw new ConflictException(
          'The registration deadline has already passed. Move the deadline before reopening.',
        );
      }
      if (before.capacity !== null && before.counts.seatsHeld >= before.capacity) {
        throw new ConflictException(
          'The event is at capacity. Raise the cap before reopening registration.',
        );
      }
    }

    await this.database.db
      .update(events)
      .set({ registrationStatus: lifecycle, updatedAt: new Date() })
      .where(eq(events.id, id));

    await this.audit.record({
      action: `event.${lifecycle}`,
      entityType: 'event',
      entityId: id,
      userId: actor.id,
      oldValues: { registrationStatus: from },
      newValues: { registrationStatus: lifecycle },
      reason,
      severity: lifecycle === 'cancelled' ? 'warning' : 'info',
      ...context,
    });

    if (lifecycle === 'cancelled') {
      await this.notifyCancellation(id, before.title, reason ?? '');
    }

    return this.getById(id);
  }

  /**
   * Tell everyone holding a place that the event is off.
   *
   * Enqueued AFTER the status is committed, never inside the transaction: a
   * job that runs before its transaction commits reads the old row, and a job
   * enqueued for a transaction that then rolls back tells a hundred people an
   * event is cancelled when it is not.
   *
   * The job id is the event id plus the cancelling minute, so a double-click
   * on the cancel button cannot send two waves of the same email, while a
   * genuine cancel → reinstate → cancel later in the day still sends.
   */
  private async notifyCancellation(eventId: string, title: string, reason: string) {
    const stamp = new Date().toISOString().slice(0, 16);
    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'event.cancelled',
      { eventId, title, reason },
      { jobId: jobKey('event-cancelled', eventId, stamp) },
    );
  }

  /**
   * A programme or campaign named on an event must exist.
   *
   * Both columns are `ON DELETE SET NULL` rather than `RESTRICT`, so a bad id
   * is not caught by the foreign key at insert time in any useful way — it is
   * caught, but as a 500 naming a constraint. This turns it into a field error.
   */
  private async assertRelations(programId?: string | null, campaignId?: string | null) {
    const problems: { field: string; code: string; message: string }[] = [];

    if (programId) {
      const [row] = await this.database.db
        .select({ id: programs.id })
        .from(programs)
        .where(and(eq(programs.id, programId), isNull(programs.deletedAt)))
        .limit(1);
      if (!row) {
        problems.push({
          field: 'programId',
          code: 'not_found',
          message: 'That programme does not exist.',
        });
      }
    }

    if (campaignId) {
      const [row] = await this.database.db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
        .limit(1);
      if (!row) {
        problems.push({
          field: 'campaignId',
          code: 'not_found',
          message: 'That campaign does not exist.',
        });
      }
    }

    if (problems.length > 0) {
      throw new ValidationException(problems, 'This event refers to something that is not there.');
    }
  }

  /**
   * What an event must have before it goes public.
   *
   * Checked at the transition rather than on every save, so a half-written
   * draft can still be saved — which is the entire purpose of a draft.
   */
  private assertPublishable(event: {
    title: string;
    summary: string | null;
    startDate: Date;
    isOnline: boolean;
    venueName: string | null;
    location: string | null;
    city: string | null;
    meetingUrl: string | null;
  }) {
    const missing: { field: string; code: string; message: string }[] = [];

    if (!event.summary?.trim()) {
      missing.push({
        field: 'summary',
        code: 'required',
        message: 'A summary is required — it is what appears on every card and in search results.',
      });
    }

    /**
     * SOMEWHERE TO GO.
     *
     * An event page that names a date and no place is the single most common
     * way an NGO event loses attendance, and it is entirely preventable here.
     * Online events need a joining link; physical ones need a venue or a city.
     */
    if (event.isOnline) {
      if (!event.meetingUrl?.trim()) {
        missing.push({
          field: 'meetingUrl',
          code: 'required',
          message: 'An online event needs a joining link. It is released to registrants only.',
        });
      }
    } else if (!event.venueName?.trim() && !event.location?.trim() && !event.city?.trim()) {
      missing.push({
        field: 'venueName',
        code: 'required',
        message: 'Give a venue, an address or at least a city.',
      });
    }

    if (missing.length > 0) {
      throw new ValidationException(missing, 'This event is not ready to publish.');
    }
  }

  /**
   * The fields a client may write.
   *
   * An explicit allow-list, not a spread of the request body. `status`,
   * `registrationStatus`, `registeredCount`, `waitlistCount` and `publishedAt`
   * are system-controlled, and the way they stay that way is by never being
   * copied from a payload — the DTO strips them, and this would refuse them
   * even if it did not.
   */
  private writableFields(input: Partial<CreateEventInput>) {
    const allowed = [
      'title',
      'summary',
      'description',
      'coverImage',
      'startDate',
      'endDate',
      'timezone',
      'venueName',
      'location',
      'address',
      'city',
      'state',
      'isOnline',
      'meetingUrl',
      'schedule',
      'gallery',
      'capacity',
      'registrationDeadline',
      'organizer',
      'programId',
      'campaignId',
      'requiresVolunteers',
      'volunteerSlots',
    ] as const;

    const output: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) output[key] = input[key];
    }
    return output;
  }

  /** Ids of the events a set of people are registered for — used by `/me/events`. */
  async idsWithLiveRegistrations(eventIds: string[]): Promise<string[]> {
    if (eventIds.length === 0) return [];
    const rows = await this.database.db
      .select({ id: events.id })
      .from(events)
      .where(and(inArray(events.id, eventIds), isNull(events.deletedAt)));
    return rows.map((row) => row.id);
  }
}
