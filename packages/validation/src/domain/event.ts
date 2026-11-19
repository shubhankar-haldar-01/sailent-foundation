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

// ---------------------------------------------------------------------------
// Entry passes
// ---------------------------------------------------------------------------

/**
 * One person's entry pass, as stored in `event_registrations.attendees`.
 *
 * A booking holds up to four passes, one per person, and each is admitted at
 * the gate on its own. `checkedInAt` is that person's admission — the booking's
 * `status` only says that SOMEONE on it has arrived, which is not enough to
 * tell a second scan of pass 1 from a first scan of pass 2.
 */
export interface EventPass {
  fullName: string;
  passNumber?: string;
  /** ISO timestamp of this person's admission. Absent or null until then. */
  checkedInAt?: string | null;
}

export interface ResolvedEventPass {
  fullName: string;
  passNumber: string;
  checkedInAt: string | null;
}

export const PASS_NUMBER_PREFIX = 'SF-EVT-';

/**
 * The booking's pass number: the prefix and the first eight hex digits of the
 * registration id. A group's passes add `-1`…`-4` to it.
 *
 * Derived, not stored on the row, so it is the same everywhere it is printed —
 * the confirmation, the dashboard, the downloaded pass and the gate.
 */
export function passNumberFor(registrationId: string): string {
  return `${PASS_NUMBER_PREFIX}${registrationId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/**
 * Every pass on a booking.
 *
 * A row with no `attendees` (written before passes were stored per person)
 * still admits its one person, under the booking's own number.
 */
export function passesOf(registration: {
  id: string;
  fullName: string;
  attendees?: EventPass[] | null;
}): ResolvedEventPass[] {
  const base = passNumberFor(registration.id);
  const list = Array.isArray(registration.attendees) ? registration.attendees : [];
  if (list.length === 0) {
    return [{ fullName: registration.fullName, passNumber: base, checkedInAt: null }];
  }
  return list.map((pass, index) => ({
    fullName: pass.fullName,
    passNumber: pass.passNumber || (list.length === 1 ? base : `${base}-${index + 1}`),
    checkedInAt: pass.checkedInAt ?? null,
  }));
}

/**
 * Has this person been admitted?
 *
 * Their own `checkedInAt` decides it. The one exception is a booking marked
 * `attended` with no pass stamped at all — attendance recorded before passes
 * carried their own timestamp — which is read as everyone on it having come,
 * because that is what the mark said when it was made.
 */
export function isPassAdmitted(
  registration: { status: string; attendees?: EventPass[] | null },
  pass: EventPass,
): boolean {
  if (pass.checkedInAt) return true;
  if (registration.status !== 'attended') return false;
  const list = Array.isArray(registration.attendees) ? registration.attendees : [];
  return !list.some((entry) => entry.checkedInAt);
}

export interface ParsedPassCode {
  /** The eight hex digits, lower-case — the start of the registration id. */
  baseHex: string;
  /** Which person on a group booking (1-based), or null for the booking's own number. */
  index: number | null;
}

const PASS_CODE = /^(?:SF-EVT-)?([0-9a-f]{8})(?:-(\d{1,2}))?$/i;

/**
 * Read a pass number, as printed or scanned: `SF-EVT-E355F430`, `SF-EVT-E355F430-2`,
 * or the bare `e355f430`. Anything else is not a pass number and returns null —
 * which is what keeps a name, or a QR code carrying `%%`, from being looked up
 * as if it were one.
 */
export function parsePassCode(text: string): ParsedPassCode | null {
  const match = PASS_CODE.exec(text.trim());
  if (!match?.[1]) return null;
  const index = match[2] ? Number(match[2]) : null;
  if (index === 0) return null;
  return { baseHex: match[1].toLowerCase(), index };
}

/**
 * What a scanned QR code is asking for.
 *
 * A link carrying the pass in `code`, `pass`, `ref` or `passNumber` yields
 * that value; anything else is returned trimmed and unchanged.
 */
export function passQueryFromScan(raw: string): string {
  const text = raw.trim();
  if (!/^https?:\/\//i.test(text)) return text;
  try {
    const url = new URL(text);
    for (const key of ['code', 'pass', 'ref', 'passNumber']) {
      const value = url.searchParams.get(key)?.trim();
      if (value) return value;
    }
  } catch {
    // Not a parseable link: treat it as the text it is.
  }
  return text;
}
