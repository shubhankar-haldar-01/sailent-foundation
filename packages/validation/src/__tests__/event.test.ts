import { describe, expect, it } from 'vitest';

import {
  ATTENDANCE_OUTCOMES,
  EVENT_LIFECYCLE_TRANSITIONS,
  EVENT_PUBLISH_TRANSITIONS,
  canTransitionEventLifecycle,
  canTransitionEventPublish,
  holdsSeat,
  registrationAvailability,
  registrationClosesAt,
  type EventLifecycle,
} from '../domain/event.js';

const NOW = new Date('2026-09-21T10:00:00+05:30');
const IN_A_WEEK = new Date('2026-09-28T10:00:00+05:30');
const YESTERDAY = new Date('2026-09-20T10:00:00+05:30');

/** A published, open, uncapped event a week away. Each test spoils one thing. */
const OPEN = {
  status: 'published' as const,
  lifecycle: 'open' as const,
  startDate: IN_A_WEEK,
  registrationDeadline: null,
  capacity: null,
  registeredCount: 0,
};

describe('event lifecycle transitions', () => {
  it('lets an operator close and reopen registration', () => {
    expect(canTransitionEventLifecycle('open', 'closed')).toBe(true);
    expect(canTransitionEventLifecycle('closed', 'open')).toBe(true);
  });

  it('treats completed as terminal', () => {
    expect(EVENT_LIFECYCLE_TRANSITIONS.completed).toEqual([]);
    for (const target of ['open', 'closed', 'full', 'cancelled'] as EventLifecycle[]) {
      expect(canTransitionEventLifecycle('completed', target)).toBe(false);
    }
  });

  it('reinstates a cancelled event with registration SHUT, never open', () => {
    // Cancellation emails have gone out by this point. Reopening silently would
    // leave the people who got one holding a place they believe is void.
    expect(canTransitionEventLifecycle('cancelled', 'closed')).toBe(true);
    expect(canTransitionEventLifecycle('cancelled', 'open')).toBe(false);
  });

  it('allows cancellation from every live state', () => {
    for (const from of ['open', 'closed', 'full'] as EventLifecycle[]) {
      expect(canTransitionEventLifecycle(from, 'cancelled')).toBe(true);
    }
  });

  it('keeps publication a separate axis from the lifecycle', () => {
    expect(EVENT_PUBLISH_TRANSITIONS.published).toContain('draft');
    expect(canTransitionEventPublish('archived', 'published')).toBe(false);
    // An archived event comes back deliberately, as a draft, and is reviewed.
    expect(canTransitionEventPublish('archived', 'draft')).toBe(true);
  });
});

describe('registrationClosesAt', () => {
  it('is the explicit deadline when there is one', () => {
    expect(
      registrationClosesAt({ startDate: IN_A_WEEK, registrationDeadline: YESTERDAY }).getTime(),
    ).toBe(YESTERDAY.getTime());
  });

  it('is the start when there is not — registering for something under way is never meant', () => {
    expect(registrationClosesAt({ startDate: IN_A_WEEK }).getTime()).toBe(IN_A_WEEK.getTime());
  });
});

describe('registrationAvailability', () => {
  it('is open for a published, open, uncapped event', () => {
    const result = registrationAvailability(OPEN, NOW);
    expect(result.state).toBe('open');
    expect(result).toHaveProperty('seatsLeft', null);
  });

  it('reports seats left when there is a cap', () => {
    const result = registrationAvailability({ ...OPEN, capacity: 10, registeredCount: 4 }, NOW);
    expect(result).toEqual({ state: 'open', seatsLeft: 6 });
  });

  it('is full when the request wants more seats than remain', () => {
    const result = registrationAvailability(
      { ...OPEN, capacity: 10, registeredCount: 9, attendeeCount: 2 },
      NOW,
    );
    expect(result.state).toBe('full');
  });

  it('is full at exactly capacity', () => {
    expect(registrationAvailability({ ...OPEN, capacity: 3, registeredCount: 3 }, NOW).state).toBe(
      'full',
    );
  });

  it('tells somebody an event is cancelled before it tells them they are late', () => {
    // Order matters: "this event was cancelled" is the useful answer; "you
    // missed the deadline" for an event that is not happening is not.
    const result = registrationAvailability(
      { ...OPEN, lifecycle: 'cancelled', registrationDeadline: YESTERDAY },
      NOW,
    );
    expect(result.state).toBe('cancelled');
  });

  it('refuses after the deadline', () => {
    expect(registrationAvailability({ ...OPEN, registrationDeadline: YESTERDAY }, NOW).state).toBe(
      'deadline-passed',
    );
  });

  it('refuses once the event itself has started, with no deadline set', () => {
    expect(registrationAvailability({ ...OPEN, startDate: YESTERDAY }, NOW).state).toBe(
      'deadline-passed',
    );
  });

  it('refuses a draft or archived event without saying why in detail', () => {
    expect(registrationAvailability({ ...OPEN, status: 'draft' }, NOW).state).toBe('unpublished');
    expect(registrationAvailability({ ...OPEN, status: 'archived' }, NOW).state).toBe(
      'unpublished',
    );
  });

  it('refuses a completed event', () => {
    expect(registrationAvailability({ ...OPEN, lifecycle: 'completed' }, NOW).state).toBe(
      'completed',
    );
  });

  it('accepts ISO strings as well as Dates, because that is what an API payload carries', () => {
    const result = registrationAvailability(
      { ...OPEN, startDate: IN_A_WEEK.toISOString(), registrationDeadline: null },
      NOW,
    );
    expect(result.state).toBe('open');
  });
});

describe('seat accounting', () => {
  it('counts a no-show as still holding their seat', () => {
    // They took the place. Freeing it retroactively would change the capacity
    // arithmetic for an event that has already happened.
    expect(holdsSeat('no_show')).toBe(true);
    expect(holdsSeat('attended')).toBe(true);
    expect(holdsSeat('registered')).toBe(true);
    expect(holdsSeat('confirmed')).toBe(true);
  });

  it('does not count a cancellation or a waitlist entry', () => {
    expect(holdsSeat('cancelled')).toBe(false);
    expect(holdsSeat('waitlisted')).toBe(false);
  });

  it('offers exactly two attendance outcomes', () => {
    // Marking somebody `cancelled` from the attendance screen would replace
    // "this person came" with "this person withdrew".
    expect(ATTENDANCE_OUTCOMES).toEqual(['attended', 'no_show']);
  });
});
