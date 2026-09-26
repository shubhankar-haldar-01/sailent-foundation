/**
 * Event lifecycle and registration eligibility.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AN EVENT HAS TWO STATES, AND THEY ARE NOT THE SAME QUESTION.
 *
 *   `status`             draft | published | archived   — can anyone see it?
 *   `registrationStatus` open | closed | full
 *                        | cancelled | completed        — what is happening?
 *
 * Both columns already existed; neither is new in Phase 9. Merging them into
 * one enum, the way `campaigns` does, was considered and rejected: a CANCELLED
 * event must stay visible. Everyone holding a registration needs to land on
 * that page and read that it is off — and `archived` is a 404 to the public,
 * so cancellation cannot live on the publication axis without hiding the
 * notice from precisely the people it is for. The same argument applies to
 * `completed`: a past event is part of the public record.
 *
 * So `registrationStatus` is the OPERATIONAL state of the event, despite its
 * name, and this file is where that reading is written down.
 * ══════════════════════════════════════════════════════════════════════════
 */

export type EventPublishStatus = 'draft' | 'published' | 'archived';

export type EventLifecycle = 'open' | 'closed' | 'full' | 'cancelled' | 'completed';

/**
 * Publication, identical to a programme's.
 *
 * `published → draft` is how an event that went out with the wrong date comes
 * back off the site within the minute.
 */
export const EVENT_PUBLISH_TRANSITIONS: Record<EventPublishStatus, EventPublishStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
};

/**
 * Operational lifecycle.
 *
 *   open      ⇄ closed          registration shut and reopened by hand
 *   open      → full            capacity reached — set BY THE SERVER, not a button
 *   full      → open | closed   a cancellation frees a seat, or an operator caps it
 *   any       → cancelled       the event is off
 *   any       → completed       it happened
 *
 * `cancelled → closed`, never `cancelled → open`. Reinstating a cancelled
 * event brings it back with registration SHUT, so somebody has to look at the
 * attendee list and reopen it deliberately. Cancellation emails have already
 * gone out by then; silently reopening would leave the people who received one
 * holding a registration they believe is void.
 *
 * `completed` is terminal. Attendance is recorded against a completed event —
 * that is the state it is recorded in — but the event itself does not come
 * back.
 */
export const EVENT_LIFECYCLE_TRANSITIONS: Record<EventLifecycle, EventLifecycle[]> = {
  open: ['closed', 'full', 'cancelled', 'completed'],
  closed: ['open', 'full', 'cancelled', 'completed'],
  full: ['open', 'closed', 'cancelled', 'completed'],
  cancelled: ['closed'],
  completed: [],
};

export function canTransitionEventPublish(
  from: EventPublishStatus,
  to: EventPublishStatus,
): boolean {
  return EVENT_PUBLISH_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionEventLifecycle(from: EventLifecycle, to: EventLifecycle): boolean {
  return EVENT_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Which publication states the public may reach. */
export const PUBLIC_EVENT_STATUSES: EventPublishStatus[] = ['published'];

export function isEventPubliclyVisible(status: EventPublishStatus): boolean {
  return PUBLIC_EVENT_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Registration eligibility
// ---------------------------------------------------------------------------

/**
 * Everything that decides whether one more person may register.
 *
 * Deliberately a PLAIN VALUE OBJECT rather than a database row: the server
 * evaluates it against a row it has just locked, and the web app evaluates the
 * same function against the public payload to decide what the button says.
 * One rule, two readers — the same arrangement as the transition tables above,
 * and with the same caveat: the UI uses this to be helpful, and the server
 * re-runs it under the lock because that is the only evaluation that counts.
 */
export interface EventRegistrationState {
  status: EventPublishStatus;
  lifecycle: EventLifecycle;
  startDate: Date | string;
  /** NULL means "until it starts". */
  registrationDeadline?: Date | string | null;
  /** NULL means uncapped. */
  capacity?: number | null;
  registeredCount: number;
  /** How many seats this request wants. */
  attendeeCount?: number;
}

export type RegistrationAvailability =
  | { state: 'open'; seatsLeft: number | null }
  | { state: 'unpublished'; reason: string }
  | { state: 'cancelled'; reason: string }
  | { state: 'completed'; reason: string }
  | { state: 'closed'; reason: string }
  | { state: 'full'; reason: string }
  | { state: 'deadline-passed'; reason: string };

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * When registration shuts.
 *
 * The explicit deadline if there is one, otherwise the moment the event
 * starts. There is no third possibility: registering for something that has
 * already begun is never what the person meant.
 */
export function registrationClosesAt(event: {
  startDate: Date | string;
  registrationDeadline?: Date | string | null;
}): Date {
  return asDate(event.registrationDeadline ?? event.startDate);
}

export function registrationAvailability(
  event: EventRegistrationState,
  now: Date = new Date(),
): RegistrationAvailability {
  if (event.status !== 'published') {
    return { state: 'unpublished', reason: 'This event is not open for registration.' };
  }

  // Checked BEFORE the deadline and before capacity: someone arriving at a
  // cancelled event should be told it is cancelled, not that they are late.
  if (event.lifecycle === 'cancelled') {
    return { state: 'cancelled', reason: 'This event has been cancelled.' };
  }
  if (event.lifecycle === 'completed') {
    return { state: 'completed', reason: 'This event has already taken place.' };
  }
  if (event.lifecycle === 'closed') {
    return { state: 'closed', reason: 'Registration for this event is closed.' };
  }

  if (registrationClosesAt(event).getTime() <= now.getTime()) {
    return { state: 'deadline-passed', reason: 'The registration deadline has passed.' };
  }

  const wanted = event.attendeeCount ?? 1;
  const seatsLeft =
    event.capacity === null || event.capacity === undefined
      ? null
      : Math.max(0, event.capacity - event.registeredCount);

  if (event.lifecycle === 'full' || (seatsLeft !== null && seatsLeft < wanted)) {
    return {
      state: 'full',
      reason:
        seatsLeft === 0 || seatsLeft === null
          ? 'This event is full.'
          : `Only ${seatsLeft} ${seatsLeft === 1 ? 'place is' : 'places are'} left.`,
    };
  }

  return { state: 'open', seatsLeft };
}

export function canRegister(event: EventRegistrationState, now: Date = new Date()): boolean {
  return registrationAvailability(event, now).state === 'open';
}

// ---------------------------------------------------------------------------
// Attendee record
// ---------------------------------------------------------------------------

/**
 * The state of ONE person's registration, on `event_registrations.status`.
 *
 * `waitlisted` is in the column's vocabulary and is NOT produced anywhere in
 * Phase 9 — there is no waitlist. It is left in the type because the column
 * already accepts it and a row written by a later phase should not fail to
 * parse here.
 */
export type AttendeeStatus =
  'registered' | 'waitlisted' | 'confirmed' | 'attended' | 'no_show' | 'cancelled';

/** The statuses that occupy a seat. Anything else has released it. */
export const SEAT_HOLDING_STATUSES: AttendeeStatus[] = [
  'registered',
  'confirmed',
  'attended',
  'no_show',
];

export function holdsSeat(status: AttendeeStatus): boolean {
  return SEAT_HOLDING_STATUSES.includes(status);
}

/**
 * What attendance may be marked as.
 *
 * Only these two. Marking someone `cancelled` from the attendance screen would
 * overwrite the record of a person who turned up with one that says they
 * withdrew, and the two are not the same fact.
 */
export const ATTENDANCE_OUTCOMES: AttendeeStatus[] = ['attended', 'no_show'];
