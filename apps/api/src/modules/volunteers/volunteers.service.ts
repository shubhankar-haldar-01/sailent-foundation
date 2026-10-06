import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';

import { volunteerApplications, volunteers, type DatabaseClient } from '@sailent/database';
import {
  canTransitionVolunteer,
  isPendingReview,
  requiresVolunteerId,
  type VolunteerStatus,
  normaliseEmail,
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
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import { sequentialCode } from '../../common/utils/reference.js';
import type {
  ApplyAsVolunteerInput,
  ReviewDecisionInput,
  UpdateVolunteerInput,
  VolunteerListQuery,
} from './dto/volunteers.dto.js';

/** The same alias `receipts.service.ts` uses, for the same reason. */
type Tx = Parameters<Parameters<DatabaseClient['db']['transaction']>[0]>[0];

const SORTABLE = {
  createdAt: volunteers.createdAt,
  updatedAt: volunteers.updatedAt,
  firstName: volunteers.firstName,
  status: volunteers.status,
  verifiedHours: volunteers.verifiedHours,
} as const;

/**
 * Volunteer applications and the people they become.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO ROWS PER APPLICATION, AND THAT IS THE DESIGN.
 *
 * `volunteers` is the LIVING record — edited over years as a phone number
 * changes, availability shifts, skills accumulate. `volunteer_applications`
 * holds the submission FROZEN, so that "what did this person actually tell us
 * when they applied?" stays answerable after the profile has moved on. It is
 * the question that gets asked after something goes wrong, and it cannot be
 * reconstructed from an edited profile.
 *
 * Both are written in one transaction. An application with no volunteer row is
 * unreviewable; a volunteer row with no application has no provenance.
 * ══════════════════════════════════════════════════════════════════════════
 */
/**
 * Postgres `unique_violation`.
 *
 * The driver surfaces the SQLSTATE on `error.code`. Matching on the code
 * rather than on a message keeps this working when the message is localised,
 * and rather than on an index NAME so that adding a third unique index does
 * not silently stop being handled.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

@Injectable()
export class VolunteersService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  // -------------------------------------------------------------------------
  // Public: applying
  // -------------------------------------------------------------------------

  /**
   * Submit an application.
   *
   * UNAUTHENTICATED, because applying is how somebody first appears. The
   * protections are therefore the schema (bounded, `.strict()`), the rate
   * limiter on the route, and the duplicate check below.
   *
   * The response says as little as possible: an id and a status, never whether
   * the address or number was already known. Answering that would turn this
   * into an oracle for "has this person volunteered here?".
   */
  async apply(input: ApplyAsVolunteerInput, context: AuditContext) {
    const phone = input.phone.replace(/[^\d]/g, '').slice(-10);
    const email = normaliseEmail(input.email);

    /**
     * IDENTITY IS THE NUMBER *OR* THE ADDRESS, NOT THE NUMBER ALONE.
     *
     * ══════════════════════════════════════════════════════════════════════
     * This checked the phone number only, while `/me/volunteering` resolves a
     * volunteer by EMAIL. Applying twice with one address and two different
     * numbers passed both times, and the dashboard then returned whichever of
     * the two rows Postgres felt like — quite possibly the one with no VOL-
     * identifier and no hours, to somebody approved months earlier.
     *
     * Either key matching is a duplicate. `volunteers_phone_unique` and
     * `volunteers_email_live_unique` are the actual guarantees; this produces
     * a sentence where a raw constraint violation would produce a 500 naming
     * an index.
     *
     * `rejected` and `archived` rows are excluded from both, so somebody
     * turned down last year is not barred forever. The cooling period below is
     * what makes re-application a policy rather than an accident.
     *
     * The message deliberately does NOT say WHICH of the two matched. This
     * endpoint is unauthenticated, and naming the field turns it into a
     * cleaner oracle for "has this address applied here" than it needs to be.
     * It remains an oracle — anyone can vary one field at a time — and the
     * honest mitigation is the 3/hour throttle on the route, not silence:
     * quietly accepting a duplicate leaves somebody believing they applied and
     * waiting for an answer that will never come.
     * ══════════════════════════════════════════════════════════════════════
     */
    const livePhone = sql`regexp_replace(${volunteers.phone}, '[^0-9]', '', 'g') LIKE ${'%' + phone}`;
    const liveEmail = sql`lower(btrim(${volunteers.email})) = ${email}`;

    const [existing] = await this.database.db
      .select({ id: volunteers.id, status: volunteers.status })
      .from(volunteers)
      .where(
        and(or(livePhone, liveEmail), sql`${volunteers.status} NOT IN ('rejected', 'archived')`),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'We already have an application from you. If you think that is wrong, get in touch.',
      );
    }

    /**
     * Still inside a cooling period from an earlier rejection?
     *
     * Checked against the most recent application matching EITHER key, for the
     * same reason as above: a cooling period set on a rejection is trivially
     * escaped by re-applying with the same address and a different number.
     *
     * A rejection without a cooling period set can re-apply immediately, which
     * is the right default — the period is something an administrator chooses
     * when the rejection warrants it.
     */
    const [cooling] = await this.database.db
      .select({ until: volunteerApplications.coolingPeriodUntil })
      .from(volunteerApplications)
      .innerJoin(volunteers, eq(volunteers.id, volunteerApplications.volunteerId))
      .where(
        and(
          or(livePhone, liveEmail),
          sql`${volunteerApplications.coolingPeriodUntil} IS NOT NULL`,
          sql`${volunteerApplications.coolingPeriodUntil} > current_date`,
        ),
      )
      .orderBy(desc(volunteerApplications.submittedAt))
      .limit(1);

    if (cooling) {
      throw new ConflictException(
        'We are not able to consider a new application from you just yet. Please try again later.',
      );
    }

    /*
      THE CHECK ABOVE IS NOT ATOMIC, AND CANNOT BE.

      Two applications arriving together both pass the SELECT and both reach
      the INSERT; one loses on `volunteers_phone_unique` or
      `volunteers_email_live_unique`. That is the index doing its job — but it
      surfaces as a 500 quoting an index name at somebody filling in a form.

      So the race is caught and answered with the SAME sentence the check above
      produces. The applicant cannot tell whether they lost a race or applied
      twice, which is correct: from where they are standing those are the same
      event.
    */
    const created = await this.insertApplication(input, email);

    await this.audit.record({
      actorType: 'volunteer',
      action: 'volunteer.apply',
      entityType: 'volunteer',
      entityId: created.id,
      // No name, no email, no phone. The row itself holds those; repeating
      // them in a log with a longer retention period is a second copy of
      // somebody's contact details for no benefit.
      newValues: { status: 'applied' },
      ...context,
    });

    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'volunteer.application.received',
      { volunteerId: created.id },
      { jobId: jobKey('volunteer-applied', created.id) },
    );

    return { id: created.id, status: 'applied' as const };
  }

  /**
   * Insert the volunteer and the frozen application together.
   *
   * Separate from `apply()` only so the unique-index race has one place to be
   * caught. `23505` is Postgres's unique_violation; either of the two live
   * indexes can raise it, and both mean the same thing to the applicant.
   */
  private async insertApplication(input: ApplyAsVolunteerInput, email: string) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [volunteer] = await tx
          .insert(volunteers)
          .values({
            firstName: input.firstName,
            lastName: input.lastName ?? null,
            email,
            phone: input.phone.trim(),
            city: input.city ?? null,
            state: input.state ?? null,
            education: input.education ?? null,
            occupation: input.occupation ?? null,
            experience: input.experience ?? null,
            languages: input.languages ?? null,
            skills: input.skills ?? null,
            interests: input.interests ?? null,
            availability: input.availability ?? null,
            emergencyContactName: input.emergencyContactName ?? null,
            emergencyContactPhone: input.emergencyContactPhone ?? null,
            emergencyContactRelation: input.emergencyContactRelation ?? null,
            // No volunteerId. It is allocated at approval and the database
            // enforces that (decision A13).
            status: 'applied',
          })
          .returning({ id: volunteers.id });

        if (!volunteer) throw new ConflictException('Could not record the application.');

        await tx.insert(volunteerApplications).values({
          volunteerId: volunteer.id,
          // The submission, frozen. Nothing updates this column.
          formData: input,
          status: 'applied',
        });

        return volunteer;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'We already have an application from you. If you think that is wrong, get in touch.',
        );
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Admin: reading
  // -------------------------------------------------------------------------

  async list(query: VolunteerListQuery) {
    const filters: SQL[] = [];

    if (query.status === 'pending') {
      filters.push(sql`${volunteers.status} IN ('applied', 'under_review')`);
    } else if (query.status && query.status !== 'all') {
      filters.push(eq(volunteers.status, query.status));
    }

    if (query.skill) {
      // `skills` is a text[]; `= ANY` is the index-friendly membership test.
      filters.push(sql`${query.skill} = ANY(${volunteers.skills})`);
    }

    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(volunteers.firstName, term),
        ilike(volunteers.lastName, term),
        ilike(volunteers.email, term),
        ilike(volunteers.volunteerId, term),
      );
      if (search) filters.push(search);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const { column, direction } = resolveSort(query.sort, SORTABLE, 'createdAt');

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          id: volunteers.id,
          volunteerId: volunteers.volunteerId,
          firstName: volunteers.firstName,
          lastName: volunteers.lastName,
          email: volunteers.email,
          city: volunteers.city,
          skills: volunteers.skills,
          status: volunteers.status,
          totalHours: volunteers.totalHours,
          verifiedHours: volunteers.verifiedHours,
          assignmentCount: volunteers.assignmentCount,
          createdAt: volunteers.createdAt,
          approvedAt: volunteers.approvedAt,
          // Deliberately absent: phone, address, emergency contact,
          // internalNotes, statusReason. A list is for finding somebody, not
          // for bulk-reading everybody's contact details — those are on the
          // detail route, which is where an access decision can be made about
          // one person.
        })
        .from(volunteers)
        .where(where)
        // Id tiebreaker: applications arrive in bursts after an event and
        // routinely share a `created_at` to the microsecond.
        .orderBy(direction === 'desc' ? desc(column) : asc(column), volunteers.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(volunteers)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [volunteer] = await this.database.db
      .select()
      .from(volunteers)
      .where(eq(volunteers.id, id))
      .limit(1);

    if (!volunteer) throw new NotFoundException('Volunteer');

    const applications = await this.database.db
      .select()
      .from(volunteerApplications)
      .where(eq(volunteerApplications.volunteerId, id))
      .orderBy(desc(volunteerApplications.submittedAt));

    return { ...volunteer, applications };
  }

  // -------------------------------------------------------------------------
  // Admin: the decision
  // -------------------------------------------------------------------------

  /**
   * Move a volunteer through their lifecycle.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * APPROVAL ALLOCATES THE VOL- IDENTIFIER, INSIDE THIS TRANSACTION.
   *
   * The counter row is taken `FOR UPDATE`, so two administrators approving at
   * the same moment cannot draw the same number — the second blocks until the
   * first commits. A Postgres sequence would be simpler and wrong: it does not
   * roll back, so an approval that failed after drawing a number would leave a
   * permanent hole, and VOL-2026-00004 not existing is a question somebody
   * would eventually have to answer about a certificate.
   *
   * The identifier is allocated ONCE. A volunteer who is suspended and
   * reinstated keeps theirs; the check below is what stops a second one being
   * minted on the way back.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async decide(
    id: string,
    input: ReviewDecisionInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    const from = before.status as VolunteerStatus;
    const to = input.status as VolunteerStatus;

    if (from === to) return before;

    if (!canTransitionVolunteer(from, to)) {
      throw new ConflictException(
        from === 'rejected'
          ? 'A rejected application is final. The applicant may submit a new one.'
          : `A volunteer cannot go from ${from} to ${to}.`,
      );
    }

    if (to === 'rejected' && !input.reason?.trim()) {
      throw new ValidationException(
        [
          {
            field: 'reason',
            code: 'required',
            message:
              'Record why. It is not shown to the applicant, but a rejection with no stated reason cannot be reviewed later.',
          },
        ],
        'A rejection needs a reason.',
      );
    }

    const result = await this.database.db.transaction(async (tx) => {
      let volunteerCode = before.volunteerId;

      if (requiresVolunteerId(to) && !volunteerCode) {
        volunteerCode = await this.allocateVolunteerId(tx);
      }

      await tx
        .update(volunteers)
        .set({
          status: to,
          volunteerId: volunteerCode,
          statusReason: input.reason?.trim() || before.statusReason,
          // Stamped on FIRST approval and never overwritten: it is the date
          // the organisation accepted this person, not the date somebody last
          // changed their status.
          approvedAt: requiresVolunteerId(to)
            ? (before.approvedAt ?? new Date())
            : before.approvedAt,
          approvedBy: requiresVolunteerId(to) ? (before.approvedBy ?? actor.id) : before.approvedBy,
          joiningDate:
            to === 'active' && !before.joiningDate
              ? new Date().toISOString().slice(0, 10)
              : before.joiningDate,
          updatedAt: new Date(),
        })
        .where(eq(volunteers.id, id));

      // The application record carries the decision too, so the review history
      // survives later edits to the living profile.
      const cooling =
        to === 'rejected' && input.coolingPeriodDays
          ? new Date(Date.now() + input.coolingPeriodDays * 86_400_000).toISOString().slice(0, 10)
          : null;

      await tx
        .update(volunteerApplications)
        .set({
          status: to,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes?.trim() || null,
          rejectionReason: to === 'rejected' ? (input.reason?.trim() ?? null) : null,
          coolingPeriodUntil: cooling,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(volunteerApplications.volunteerId, id),
            sql`${volunteerApplications.status} IN ('applied', 'under_review')`,
          ),
        );

      return { volunteerCode };
    });

    await this.audit.record({
      action: `volunteer.${to}`,
      entityType: 'volunteer',
      entityId: id,
      userId: actor.id,
      oldValues: { status: from, volunteerId: before.volunteerId },
      newValues: { status: to, volunteerId: result.volunteerCode },
      reason: input.reason,
      // Approval, rejection and suspension all change what a person may do on
      // behalf of the organisation. None of them is routine.
      severity: 'warning',
      ...context,
    });

    if (to === 'approved' || to === 'active') {
      await this.queue.enqueue(
        QUEUE_NAMES.EMAIL,
        'volunteer.approved',
        { volunteerId: id },
        { jobId: jobKey('volunteer-approved', id) },
      );
    }

    if (to === 'rejected') {
      /*
        The applicant is told the outcome and NOT the reasoning. `input.reason`
        stays in the database and the audit log; the job carries only the id,
        so the processor cannot accidentally quote it.
      */
      await this.queue.enqueue(
        QUEUE_NAMES.EMAIL,
        'volunteer.rejected',
        { volunteerId: id },
        { jobId: jobKey('volunteer-rejected', id) },
      );
    }

    return this.getById(id);
  }

  /**
   * Draw the next VOL- number for this year.
   *
   * Runs INSIDE the caller's transaction — it takes the argument rather than
   * opening its own — so the number and the approval commit or roll back
   * together. Same mechanism as `receipts.service.ts`.
   */
  private async allocateVolunteerId(tx: Tx): Promise<string> {
    const year = new Date().getFullYear();

    /*
      Insert-or-lock in one statement. `ON CONFLICT DO UPDATE` with a no-op
      assignment returns the existing row AND takes a lock on it, which a bare
      `DO NOTHING` does not — that returns nothing and leaves the caller to
      race on a second SELECT.
    */
    const result = await tx.execute<{ next_value: number }>(sql`
      INSERT INTO volunteer_sequences (year, next_value)
           VALUES (${year}, 2)
      ON CONFLICT (year)
        DO UPDATE SET next_value = volunteer_sequences.next_value + 1,
                      updated_at = now()
        RETURNING next_value
    `);

    const next = result.rows?.[0]?.next_value;
    if (typeof next !== 'number') {
      throw new ConflictException('Could not allocate a volunteer identifier.');
    }

    return sequentialCode('VOL', year, next - 1);
  }

  // -------------------------------------------------------------------------
  // Admin: editing
  // -------------------------------------------------------------------------

  async update(
    id: string,
    input: UpdateVolunteerInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);

    await this.database.db
      .update(volunteers)
      .set({ ...this.writableFields(input), updatedAt: new Date() })
      .where(eq(volunteers.id, id));

    await this.audit.record({
      action: 'volunteer.update',
      entityType: 'volunteer',
      entityId: id,
      userId: actor.id,
      // Field NAMES, not values. An audit row recording that the phone number
      // changed is the useful fact; recording what it changed to puts the
      // number in a second place with a longer retention period.
      newValues: { fields: Object.keys(input) },
      oldValues: { status: before.status },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * The fields an ADMIN may write. `status`, `volunteerId`, the hours counters
   * and `approvedAt` are absent: those move only through `decide()` and the
   * attendance path, which is what keeps them trustworthy.
   */
  private writableFields(input: UpdateVolunteerInput) {
    const allowed = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'city',
      'state',
      'addressLine1',
      'postalCode',
      'education',
      'occupation',
      'experience',
      'languages',
      'skills',
      'interests',
      'emergencyContactName',
      'emergencyContactPhone',
      'emergencyContactRelation',
      'internalNotes',
    ] as const;

    const output: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) output[key] = input[key];
    }
    return output;
  }

  /** The review queue count, for the admin dashboard. */
  async pendingCount(): Promise<number> {
    const [row] = await this.database.db
      .select({ value: sql<number>`count(*)::int` })
      .from(volunteers)
      .where(sql`${volunteers.status} IN ('applied', 'under_review')`);
    return row?.value ?? 0;
  }

  /** Used by the ownership guard on every volunteer-facing route. */
  async findByEmail(email: string) {
    const [row] = await this.database.db
      .select({
        id: volunteers.id,
        status: volunteers.status,
        volunteerId: volunteers.volunteerId,
      })
      .from(volunteers)
      .where(sql`lower(btrim(${volunteers.email})) = ${normaliseEmail(email)}`)
      .limit(1);
    return row ?? null;
  }

  /** Exported so the review queue and the badge agree on what "pending" means. */
  static isPending = isPendingReview;
}
