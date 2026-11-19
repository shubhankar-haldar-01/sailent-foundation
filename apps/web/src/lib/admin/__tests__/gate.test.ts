import { describe, expect, it } from 'vitest';

import type { AdminEventRegistration } from '../api';
import { admittedEntries } from '../gate';

function booking(overrides: Partial<AdminEventRegistration>): AdminEventRegistration {
  return {
    id: 'a1a1a1a1-0000-4000-8000-000000000001',
    fullName: 'Asha One',
    email: 'asha@example.test',
    phone: '9876543210',
    attendeeCount: 1,
    functionName: null,
    attendees: [],
    status: 'registered',
    registeredAt: '2026-11-01T04:30:00.000Z',
    attendedAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

/** The gate desk's Admitted list: everyone in, newest first. */
describe('admittedEntries', () => {
  it('lists each admitted person of a group, newest first, and leaves out who is not in', () => {
    const group = booking({
      attendeeCount: 3,
      functionName: 'Dance',
      status: 'attended',
      attendedAt: '2026-12-01T04:31:00.000Z',
      attendees: [
        {
          fullName: 'Asha One',
          passNumber: 'SF-EVT-A1A1A1A1-1',
          checkedInAt: '2026-12-01T04:31:00.000Z',
        },
        { fullName: 'Bina Two', passNumber: 'SF-EVT-A1A1A1A1-2', checkedInAt: null },
        {
          fullName: 'Chitra Three',
          passNumber: 'SF-EVT-A1A1A1A1-3',
          checkedInAt: '2026-12-01T04:40:00.000Z',
        },
      ],
    });

    expect(admittedEntries([group]).map((entry) => [entry.name, entry.passNumber])).toEqual([
      ['Chitra Three', 'SF-EVT-A1A1A1A1-3'],
      ['Asha One', 'SF-EVT-A1A1A1A1-1'],
    ]);
    expect(admittedEntries([group])[0]).toMatchObject({ functionName: 'Dance' });
  });

  it('counts a booking marked attended before passes were stamped, at its attended time', () => {
    const older = booking({ status: 'attended', attendedAt: '2026-11-30T10:00:00.000Z' });
    expect(admittedEntries([older])).toEqual([
      expect.objectContaining({ name: 'Asha One', admittedAt: '2026-11-30T10:00:00.000Z' }),
    ]);
  });

  it('leaves out cancelled bookings and people not yet in', () => {
    const cancelled = booking({ status: 'cancelled', attendedAt: '2026-11-30T10:00:00.000Z' });
    const waiting = booking({ id: 'b2b2b2b2-0000-4000-8000-000000000002' });
    expect(admittedEntries([cancelled, waiting])).toEqual([]);
  });
});
