import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';

import { volunteerCertificates, volunteers, type DatabaseClient } from '@sailent/database';
import { canIssueCertificate, minutesToHours } from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { QUEUE_NAMES, QueueService, jobKey } from '../queue/queue.service.js';
import { ConflictException, NotFoundException } from '../../common/exceptions.js';
import { referenceCode } from '../../common/utils/reference.js';
import { VolunteerWorkService } from './volunteer-work.service.js';
import type { IssueCertificateInput } from './dto/volunteers.dto.js';

/**
 * Certificates of service.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS THE ONE THING HERE THAT LEAVES THE BUILDING.
 *
 * A donation receipt is read once. A certificate of service goes into a job
 * application, and somebody the foundation will never meet may rely on it. So:
 *
 *   • Hours come from VERIFIED attendance only. An unverified record is a
 *     claim nobody has checked, and this document is the organisation checking.
 *
 *   • The figure is FROZEN at issue. Recomputing it later would mean the
 *     printed certificate and the database disagreeing, and the printed one is
 *     the copy that exists in the world.
 *
 *   • Revocation is a STATUS, never a delete. A certificate issued in error
 *     has been seen; the honest record is that it existed and was withdrawn,
 *     and the verification page says so rather than reporting "no such
 *     certificate".
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class VolunteerCertificatesService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly work: VolunteerWorkService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  async listFor(volunteerId: string) {
    return this.database.db
      .select()
      .from(volunteerCertificates)
      .where(eq(volunteerCertificates.volunteerId, volunteerId))
      .orderBy(desc(volunteerCertificates.issuedAt), volunteerCertificates.id);
  }

  async issue(
    volunteerId: string,
    input: IssueCertificateInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [volunteer] = await this.database.db
      .select({
        id: volunteers.id,
        volunteerId: volunteers.volunteerId,
        firstName: volunteers.firstName,
        lastName: volunteers.lastName,
        status: volunteers.status,
      })
      .from(volunteers)
      .where(eq(volunteers.id, volunteerId))
      .limit(1);

    if (!volunteer) throw new NotFoundException('Volunteer');

    /*
      An approved volunteer carries a VOL- identifier, and the certificate
      quotes it. Somebody still under review has no identifier and no verified
      hours, so there is nothing to certify.
    */
    if (!volunteer.volunteerId) {
      throw new ConflictException(
        'This volunteer has not been approved, so there is no service to certify.',
      );
    }

    const minutes = await this.work.verifiedMinutesInPeriod(
      volunteerId,
      input.periodStart,
      input.periodEnd,
    );
    const hours = minutesToHours(minutes);

    if (!canIssueCertificate(hours)) {
      throw new ConflictException(
        minutes > 0
          ? `Only ${minutes} verified minutes fall in that period — under an hour, so there is nothing to certify yet.`
          : 'No verified attendance falls in that period. Verify the hours first.',
      );
    }

    const name = [volunteer.firstName, volunteer.lastName].filter(Boolean).join(' ').trim();

    const created = await this.database.db.transaction(async (tx) => {
      const year = new Date().getFullYear();

      /*
        The NUMBER is sequential-looking and human-quotable. The CODE is not:
        it backs a public verification page, and a guessable code would let
        anybody enumerate every volunteer's service record by counting upward.
        Two identifiers, two jobs.
      */
      const certificateNumber = `CERT-${year}-${referenceCode('', 6).replace('-', '')}`;
      const verificationCode = referenceCode('', 10).replace('-', '');

      const [row] = await tx
        .insert(volunteerCertificates)
        .values({
          volunteerId,
          certificateNumber,
          verificationCode,
          certificateType: input.certificateType ?? 'service',
          title: input.title?.trim() || `Certificate of service — ${name}`,
          // Frozen here. Nothing recomputes it.
          hoursCredited: hours,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          issuedBy: actor.id,
          status: 'issued',
        })
        .returning({ id: volunteerCertificates.id });

      if (!row) throw new ConflictException('Could not issue the certificate.');
      // The two identifiers come from this scope, not from the RETURNING
      // clause — Drizzle's `returning` takes columns, and passing a local
      // string silently typed as one.
      return { id: row.id, certificateNumber, verificationCode };
    });

    await this.audit.record({
      action: 'volunteer.certificate.issue',
      entityType: 'volunteer_certificate',
      entityId: created.id,
      userId: actor.id,
      newValues: {
        volunteerId,
        certificateNumber: created.certificateNumber,
        hoursCredited: hours,
        period: `${input.periodStart}..${input.periodEnd}`,
      },
      // The verification code is NOT audited. It is the secret that makes the
      // public check meaningful, and an audit log is a second copy of the
      // database with weaker access control.
      severity: 'warning',
      ...context,
    });

    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'volunteer.certificate.issued',
      { certificateId: created.id },
      { jobId: jobKey('volunteer-certificate', created.id) },
    );

    return this.getById(created.id);
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select()
      .from(volunteerCertificates)
      .where(eq(volunteerCertificates.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('Certificate');
    return row;
  }

  /**
   * Withdraw a certificate.
   *
   * The row stays. Deleting it would make the verification page report "no
   * such certificate" for a document somebody is holding — which reads as a
   * forgery rather than as a withdrawal, and is unfair to a volunteer whose
   * certificate was reissued for an administrative reason.
   */
  async revoke(id: string, reason: string, actor: AuthenticatedActor, context: AuditContext) {
    const before = await this.getById(id);

    if (before.status === 'revoked') {
      throw new ConflictException('That certificate has already been withdrawn.');
    }

    await this.database.db
      .update(volunteerCertificates)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(volunteerCertificates.id, id));

    await this.audit.record({
      action: 'volunteer.certificate.revoke',
      entityType: 'volunteer_certificate',
      entityId: id,
      userId: actor.id,
      oldValues: { status: 'issued' },
      newValues: { status: 'revoked' },
      reason,
      severity: 'critical',
      ...context,
    });

    return this.getById(id);
  }

  /**
   * The public check: is this certificate genuine?
   *
   * ══════════════════════════════════════════════════════════════════════════
   * UNAUTHENTICATED, AND DELIBERATELY NARROW.
   *
   * An employer with a certificate in front of them should be able to confirm
   * it without an account. What comes back is only what is already printed on
   * the document they are holding: the name, the hours, the period, the date
   * and whether it still stands.
   *
   * NOTHING ELSE. No email, no phone, no address, no other certificates, no
   * assignment history, no internal notes. The code proves possession of one
   * document; it is not a key to a person's record.
   *
   * A REVOKED certificate returns `valid: false` WITH its details rather than
   * a 404. "This certificate was withdrawn on 4 November" is the useful
   * answer; "no such certificate" implies a forgery and would be unfair to
   * somebody holding one that was reissued.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async verify(code: string) {
    const [row] = await this.database.db
      .select({
        certificateNumber: volunteerCertificates.certificateNumber,
        certificateType: volunteerCertificates.certificateType,
        title: volunteerCertificates.title,
        hoursCredited: volunteerCertificates.hoursCredited,
        periodStart: volunteerCertificates.periodStart,
        periodEnd: volunteerCertificates.periodEnd,
        issuedAt: volunteerCertificates.issuedAt,
        status: volunteerCertificates.status,
        revokedAt: volunteerCertificates.revokedAt,
        // The volunteer's NAME and their VOL- id — both printed on the
        // certificate. Nothing else from that table is selected.
        volunteerName: sql<string>`btrim(concat_ws(' ', volunteers.first_name, volunteers.last_name))`,
        volunteerCode: volunteers.volunteerId,
      })
      .from(volunteerCertificates)
      .innerJoin(volunteers, eq(volunteers.id, volunteerCertificates.volunteerId))
      .where(eq(volunteerCertificates.verificationCode, code.trim()))
      .limit(1);

    if (!row) {
      // No detail, no hint. A code that does not exist gets one answer, so
      // this cannot be used to probe which codes are close to real ones.
      throw new NotFoundException('Certificate');
    }

    return { ...row, valid: row.status === 'issued' };
  }

  /** Certificates a volunteer may see: their own, including revoked ones. */
  async listMine(volunteerId: string) {
    return this.database.db
      .select({
        id: volunteerCertificates.id,
        certificateNumber: volunteerCertificates.certificateNumber,
        verificationCode: volunteerCertificates.verificationCode,
        certificateType: volunteerCertificates.certificateType,
        title: volunteerCertificates.title,
        hoursCredited: volunteerCertificates.hoursCredited,
        periodStart: volunteerCertificates.periodStart,
        periodEnd: volunteerCertificates.periodEnd,
        issuedAt: volunteerCertificates.issuedAt,
        status: volunteerCertificates.status,
        revokedAt: volunteerCertificates.revokedAt,
        // Their own reason, unlike a rejection: a withdrawn certificate is
        // something the holder has to be able to explain to whoever saw it.
        revokedReason: volunteerCertificates.revokedReason,
      })
      .from(volunteerCertificates)
      .where(and(eq(volunteerCertificates.volunteerId, volunteerId)))
      .orderBy(desc(volunteerCertificates.issuedAt), volunteerCertificates.id);
  }
}
