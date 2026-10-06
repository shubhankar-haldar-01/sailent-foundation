import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';

import { donors, volunteers, type DatabaseClient } from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { NotFoundException } from '../../common/exceptions.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { AuditService } from '../audit/audit.service.js';
import { VolunteerWorkService } from './volunteer-work.service.js';
import { VolunteerCertificatesService } from './volunteer-certificates.service.js';
import type { UpdateMyVolunteerProfileInput } from './dto/volunteers.dto.js';
import { normaliseEmail } from '@sailent/validation';

/**
 * A volunteer's own record.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ACCOUNT AND THE VOLUNTEER RECORD ARE JOINED BY EMAIL, ON THE SERVER.
 *
 * Phase 8 made `donors` the general public account: one row per person,
 * whether they have donated, volunteered, both or neither. A volunteer signs
 * in with that account and this service finds their volunteer record by
 * matching the address on it.
 *
 * NO METHOD HERE TAKES A VOLUNTEER ID. Every one takes the account id from the
 * session and resolves the volunteer itself, so there is no parameter through
 * which one person could reach another's hours, assignments or certificates.
 * The resolution is a WHERE clause, and a caller with no volunteer record gets
 * a 404 rather than a 403 — a 403 would confirm that a record exists.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Matching on email rather than storing a foreign key is deliberate: a person
 * may apply to volunteer long before or long after they open an account, and
 * in either order. The address is what they have in common, and it is already
 * the unique identity on `donors`.
 */
@Injectable()
export class MyVolunteeringService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly work: VolunteerWorkService,
    private readonly certificates: VolunteerCertificatesService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The signed-in account's volunteer record, or null.
   *
   * Returns null rather than throwing, because "are you a volunteer?" is a
   * legitimate question with a legitimate negative answer — the dashboard asks
   * it to decide whether to show the section at all.
   */
  private async resolve(accountId: string) {
    const [account] = await this.database.db
      .select({ email: donors.email })
      .from(donors)
      .where(eq(donors.id, accountId))
      .limit(1);

    if (!account?.email) return null;

    /*
      ORDER BY, BECAUSE `LIMIT 1` WITHOUT ONE IS A COIN TOSS.

      `volunteers_email_live_unique` now guarantees at most one LIVE record per
      address, so in the ordinary case this orders a single row. It still
      matters, for two situations the index deliberately permits:

        - a rejected or archived record alongside a live one (re-application,
          which is a supported flow), and
        - two rejected records and nothing live.

      Without an ORDER BY, Postgres may return the rejected row to somebody who
      has since been approved — their dashboard would show no identifier, no
      hours and no certificates. Newest first is right: the most recent record
      is the one their current standing lives on.
    */
    const [volunteer] = await this.database.db
      .select()
      .from(volunteers)
      .where(sql`lower(btrim(${volunteers.email})) = ${normaliseEmail(account.email)}`)
      .orderBy(desc(volunteers.createdAt))
      .limit(1);

    return volunteer ?? null;
  }

  /** Throws where a route genuinely requires a volunteer record. */
  private async require(accountId: string) {
    const volunteer = await this.resolve(accountId);
    if (!volunteer) throw new NotFoundException('Volunteer record');
    return volunteer;
  }

  /**
   * The dashboard summary.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * WHAT A VOLUNTEER MAY NOT SEE ABOUT THEMSELVES.
   *
   * `statusReason` and `internalNotes` are ADMIN-ONLY and are not selected
   * here. A rejection reason in particular: the decision is communicated, the
   * reasoning behind it is an internal record. Returning it would turn every
   * rejection into an argument the organisation has no obligation to have, and
   * would make reviewers write notes that are diplomatic rather than candid —
   * which would destroy the value of having them.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async overview(accountId: string) {
    const volunteer = await this.resolve(accountId);
    if (!volunteer) return { isVolunteer: false as const };

    const [upcoming, certificates] = await Promise.all([
      this.work.upcomingFor(volunteer.id),
      this.certificates.listMine(volunteer.id),
    ]);

    return {
      isVolunteer: true as const,
      id: volunteer.id,
      volunteerId: volunteer.volunteerId,
      status: volunteer.status,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      joiningDate: volunteer.joiningDate,
      approvedAt: volunteer.approvedAt,
      totalHours: volunteer.totalHours,
      verifiedHours: volunteer.verifiedHours,
      assignmentCount: volunteer.assignmentCount,
      skills: volunteer.skills,
      interests: volunteer.interests,
      availability: volunteer.availability,
      city: volunteer.city,
      upcoming,
      certificates,
    };
  }

  async assignments(accountId: string) {
    const volunteer = await this.require(accountId);
    return this.work.listAssignments(volunteer.id);
  }

  /**
   * Their own attendance — READ ONLY, and that is the point.
   *
   * A volunteer can see what was recorded and raise it with somebody if it is
   * wrong. They cannot change it: certificates count verified hours, and
   * self-recorded attendance would make the organisation's signature on that
   * document worthless.
   */
  async attendance(accountId: string) {
    const volunteer = await this.require(accountId);
    return this.work.listAttendance(volunteer.id);
  }

  async certificatesFor(accountId: string) {
    const volunteer = await this.require(accountId);
    return this.certificates.listMine(volunteer.id);
  }

  /**
   * Update the parts of their own record a volunteer owns.
   *
   * A much shorter list than the admin form: contact details, skills,
   * interests, availability and the emergency contact. Not their name, not
   * their status, not their hours, not their identifier — those are either the
   * organisation's record of a decision or a figure that ends up on a
   * certificate.
   */
  async updateProfile(
    accountId: string,
    input: UpdateMyVolunteerProfileInput,
    context: AuditContext,
  ) {
    const volunteer = await this.require(accountId);

    const allowed = [
      'phone',
      'city',
      'state',
      'occupation',
      'languages',
      'skills',
      'interests',
      'emergencyContactName',
      'emergencyContactPhone',
      'emergencyContactRelation',
      'availability',
    ] as const;

    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) patch[key] = input[key];
    }

    if (Object.keys(patch).length > 0) {
      await this.database.db
        .update(volunteers)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(volunteers.id, volunteer.id));
    }

    await this.audit.record({
      actorType: 'volunteer',
      action: 'volunteer.profile_updated',
      entityType: 'volunteer',
      entityId: volunteer.id,
      userId: accountId,
      // Field names only. The values are contact details, and an audit log is
      // a second copy of the database with a longer retention period.
      newValues: { fields: Object.keys(patch) },
      ...context,
    });

    return this.overview(accountId);
  }
}
