import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import {
  donors,
  eventRegistrations,
  events,
  notifications,
  type DatabaseClient,
} from '@sailent/database';
import {
  ATTENDANCE_OUTCOMES,
  SEAT_HOLDING_STATUSES,
  registrationAvailability,
  type AttendeeStatus,
  type EventLifecycle,
  type EventPublishStatus,
} from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { QUEUE_NAMES, QueueService, jobKey } from '../queue/queue.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import { offsetFor, paginate } from '../../common/dto/pagination.dto.js';
import type {
  AttendanceInput,
  MyEventsQuery,
  RegisterForEventInput,
  RegistrationListQuery,
} from './dto/events.dto.js';

/**
 * Event registration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * CAPACITY IS ENFORCED UNDER A ROW LOCK. NOT BY READING A COUNTER FIRST.
 *
 * The failure this exists to prevent: capacity 100, 99 seats taken, two people
 * submit at the same instant. Both read 99, both find room, both insert, and
 * the event now has 101 registrations for 100 places. No amount of checking
 * before the write fixes that — the check and the write have to be one
 * indivisible step.
 *
 * So `register()` opens a transaction, takes `SELECT … FOR UPDATE` on the
 * event row, and does everything else while holding it. The second request
 * blocks on that lock until the first commits, then reads 100 and is refused.
 * The lock is on `events`, not on `event_registrations`, because the row being
 * protected is the one holding the count.
 *
 * The seat count is RECOMPUTED from the registration rows inside that lock
 * rather than trusted from `registered_count`. Same cost — one aggregate on an
 * indexed column — and it makes the cached counter self-correcting instead of
 * something that can drift silently and start admitting an extra person.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THREE OTHER GUARANTEES, and where each actually lives:
 *
 *   • No duplicate registrations — `event_registrations_unique` on
 *     (event_id, email). A database constraint, not a service check: the check
 *     would race exactly the way the capacity check does. The service check
 *     below exists only to produce a readable message on the ordinary path.
 *
 *   • No registration after the deadline, for a cancelled, completed,
 *     unpublished or archived event — `registrationAvailability()`, evaluated
 *     against the locked row.
 *
 *   • A donor may only ever touch their OWN registration. There is no
 *     `donorId` parameter in this file; ownership is a WHERE clause.
 */
@Injectable()
export class EventRegistrationsService {
  private readonly logger = new Logger(EventRegistrationsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  // -------------------------------------------------------------------------
  // Donor: register
  // -------------------------------------------------------------------------

  async register(
    eventId: string,
    donorId: string,
    input: RegisterForEventInput,
    context: AuditContext,
  ) {
    const [donor] = await this.database.db
      .select({
        id: donors.id,
        firstName: donors.firstName,
        lastName: donors.lastName,
        email: donors.email,
        phone: donors.phone,
      })
      .from(donors)
      .where(eq(donors.id, donorId))
      .limit(1);

    if (!donor) throw new NotFoundException('Account');

    /**
     * THE ADDRESS COMES FROM THE DONOR RECORD, NEVER FROM THE BODY.
     *
     * It is the unique key on `event_registrations`, so a client-supplied
     * address would let anyone register under somebody else's email and lock
     * the real owner out of the event. Normalised the same way the donor index
     * normalises it, so "Priya@…" and "priya@…" are one person here too.
     */
    const email = donor.email?.trim().toLowerCase();
    if (!email) {
      throw new ValidationException(
        [
          {
            field: 'email',
            code: 'required',
            message: 'Add an email address to your profile before registering for an event.',
          },
        ],
        'Your account has no email address on file.',
      );
    }

    const fullName =
      input.fullName?.trim() ||
      [donor.firstName, donor.lastName].filter(Boolean).join(' ').trim() ||
      'Guest';
    const phone = input.phone?.trim() || donor.phone;
    const attendeeCount = input.attendeeCount ?? 1;

    const outcome = await this.database.db.transaction(async (tx) => {
      // ─── THE LOCK ───────────────────────────────────────────────────────
      // Everything from here to the commit is serialised per event.
      const [event] = await tx
        .select({
          id: events.id,
          title: events.title,
          slug: events.slug,
          status: events.status,
          lifecycle: events.registrationStatus,
          startDate: events.startDate,
          registrationDeadline: events.registrationDeadline,
          capacity: events.capacity,
          deletedAt: events.deletedAt,
        })
        .from(events)
        .where(eq(events.id, eventId))
        .for('update')
        .limit(1);

      if (!event || event.deletedAt) throw new NotFoundException('Event');

      // The authoritative seat count, read inside the lock.
      const [held] = await tx
        .select({
          seats: sql<number>`coalesce(sum(${eventRegistrations.attendeeCount}), 0)::int`,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            inArray(eventRegistrations.status, SEAT_HOLDING_STATUSES),
          ),
        );

      const seatsHeld = held?.seats ?? 0;

      const availability = registrationAvailability({
        status: event.status as EventPublishStatus,
        lifecycle: event.lifecycle as EventLifecycle,
        startDate: event.startDate,
        registrationDeadline: event.registrationDeadline,
        capacity: event.capacity,
        registeredCount: seatsHeld,
        attendeeCount,
      });

      if (availability.state !== 'open') {
        // 404 for an event the public cannot see, so an unpublished event does
        // not confirm its own existence to someone probing ids.
        if (availability.state === 'unpublished') throw new NotFoundException('Event');
        throw new ConflictException(availability.reason);
      }

      /**
       * An existing row for this person.
       *
       * The unique index covers CANCELLED rows too, so somebody who cancels and
       * changes their mind would otherwise be permanently barred from an event
       * with free seats. That is the reinstatement path below — one row per
       * person per event, reused, which is also what keeps the index honest.
       */
      const [existing] = await tx
        .select({
          id: eventRegistrations.id,
          status: eventRegistrations.status,
          donorId: eventRegistrations.donorId,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            sql`lower(btrim(${eventRegistrations.email})) = ${email}`,
          ),
        )
        .limit(1);

      if (existing && existing.status !== 'cancelled') {
        throw new ConflictException('You are already registered for this event.');
      }

      const values = {
        eventId,
        donorId,
        fullName,
        email,
        phone,
        attendeeCount,
        status: 'registered' as const,
        registeredAt: new Date(),
        cancellationReason: null,
        updatedAt: new Date(),
      };

      let registrationId: string;
      if (existing) {
        await tx
          .update(eventRegistrations)
          .set(values)
          .where(eq(eventRegistrations.id, existing.id));
        registrationId = existing.id;
      } else {
        const [created] = await tx
          .insert(eventRegistrations)
          .values(values)
          .returning({ id: eventRegistrations.id });
        if (!created) throw new ConflictException('Could not record the registration.');
        registrationId = created.id;
      }

      const seatsAfter = seatsHeld + attendeeCount;
      const nowFull = event.capacity !== null && seatsAfter >= event.capacity;

      await tx
        .update(events)
        .set({
          registeredCount: seatsAfter,
          // `full` is set BY THE SERVER, from the count it just wrote — it is
          // not a button. An operator who wants registration shut uses
          // `closed`, and the two stay distinguishable, so a cancellation can
          // reopen a full event without reopening one somebody closed on
          // purpose.
          ...(nowFull ? { registrationStatus: 'full' as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId));

      return { registrationId, event, seatsAfter, reinstated: Boolean(existing) };
    });

    await this.audit.record({
      actorType: 'donor',
      action: outcome.reinstated ? 'event.registration.reinstate' : 'event.registration.create',
      entityType: 'event_registration',
      entityId: outcome.registrationId,
      // `actorType` says how to read this id: it is a `donors.id`, not a
      // `users.id`. The column carries no foreign key precisely so that both
      // kinds of actor can be recorded in one append-only log.
      userId: donorId,
      // The attendee's email is NOT written here. `redact()` would strip it,
      // and an audit row for a registration is about which event and how many
      // seats — the person is identified by the registration id.
      newValues: { eventId, attendeeCount, seatsAfter: outcome.seatsAfter },
      ...context,
    });

    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'event.registration.confirmed',
      { registrationId: outcome.registrationId },
      // One confirmation per registration per reinstatement cycle. A retried
      // request cannot send two; a genuine re-registration after cancelling
      // gets a fresh id suffix because `registeredAt` moved.
      { jobId: jobKey('event-registration', outcome.registrationId, outcome.seatsAfter) },
    );

    return this.myRegistration(eventId, donorId);
  }

  // -------------------------------------------------------------------------
  // Donor: read and cancel
  // -------------------------------------------------------------------------

  /**
   * The signed-in donor's registration for one event.
   *
   * Ownership is the WHERE clause, and a registration belonging to someone else
   * is NOT FOUND rather than forbidden — a 403 would confirm that a
   * registration exists for an event the caller has no business knowing about.
   */
  async myRegistration(eventId: string, donorId: string) {
    const [row] = await this.database.db
      .select({
        id: eventRegistrations.id,
        eventId: eventRegistrations.eventId,
        fullName: eventRegistrations.fullName,
        email: eventRegistrations.email,
        phone: eventRegistrations.phone,
        attendeeCount: eventRegistrations.attendeeCount,
        status: eventRegistrations.status,
        registeredAt: eventRegistrations.registeredAt,
        attendedAt: eventRegistrations.attendedAt,
        eventTitle: events.title,
        eventSlug: events.slug,
        startDate: events.startDate,
        endDate: events.endDate,
        venueName: events.venueName,
        city: events.city,
        isOnline: events.isOnline,
        lifecycle: events.registrationStatus,
        /**
         * THE JOINING LINK, RELEASED HERE AND ONLY HERE.
         *
         * `ContentService` strips it from every public payload. This endpoint
         * is reached with a donor session and returns the row that donor owns,
         * so it is the one place a link may legitimately come out — and only
         * while the registration is live. A cancelled registration gets null.
         */
        meetingUrl: sql<string | null>`CASE
          WHEN ${eventRegistrations.status} = 'cancelled' THEN NULL
          ELSE ${events.meetingUrl}
        END`,
      })
      .from(eventRegistrations)
      .innerJoin(events, eq(events.id, eventRegistrations.eventId))
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.donorId, donorId),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Registration');
    return row;
  }

  async myEvents(donorId: string, query: MyEventsQuery) {
    const filters: SQL[] = [eq(eventRegistrations.donorId, donorId), isNull(events.deletedAt)];

    if (query.when === 'past') {
      filters.push(sql`${events.startDate} < now()`);
    } else if (query.when === 'upcoming') {
      filters.push(sql`${events.startDate} >= now()`);
    }

    const where = and(...filters);
    const descending = query.when === 'past';

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          registrationId: eventRegistrations.id,
          status: eventRegistrations.status,
          attendeeCount: eventRegistrations.attendeeCount,
          registeredAt: eventRegistrations.registeredAt,
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
          lifecycle: events.registrationStatus,
          eventStatus: events.status,
        })
        .from(eventRegistrations)
        .innerJoin(events, eq(events.id, eventRegistrations.eventId))
        .where(where)
        // Id tiebreaker: several registrations can share a start time.
        .orderBy(descending ? desc(events.startDate) : asc(events.startDate), eventRegistrations.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(eventRegistrations)
        .innerJoin(events, eq(events.id, eventRegistrations.eventId))
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  /**
   * Cancel the signed-in donor's own registration.
   *
   * The freed seat is returned under the same lock registration takes, so a
   * cancellation and a registration racing for the last place cannot both
   * succeed against a stale count.
   */
  async cancelMine(
    eventId: string,
    donorId: string,
    reason: string | undefined,
    context: AuditContext,
  ) {
    const outcome = await this.database.db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          id: events.id,
          title: events.title,
          capacity: events.capacity,
          lifecycle: events.registrationStatus,
          deletedAt: events.deletedAt,
        })
        .from(events)
        .where(eq(events.id, eventId))
        .for('update')
        .limit(1);

      if (!event || event.deletedAt) throw new NotFoundException('Event');

      const [registration] = await tx
        .select({
          id: eventRegistrations.id,
          status: eventRegistrations.status,
          attendeeCount: eventRegistrations.attendeeCount,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            // OWNERSHIP IN THE QUERY. There is no id in the request that could
            // address somebody else's row.
            eq(eventRegistrations.donorId, donorId),
          ),
        )
        .limit(1);

      if (!registration) throw new NotFoundException('Registration');

      if (registration.status === 'cancelled') {
        throw new ConflictException('That registration is already cancelled.');
      }

      /**
       * Attendance, once recorded, is a fact about what happened.
       *
       * Letting someone cancel over it would replace "this person came" with
       * "this person withdrew", and those are different claims — one of which
       * the attendance register says is false.
       */
      if (registration.status === 'attended' || registration.status === 'no_show') {
        throw new ConflictException(
          'Attendance has already been recorded for this event, so the registration can no longer be cancelled.',
        );
      }

      await tx
        .update(eventRegistrations)
        .set({
          status: 'cancelled',
          cancellationReason: reason?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(eventRegistrations.id, registration.id));

      const [held] = await tx
        .select({
          seats: sql<number>`coalesce(sum(${eventRegistrations.attendeeCount}), 0)::int`,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            inArray(eventRegistrations.status, SEAT_HOLDING_STATUSES),
          ),
        );

      const seatsAfter = held?.seats ?? 0;
      const wasFull = event.lifecycle === 'full';
      const hasRoom = event.capacity === null || seatsAfter < event.capacity;

      await tx
        .update(events)
        .set({
          registeredCount: seatsAfter,
          // ONLY `full` reopens. An event an operator set to `closed`, or that
          // is `cancelled` or `completed`, stays where they put it — a freed
          // seat is not a reason to overrule a human decision.
          ...(wasFull && hasRoom ? { registrationStatus: 'open' as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId));

      return { registrationId: registration.id, seatsAfter };
    });

    await this.audit.record({
      actorType: 'donor',
      action: 'event.registration.cancel',
      entityType: 'event_registration',
      entityId: outcome.registrationId,
      userId: donorId,
      newValues: { eventId, seatsAfter: outcome.seatsAfter },
      reason,
      ...context,
    });

    return { cancelled: true, eventId, registrationId: outcome.registrationId };
  }

  // -------------------------------------------------------------------------
  // Staff: attendee list and attendance
  // -------------------------------------------------------------------------

  /**
   * The attendee list for one event.
   *
   * Behind `event.registration.read`, which is marked SENSITIVE in the
   * permission catalogue: this is the only place names, emails and phone
   * numbers of everyone attending come out together.
   */
  async listRegistrations(eventId: string, query: RegistrationListQuery) {
    const [event] = await this.database.db
      .select({ id: events.id, title: events.title, capacity: events.capacity })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundException('Event');

    const filters: SQL[] = [eq(eventRegistrations.eventId, eventId)];
    if (query.status && query.status !== 'all') {
      filters.push(eq(eventRegistrations.status, query.status));
    } else if (!query.status) {
      // The default list is who is COMING. Cancellations are still reachable
      // with `?status=cancelled`, but an organiser printing a register should
      // not have to filter them out by eye on the morning of the event.
      filters.push(sql`${eventRegistrations.status} <> 'cancelled'`);
    }

    const where = and(...filters);

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          id: eventRegistrations.id,
          fullName: eventRegistrations.fullName,
          email: eventRegistrations.email,
          phone: eventRegistrations.phone,
          attendeeCount: eventRegistrations.attendeeCount,
          status: eventRegistrations.status,
          registeredAt: eventRegistrations.registeredAt,
          attendedAt: eventRegistrations.attendedAt,
          cancellationReason: eventRegistrations.cancellationReason,
        })
        .from(eventRegistrations)
        .where(where)
        .orderBy(asc(eventRegistrations.fullName), eventRegistrations.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(eventRegistrations)
        .where(where),
    ]);

    return { event, ...paginate(items, query.page, query.limit, count?.value ?? 0) };
  }

  /**
   * Record who turned up.
   *
   * One transaction for the whole register. A half-applied attendance sheet is
   * worse than none: nobody can tell which half was marked, so the only safe
   * recovery is to do it all again — and doing it again over a partial write
   * is how people end up marked twice in the reporting.
   */
  async recordAttendance(
    eventId: string,
    input: AttendanceInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [event] = await this.database.db
      .select({ id: events.id, title: events.title, startDate: events.startDate })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundException('Event');

    /**
     * Attendance cannot be recorded before the event starts.
     *
     * Not pedantry: an attendance figure dated before the thing happened is
     * exactly the kind of number decision A14 exists to keep off the site, and
     * these rows feed the impact metrics.
     */
    if (event.startDate.getTime() > Date.now()) {
      throw new ConflictException('This event has not started yet.');
    }

    const ids = input.entries.map((entry) => entry.registrationId);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new ValidationException(
        [
          {
            field: 'entries',
            code: 'duplicate',
            message: 'The same attendee appears twice, with no way to tell which mark is meant.',
          },
        ],
        'Duplicate entries in the attendance sheet.',
      );
    }

    const marked = await this.database.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: eventRegistrations.id, status: eventRegistrations.status })
        .from(eventRegistrations)
        .where(and(eq(eventRegistrations.eventId, eventId), inArray(eventRegistrations.id, ids)));

      const known = new Map(rows.map((row) => [row.id, row.status as AttendeeStatus]));
      const unknown = ids.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw new ValidationException(
          unknown.map((id) => ({
            field: 'entries',
            code: 'not_found',
            message: `Registration ${id} is not on this event.`,
          })),
          'Some of those registrations are not on this event.',
        );
      }

      const cancelled = ids.filter((id) => known.get(id) === 'cancelled');
      if (cancelled.length > 0) {
        throw new ConflictException(
          `${cancelled.length} of those registrations ${
            cancelled.length === 1 ? 'was' : 'were'
          } cancelled. Someone who cancelled and came anyway should register again first.`,
        );
      }

      const now = new Date();
      for (const entry of input.entries) {
        await tx
          .update(eventRegistrations)
          .set({
            status: entry.status,
            // Stamped only for an attendance. A no-show has no time to record,
            // and clearing it means a correction from `attended` to `no_show`
            // does not leave a timestamp behind contradicting the status.
            attendedAt: entry.status === 'attended' ? now : null,
            updatedAt: now,
          })
          .where(eq(eventRegistrations.id, entry.registrationId));
      }

      return input.entries.length;
    });

    await this.audit.record({
      action: 'event.attendance',
      entityType: 'event',
      entityId: eventId,
      userId: actor.id,
      newValues: {
        marked,
        attended: input.entries.filter((entry) => entry.status === 'attended').length,
        noShow: input.entries.filter((entry) => entry.status === 'no_show').length,
      },
      severity: 'warning',
      ...context,
    });

    return this.listRegistrations(eventId, { page: 1, limit: 100, status: 'all' });
  }

  /**
   * Recompute `registered_count` from the registration rows.
   *
   * The counter is written inside every registration and cancellation, so it
   * should never be wrong. This exists because "should never" is not a
   * guarantee, and a drifted counter on an event with a cap would quietly
   * admit an extra person. Called by the admin recount endpoint.
   */
  async reconcile(eventId: string, actor: AuthenticatedActor, context: AuditContext) {
    const result = await this.database.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ id: events.id, registeredCount: events.registeredCount })
        .from(events)
        .where(eq(events.id, eventId))
        .for('update')
        .limit(1);

      if (!event) throw new NotFoundException('Event');

      const [held] = await tx
        .select({
          seats: sql<number>`coalesce(sum(${eventRegistrations.attendeeCount}), 0)::int`,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            inArray(eventRegistrations.status, SEAT_HOLDING_STATUSES),
          ),
        );

      const actual = held?.seats ?? 0;
      if (actual !== event.registeredCount) {
        await tx
          .update(events)
          .set({ registeredCount: actual, updatedAt: new Date() })
          .where(eq(events.id, eventId));
      }

      return { was: event.registeredCount, now: actual, drifted: actual !== event.registeredCount };
    });

    if (result.drifted) {
      this.logger.warn(
        { eventId, was: result.was, now: result.now },
        'Event registered_count had drifted and was corrected',
      );
      await this.audit.record({
        action: 'event.reconcile',
        entityType: 'event',
        entityId: eventId,
        userId: actor.id,
        oldValues: { registeredCount: result.was },
        newValues: { registeredCount: result.now },
        severity: 'warning',
        ...context,
      });
    }

    return result;
  }

  /** Written by the worker; read here so the donor dashboard can show them. */
  async notificationsFor(donorId: string, limit: number) {
    return this.database.db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientType, 'donor'),
          eq(notifications.recipientId, donorId),
          sql`${notifications.type} LIKE 'event.%'`,
        ),
      )
      .orderBy(desc(notifications.createdAt), notifications.id)
      .limit(limit);
  }
}

/** Re-exported so a caller can render the same two options the service accepts. */
export { ATTENDANCE_OUTCOMES };
