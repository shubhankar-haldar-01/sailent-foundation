/**
 * Volunteer lifecycle, hours and certificates.
 *
 * Shared between the API that enforces these rules and the admin UI that
 * renders the buttons — one table, two readers, the same arrangement as the
 * programme and event lifecycles. The server re-checks everything regardless.
 */

export type VolunteerStatus =
  | 'applied'
  | 'under_review'
  | 'approved'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'rejected'
  | 'archived';

/**
 * The volunteer lifecycle.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `approved` AND `active` ARE NOT THE SAME STATE, and keeping them apart is
 * what makes decision A13 workable.
 *
 * Approval is the decision, and it is the moment the VOL- identifier is
 * allocated — permanently, never reused. `active` is the operational state
 * that follows once induction is done. An organisation that approves somebody
 * in March and inducts them in May has two dates worth recording, and one
 * status cannot hold both.
 *
 * `rejected` is TERMINAL HERE. It does not transition to `applied`; a
 * re-application creates a new record, subject to the cooling period. Moving a
 * rejected row back would erase the fact that a decision was taken.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `suspended → active` is permitted and deliberately unceremonious: a
 * suspension pending an investigation that clears is the ordinary case, and
 * making somebody re-apply for it would be punitive.
 */
export const VOLUNTEER_TRANSITIONS: Record<VolunteerStatus, VolunteerStatus[]> = {
  applied: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected', 'applied'],
  approved: ['active', 'inactive', 'suspended', 'archived'],
  active: ['inactive', 'suspended', 'archived'],
  inactive: ['active', 'archived'],
  suspended: ['active', 'inactive', 'archived'],
  rejected: [],
  archived: [],
};

export function canTransitionVolunteer(from: VolunteerStatus, to: VolunteerStatus): boolean {
  return VOLUNTEER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The statuses that carry a VOL- identifier.
 *
 * The mirror of the `volunteers_id_requires_approval` check constraint, which
 * is the authority. This exists so the API can produce a readable error rather
 * than letting a constraint violation surface as a 500.
 */
export const IDENTIFIED_STATUSES: VolunteerStatus[] = [
  'approved',
  'active',
  'inactive',
  'suspended',
  'archived',
];

export function requiresVolunteerId(status: VolunteerStatus): boolean {
  return IDENTIFIED_STATUSES.includes(status);
}

/** Awaiting a decision. Drives the review queue. */
export function isPendingReview(status: VolunteerStatus): boolean {
  return status === 'applied' || status === 'under_review';
}

/**
 * Whether this volunteer may be given work.
 *
 * Only `active`. An approved-but-not-yet-inducted volunteer has not been
 * briefed; a suspended one is suspended; an inactive one has stepped back.
 * Assigning any of them puts somebody in the field who should not be there.
 */
export function canBeAssigned(status: VolunteerStatus): boolean {
  return status === 'active';
}

export type VolunteerAssignmentStatus =
  'assigned' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

/**
 * Assignment lifecycle.
 *
 * `no_show` is reachable only from a live assignment and is TERMINAL, because
 * it is a record of something that did not happen rather than a state the
 * assignment is in. `cancelled` is likewise terminal: a cancelled assignment
 * that needs reviving is a new assignment, which keeps the history honest.
 */
export const ASSIGNMENT_TRANSITIONS: Record<
  VolunteerAssignmentStatus,
  VolunteerAssignmentStatus[]
> = {
  assigned: ['confirmed', 'completed', 'cancelled', 'no_show'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionAssignment(
  from: VolunteerAssignmentStatus,
  to: VolunteerAssignmentStatus,
): boolean {
  return ASSIGNMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses against which attendance may be recorded. */
export function acceptsAttendance(status: VolunteerAssignmentStatus): boolean {
  return status === 'assigned' || status === 'confirmed' || status === 'completed';
}

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

/**
 * Minutes to whole hours, ROUNDED DOWN.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Rounding down is the only defensible direction here, because these hours are
 * printed on a certificate somebody shows an employer. Rounding 90 minutes up
 * to two hours certifies half an hour that did not happen — across a year of
 * shifts that is a materially inflated claim, made by the organisation, about
 * a person who did not ask for it.
 *
 * The cost is that a volunteer who worked 119 minutes is credited with one
 * hour. That is a real loss and the right one: understating service is a
 * disappointment, overstating it is a false statement.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function minutesToHours(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor(minutes / 60);
}

/**
 * Whether a certificate may be issued for this many hours.
 *
 * Above zero, which the database also enforces. A certificate crediting no
 * hours certifies nothing and devalues every real one.
 */
export function canIssueCertificate(verifiedHours: number): boolean {
  return Number.isInteger(verifiedHours) && verifiedHours > 0;
}

export type CertificateType = 'participation' | 'appreciation' | 'completion' | 'service';
export type CertificateStatus = 'issued' | 'revoked';
