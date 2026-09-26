import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import {
  volunteerAssignments,
  volunteerAttendance,
  volunteers,
  type DatabaseClient,
} from '@sailent/database';
import {
  acceptsAttendance,
  canBeAssigned,
  canTransitionAssignment,
  minutesToHours,
  type VolunteerAssignmentStatus,
  type VolunteerStatus,
} from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { QUEUE_NAMES, QueueService, jobKey } from '../queue/queue.service.js';
import { ConflictException, NotFoundException } from '../../common/exceptions.js';
import type { CreateAssignmentInput, RecordAttendanceInput } from './dto/volunteers.dto.js';

type Tx = Parameters<Parameters<DatabaseClient['db']['transaction']>[0]>[0];

/**
 * Assignments, attendance, and the hours that come out of them.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ATTENDANCE IS THE ONLY SOURCE OF HOURS. THERE IS NO SECOND ONE.
 *
 * The obvious design is a `volunteer_hours` table aggregating periods, and the
 * Phase 0 schema specified exactly that. It was left out on purpose: the
 * numbers it would hold are the same numbers the attendance rows already hold,
 * and two places to read "how many hours has she done" is one place to read a
 * stale answer from. These hours end up printed on a certificate that somebody
 * shows an employer, so a drifting second copy is not a cosmetic problem.
 *
 * `volunteers.total_hours` and `volunteers.verified_hours` are a CACHE, and
 * they are recomputed from the attendance rows — not incremented — inside the
 * same transaction as every write that could change them. A cache that is
 * rebuilt from the truth cannot drift; one that is adjusted by deltas drifts
 * the first time a delta is applied twice.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class VolunteerWorkService {
  private readonly logger = new Logger(VolunteerWorkService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  // -------------------------------------------------------------------------
  // Assignments
  // -------------------------------------------------------------------------

  async listAssignments(volunteerId: string) {
    return this.database.db
      .select()
      .from(volunteerAssignments)
      .where(eq(volunteerAssignments.volunteerId, volunteerId))
      .orderBy(desc(volunteerAssignments.startsAt), volunteerAssignments.id);
  }

  /**
   * Put a volunteer to work.
   *
   * ONLY AN ACTIVE VOLUNTEER. An approved-but-not-yet-inducted person has not
   * been briefed, a suspended one is suspended, and an inactive one has
   * stepped back — assigning any of them puts somebody in the field who should
   * not be there, and the assignment screen is exactly where that mistake
   * would be made under time pressure.
   */
  async createAssignment(
    volunteerId: string,
    input: CreateAssignmentInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [volunteer] = await this.database.db
      .select({ id: volunteers.id, status: volunteers.status })
      .from(volunteers)
      .where(eq(volunteers.id, volunteerId))
      .limit(1);

    if (!volunteer) throw new NotFoundException('Volunteer');

    if (!canBeAssigned(volunteer.status as VolunteerStatus)) {
      throw new ConflictException(
        `This volunteer is ${volunteer.status}. Only an active volunteer can be given work.`,
      );
    }

    const created = await this.database.db.transaction(async (tx) => {
      const [assignment] = await tx
        .insert(volunteerAssignments)
        .values({
          volunteerId,
          role: input.role,
          description: input.description ?? null,
          assignableType: input.assignableType ?? 'general',
          assignableId: input.assignableId ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          location: input.location ?? null,
          expectedHours: input.expectedHours ?? null,
          notes: input.notes ?? null,
          assignedBy: actor.id,
          status: 'assigned',
        })
        .returning({ id: volunteerAssignments.id });

      if (!assignment) throw new ConflictException('Could not create the assignment.');

      await this.recountAssignments(tx, volunteerId);
      return assignment;
    });

    await this.audit.record({
      action: 'volunteer.assign',
      entityType: 'volunteer_assignment',
      entityId: created.id,
      userId: actor.id,
      newValues: { volunteerId, role: input.role, startsAt: input.startsAt.toISOString() },
      ...context,
    });

    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'volunteer.assigned',
      { assignmentId: created.id },
      { jobId: jobKey('volunteer-assigned', created.id) },
    );

    return this.getAssignment(created.id);
  }

  async getAssignment(assignmentId: string) {
    const [row] = await this.database.db
      .select()
      .from(volunteerAssignments)
      .where(eq(volunteerAssignments.id, assignmentId))
      .limit(1);

    if (!row) throw new NotFoundException('Assignment');
    return row;
  }

  async setAssignmentStatus(
    assignmentId: string,
    status: VolunteerAssignmentStatus,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getAssignment(assignmentId);
    const from = before.status as VolunteerAssignmentStatus;

    if (from === status) return before;
    if (!canTransitionAssignment(from, status)) {
      throw new ConflictException(`An assignment cannot go from ${from} to ${status}.`);
    }

    await this.database.db
      .update(volunteerAssignments)
      .set({ status, notes: reason?.trim() || before.notes, updatedAt: new Date() })
      .where(eq(volunteerAssignments.id, assignmentId));

    await this.audit.record({
      action: `volunteer.assignment.${status}`,
      entityType: 'volunteer_assignment',
      entityId: assignmentId,
      userId: actor.id,
      oldValues: { status: from },
      newValues: { status },
      reason,
      ...context,
    });

    return this.getAssignment(assignmentId);
  }

  // -------------------------------------------------------------------------
  // Attendance
  // -------------------------------------------------------------------------

  async listAttendance(volunteerId: string) {
    return this.database.db
      .select()
      .from(volunteerAttendance)
      .where(eq(volunteerAttendance.volunteerId, volunteerId))
      .orderBy(desc(volunteerAttendance.date), volunteerAttendance.id);
  }

  /**
   * Record what was actually worked.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * STAFF ONLY. A volunteer has no route that reaches this method.
   *
   * Certificates count verified hours, and a certificate is a document a
   * future employer may rely on. Somebody able to record their own attendance
   * could print themselves any figure they liked, and the organisation would
   * have signed it.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * Upserts on `(assignment_id, date)`, which the unique index enforces. A
   * register submitted twice from a phone at a venue is the ordinary case, not
   * the exotic one — the second submission corrects the first rather than
   * doubling the hours.
   */
  async recordAttendance(
    assignmentId: string,
    input: RecordAttendanceInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const assignment = await this.getAssignment(assignmentId);

    if (!acceptsAttendance(assignment.status as VolunteerAssignmentStatus)) {
      throw new ConflictException(
        `This assignment is ${assignment.status}. Attendance cannot be recorded against it.`,
      );
    }

    const result = await this.database.db.transaction(async (tx) => {
      const verifying = input.verified === true;

      const [row] = await tx
        .insert(volunteerAttendance)
        .values({
          assignmentId,
          volunteerId: assignment.volunteerId,
          date: input.date,
          durationMinutes: input.durationMinutes,
          checkInAt: input.checkInAt ?? null,
          checkOutAt: input.checkOutAt ?? null,
          notes: input.notes ?? null,
          recordedBy: actor.id,
          verifiedBy: verifying ? actor.id : null,
          verifiedAt: verifying ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: [volunteerAttendance.assignmentId, volunteerAttendance.date],
          set: {
            durationMinutes: input.durationMinutes,
            checkInAt: input.checkInAt ?? null,
            checkOutAt: input.checkOutAt ?? null,
            notes: input.notes ?? null,
            recordedBy: actor.id,
            /*
              A correction CLEARS the verification unless it is being verified
              again in the same breath. Somebody verified the old figure, not
              this one — carrying the old approval forward onto a changed
              number would make verification meaningless.
            */
            verifiedBy: verifying ? actor.id : null,
            verifiedAt: verifying ? new Date() : null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: volunteerAttendance.id });

      if (!row) throw new ConflictException('Could not record the attendance.');

      // In the SAME transaction. The counters and the rows they summarise
      // cannot be observed disagreeing.
      const hours = await this.recomputeHours(tx, assignment.volunteerId);
      return { id: row.id, ...hours };
    });

    await this.audit.record({
      action: 'volunteer.attendance',
      entityType: 'volunteer_attendance',
      entityId: result.id,
      userId: actor.id,
      newValues: {
        assignmentId,
        date: input.date,
        durationMinutes: input.durationMinutes,
        verified: input.verified === true,
        verifiedHoursAfter: result.verifiedHours,
      },
      severity: 'warning',
      ...context,
    });

    return result;
  }

  /**
   * Verify, or withdraw verification from, a set of attendance rows.
   *
   * A separate act from recording. "This happened" and "I stand behind it" are
   * different statements, and only the second one reaches a certificate.
   */
  async setAttendanceVerified(
    volunteerId: string,
    attendanceIds: string[],
    verified: boolean,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const result = await this.database.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: volunteerAttendance.id })
        .from(volunteerAttendance)
        .where(
          and(
            eq(volunteerAttendance.volunteerId, volunteerId),
            inArray(volunteerAttendance.id, attendanceIds),
          ),
        );

      if (rows.length !== attendanceIds.length) {
        // Scoped to the volunteer in the WHERE clause, so an id belonging to
        // somebody else simply does not come back. Refusing the whole batch is
        // the safe response: a partial verification nobody asked for is worse
        // than none.
        throw new ConflictException(
          'Some of those attendance records do not belong to this volunteer.',
        );
      }

      await tx
        .update(volunteerAttendance)
        .set({
          verifiedBy: verified ? actor.id : null,
          verifiedAt: verified ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(inArray(volunteerAttendance.id, attendanceIds));

      const hours = await this.recomputeHours(tx, volunteerId);
      return { count: rows.length, ...hours };
    });

    await this.audit.record({
      action: verified ? 'volunteer.attendance.verify' : 'volunteer.attendance.unverify',
      entityType: 'volunteer',
      entityId: volunteerId,
      userId: actor.id,
      newValues: { count: result.count, verifiedHoursAfter: result.verifiedHours },
      severity: 'warning',
      ...context,
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // The counters
  // -------------------------------------------------------------------------

  /**
   * Rebuild `total_hours` and `verified_hours` from the attendance rows.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * RECOMPUTED, NOT INCREMENTED, and that is the whole reason this is safe.
   *
   * An increment has to be applied exactly once. A retried request, a
   * correction that adjusts a figure already counted, a row deleted by a
   * cascade — each of those makes a delta wrong, and nothing detects it: the
   * counter simply drifts, quietly, for months, and then prints a wrong number
   * on a certificate.
   *
   * Summing the rows costs one aggregate on an indexed column and cannot drift
   * however many times it runs. Always call it INSIDE the transaction that
   * changed the attendance.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * Minutes are summed and converted once, at the end. Converting per row and
   * summing hours would round 3 × 50 minutes down to 0 instead of 2.
   */
  private async recomputeHours(
    tx: Tx,
    volunteerId: string,
  ): Promise<{ totalHours: number; verifiedHours: number }> {
    const [totals] = await tx
      .select({
        totalMinutes: sql<number>`coalesce(sum(${volunteerAttendance.durationMinutes}), 0)::int`,
        verifiedMinutes: sql<number>`coalesce(sum(${volunteerAttendance.durationMinutes}) FILTER (
          WHERE ${volunteerAttendance.verifiedAt} IS NOT NULL
        ), 0)::int`,
      })
      .from(volunteerAttendance)
      .where(eq(volunteerAttendance.volunteerId, volunteerId));

    const totalHours = minutesToHours(totals?.totalMinutes ?? 0);
    const verifiedHours = minutesToHours(totals?.verifiedMinutes ?? 0);

    await tx
      .update(volunteers)
      .set({ totalHours, verifiedHours, updatedAt: new Date() })
      .where(eq(volunteers.id, volunteerId));

    return { totalHours, verifiedHours };
  }

  /** The same treatment for the assignment counter. */
  private async recountAssignments(tx: Tx, volunteerId: string): Promise<void> {
    const [row] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(volunteerAssignments)
      .where(
        and(
          eq(volunteerAssignments.volunteerId, volunteerId),
          sql`${volunteerAssignments.status} <> 'cancelled'`,
        ),
      );

    await tx
      .update(volunteers)
      .set({ assignmentCount: row?.value ?? 0, updatedAt: new Date() })
      .where(eq(volunteers.id, volunteerId));
  }

  /**
   * Verified minutes in a date range — what a certificate is issued against.
   *
   * Public so the certificate service can ask without duplicating the filter.
   * Verified only: an unverified record is a claim nobody has checked.
   */
  async verifiedMinutesInPeriod(
    volunteerId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<number> {
    const [row] = await this.database.db
      .select({
        minutes: sql<number>`coalesce(sum(${volunteerAttendance.durationMinutes}), 0)::int`,
      })
      .from(volunteerAttendance)
      .where(
        and(
          eq(volunteerAttendance.volunteerId, volunteerId),
          sql`${volunteerAttendance.verifiedAt} IS NOT NULL`,
          sql`${volunteerAttendance.date} >= ${periodStart}`,
          sql`${volunteerAttendance.date} <= ${periodEnd}`,
        ),
      );

    return row?.minutes ?? 0;
  }

  /**
   * Rebuild the counters on demand.
   *
   * They are recomputed inside every write that touches attendance, so this
   * should always be a no-op. It exists because "should always" is not a
   * guarantee — a restore, or a row removed by a cascade, gets here — and a
   * wrong `verified_hours` is a wrong number on a certificate.
   */
  async reconcile(volunteerId: string, actor: AuthenticatedActor, context: AuditContext) {
    const [before] = await this.database.db
      .select({ total: volunteers.totalHours, verified: volunteers.verifiedHours })
      .from(volunteers)
      .where(eq(volunteers.id, volunteerId))
      .limit(1);

    if (!before) throw new NotFoundException('Volunteer');

    const after = await this.database.db.transaction(async (tx) => {
      await this.recountAssignments(tx, volunteerId);
      return this.recomputeHours(tx, volunteerId);
    });

    const drifted = before.total !== after.totalHours || before.verified !== after.verifiedHours;

    if (drifted) {
      this.logger.warn(
        { volunteerId, before, after },
        'Volunteer hour counters had drifted and were corrected',
      );
      await this.audit.record({
        action: 'volunteer.reconcile',
        entityType: 'volunteer',
        entityId: volunteerId,
        userId: actor.id,
        oldValues: { totalHours: before.total, verifiedHours: before.verified },
        newValues: after,
        severity: 'warning',
        ...context,
      });
    }

    return { ...after, drifted, was: before };
  }

  /** A volunteer's own upcoming work, ordered soonest first. */
  async upcomingFor(volunteerId: string) {
    return this.database.db
      .select()
      .from(volunteerAssignments)
      .where(
        and(
          eq(volunteerAssignments.volunteerId, volunteerId),
          sql`${volunteerAssignments.startsAt} >= now()`,
          sql`${volunteerAssignments.status} IN ('assigned', 'confirmed')`,
        ),
      )
      .orderBy(asc(volunteerAssignments.startsAt), volunteerAssignments.id);
  }
}
