import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENT_TRANSITIONS,
  IDENTIFIED_STATUSES,
  VOLUNTEER_TRANSITIONS,
  acceptsAttendance,
  canBeAssigned,
  canIssueCertificate,
  canTransitionAssignment,
  canTransitionVolunteer,
  isPendingReview,
  minutesToHours,
  requiresVolunteerId,
  type VolunteerAssignmentStatus,
  type VolunteerStatus,
} from '../domain/volunteer.js';

const ALL_STATUSES = Object.keys(VOLUNTEER_TRANSITIONS) as VolunteerStatus[];

describe('volunteer lifecycle', () => {
  it('has an entry for every status, so no status is a dead end by accident', () => {
    // A missing key reads exactly like a terminal state at the call site.
    // Being terminal must be a decision, which means every status is listed.
    for (const status of ALL_STATUSES) {
      expect(VOLUNTEER_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('never names a target that is not itself a status', () => {
    for (const [from, targets] of Object.entries(VOLUNTEER_TRANSITIONS)) {
      for (const to of targets) {
        expect(ALL_STATUSES, `${from} → ${to}`).toContain(to);
      }
    }
  });

  it('never allows a status to transition to itself', () => {
    // A no-op that writes an audit row and fires a notification.
    for (const status of ALL_STATUSES) {
      expect(VOLUNTEER_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it('treats rejected and archived as terminal', () => {
    expect(VOLUNTEER_TRANSITIONS.rejected).toEqual([]);
    expect(VOLUNTEER_TRANSITIONS.archived).toEqual([]);
  });

  it('will not reopen a rejection', () => {
    // A re-application is a NEW record. Moving this one back would erase the
    // fact that somebody took a decision and when.
    expect(canTransitionVolunteer('rejected', 'applied')).toBe(false);
    expect(canTransitionVolunteer('rejected', 'approved')).toBe(false);
    expect(canTransitionVolunteer('rejected', 'under_review')).toBe(false);
  });

  it('keeps approval and activation as two separate steps', () => {
    // Approval allocates the VOL- id; activation follows induction. An
    // organisation that approves in March and inducts in May has two dates.
    expect(canTransitionVolunteer('applied', 'approved')).toBe(true);
    expect(canTransitionVolunteer('approved', 'active')).toBe(true);
    // And an application cannot skip straight to active.
    expect(canTransitionVolunteer('applied', 'active')).toBe(false);
  });

  it('lets a cleared suspension return to active without ceremony', () => {
    // A suspension pending an investigation that clears is the ordinary case;
    // making somebody re-apply for it would be punitive.
    expect(canTransitionVolunteer('suspended', 'active')).toBe(true);
  });

  it('cannot un-archive', () => {
    expect(canTransitionVolunteer('archived', 'active')).toBe(false);
  });

  it('refuses a status it has never heard of', () => {
    // Reached with a value straight off the wire. `?? false` matters.
    expect(canTransitionVolunteer('nonsense' as VolunteerStatus, 'active')).toBe(false);
  });
});

describe('who carries a VOL- identifier', () => {
  it('names exactly the post-approval statuses', () => {
    // The mirror of the `volunteers_id_requires_approval` check constraint,
    // which is the authority. If the two drift, the database wins and the API
    // returns a constraint violation instead of a sentence.
    expect([...IDENTIFIED_STATUSES].sort()).toEqual(
      ['active', 'approved', 'archived', 'inactive', 'suspended'].sort(),
    );
  });

  it('excludes everyone who has not been approved', () => {
    expect(requiresVolunteerId('applied')).toBe(false);
    expect(requiresVolunteerId('under_review')).toBe(false);
    // Decision A13: an id is allocated at approval, never at application, and
    // a rejected applicant must not be left holding one.
    expect(requiresVolunteerId('rejected')).toBe(false);
  });

  it('keeps the id through archiving', () => {
    // The number appears on certificates that exist in the physical world.
    // Archiving somebody must not invalidate a document they hold.
    expect(requiresVolunteerId('archived')).toBe(true);
  });

  it('agrees with the transition table: every status reachable FROM approved keeps its id', () => {
    /*
      The constraint pair that actually protects A13. If some future edit adds
      `approved → applied`, an approved volunteer could reach a status with no
      id — and the check constraint would reject the update mid-transaction,
      which reads as a bug rather than as a rule.
    */
    for (const target of VOLUNTEER_TRANSITIONS.approved) {
      expect(requiresVolunteerId(target), `approved → ${target}`).toBe(true);
    }
  });
});

describe('review queue', () => {
  it('counts an application as pending until somebody decides', () => {
    expect(isPendingReview('applied')).toBe(true);
    expect(isPendingReview('under_review')).toBe(true);
  });

  it('drops it from the queue once decided, either way', () => {
    // Including rejected — a decided application is off the desk.
    for (const status of ['approved', 'active', 'rejected', 'archived'] as VolunteerStatus[]) {
      expect(isPendingReview(status)).toBe(false);
    }
  });
});

describe('who may be assigned work', () => {
  it('is active volunteers and nobody else', () => {
    for (const status of ALL_STATUSES) {
      expect(canBeAssigned(status), status).toBe(status === 'active');
    }
  });

  it('excludes approved, which is the one that looks safe', () => {
    /*
      Approved is not inducted. Assigning somebody who has been approved but
      not yet briefed puts an unprepared person in the field, which is the
      failure this rule exists to prevent — and it is the mistake an admin is
      most likely to make, because the record says "approved".
    */
    expect(canBeAssigned('approved')).toBe(false);
  });

  it('excludes suspended, which is the whole point of suspending somebody', () => {
    expect(canBeAssigned('suspended')).toBe(false);
  });
});

describe('assignment lifecycle', () => {
  const ALL_ASSIGNMENT = Object.keys(ASSIGNMENT_TRANSITIONS) as VolunteerAssignmentStatus[];

  it('has an entry for every assignment status and never targets an unknown one', () => {
    for (const [from, targets] of Object.entries(ASSIGNMENT_TRANSITIONS)) {
      for (const to of targets) {
        expect(ALL_ASSIGNMENT, `${from} → ${to}`).toContain(to);
      }
    }
  });

  it('accepts attendance for work that was assigned, confirmed or completed', () => {
    expect(acceptsAttendance('assigned')).toBe(true);
    expect(acceptsAttendance('confirmed')).toBe(true);
    // Completed especially: a register is usually written up after the shift.
    expect(acceptsAttendance('completed')).toBe(true);
  });

  it('refuses attendance against cancelled work', () => {
    // Hours recorded against a shift that did not happen end up on a
    // certificate as verified service.
    expect(acceptsAttendance('cancelled')).toBe(false);
  });

  it('refuses an unknown assignment status', () => {
    expect(canTransitionAssignment('nonsense' as VolunteerAssignmentStatus, 'completed')).toBe(
      false,
    );
  });
});

describe('minutes to hours', () => {
  it('rounds DOWN', () => {
    expect(minutesToHours(59)).toBe(0);
    expect(minutesToHours(60)).toBe(1);
    // The case the whole rule is about: 119 minutes is one hour, not two.
    expect(minutesToHours(119)).toBe(1);
    expect(minutesToHours(120)).toBe(2);
    expect(minutesToHours(479)).toBe(7);
  });

  it('never rounds a single minute up to an hour', () => {
    expect(minutesToHours(1)).toBe(0);
  });

  it('treats nothing, negatives and rubbish as zero hours', () => {
    // These reach here from a sum over an empty set, and from JSON.
    expect(minutesToHours(0)).toBe(0);
    expect(minutesToHours(-60)).toBe(0);
    expect(minutesToHours(Number.NaN)).toBe(0);
    expect(minutesToHours(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('is monotonic — more minutes never credits fewer hours', () => {
    /*
      Sounds trivial, and is the property a "round to nearest" or a
      floating-point division would break at some boundary. Attendance is
      corrected in place, so a figure that went DOWN when a volunteer's minutes
      went up would be visible and unexplainable.
    */
    let previous = 0;
    for (let minutes = 0; minutes <= 1440; minutes += 1) {
      const hours = minutesToHours(minutes);
      expect(hours).toBeGreaterThanOrEqual(previous);
      previous = hours;
    }
  });

  it('never credits more hours than the minutes support', () => {
    for (let minutes = 0; minutes <= 1440; minutes += 7) {
      expect(minutesToHours(minutes) * 60).toBeLessThanOrEqual(minutes);
    }
  });
});

describe('when a certificate may be issued', () => {
  it('needs at least one whole verified hour', () => {
    expect(canIssueCertificate(0)).toBe(false);
    expect(canIssueCertificate(1)).toBe(true);
    expect(canIssueCertificate(40)).toBe(true);
  });

  it('refuses negative and fractional hours', () => {
    // The database enforces `hours_credited > 0` as an integer column; this
    // is so the API can say so in a sentence rather than by constraint name.
    expect(canIssueCertificate(-1)).toBe(false);
    expect(canIssueCertificate(1.5)).toBe(false);
    expect(canIssueCertificate(Number.NaN)).toBe(false);
  });

  it('agrees with minutesToHours at the boundary', () => {
    // 59 minutes of verified work earns no certificate. The two functions must
    // not disagree about that, or the UI offers a button the API refuses.
    expect(canIssueCertificate(minutesToHours(59))).toBe(false);
    expect(canIssueCertificate(minutesToHours(60))).toBe(true);
  });
});
