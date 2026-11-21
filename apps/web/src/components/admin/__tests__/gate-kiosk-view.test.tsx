import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GateKioskView } from '../gate-kiosk-view';
import { checkInEventAttendeeAction, verifyEventPassAction } from '@/lib/admin/actions';
import type { VerifyPassResponse } from '@/lib/admin/actions';
import type { AdminEvent, AdminEventRegistration } from '@/lib/admin/api';

vi.mock('@/lib/admin/actions', () => ({
  verifyEventPassAction: vi.fn(),
  checkInEventAttendeeAction: vi.fn(),
}));

// No camera in jsdom: the scanner starts and simply never reads a code.
const scanner = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    isScanning = false;
    start = scanner.start;
    stop = scanner.stop;
  },
}));

const verifyMock = vi.mocked(verifyEventPassAction);
const checkInMock = vi.mocked(checkInEventAttendeeAction);

const EVENT = {
  id: 'f0f0f0f0-0000-4000-8000-000000000001',
  title: 'Health camp',
  startDate: '2026-12-01T04:30:00.000Z',
  venueName: 'Ward 12 Hall',
  registeredCount: 3,
} as unknown as AdminEvent;

const REGISTRATION_ID = 'e355f430-1b2c-4d5e-8f90-123456789abc';

function found(matchedBy: 'pass' | 'search'): VerifyPassResponse {
  const pass = {
    fullName: 'Kavya Nair',
    passNumber: 'SF-EVT-E355F430',
    checkedInAt: null,
    admitted: false,
  };
  return {
    valid: true,
    status: 'valid',
    matchedBy,
    message: 'Found.',
    registration: {
      id: REGISTRATION_ID,
      eventId: EVENT.id,
      fullName: 'Kavya Nair',
      email: 'kavya@example.test',
      phone: '9876543210',
      attendeeCount: 1,
      functionName: null,
      status: 'registered',
      registeredAt: '2026-11-01T04:30:00.000Z',
      attendedAt: null,
      isPaid: false,
      paidAmount: null,
      basePassId: 'SF-EVT-E355F430',
      matchedAttendee: pass,
      allAttendees: [pass],
    },
  };
}

async function lookUp(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/Pass ID/i), { target: { value: text } });
  await act(async () => {
    fireEvent.submit(screen.getByPlaceholderText(/Pass ID/i).closest('form')!);
  });
}

function turnOnAutoAdmit() {
  fireEvent.click(screen.getByTitle(/Auto-Admit instantly admits/i));
}

describe('GateKioskView', () => {
  beforeEach(() => {
    scanner.start.mockReset().mockResolvedValue(undefined);
    scanner.stop.mockReset().mockResolvedValue(undefined);
    verifyMock.mockReset();
    checkInMock.mockReset();
    checkInMock.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        message: 'Checked in: Kavya Nair',
        alreadyAttended: false,
        attendedAt: '2026-12-01T04:35:00.000Z',
        passNumber: 'SF-EVT-E355F430',
        attendeeName: 'Kavya Nair',
        admittedCount: 1,
        totalPasses: 1,
      },
    });
  });

  it('auto-admits an exact pass match', async () => {
    verifyMock.mockResolvedValue({ ok: true, data: found('pass') });
    render(<GateKioskView event={EVENT} />);

    turnOnAutoAdmit();
    await lookUp('SF-EVT-E355F430');

    await waitFor(() =>
      expect(checkInMock).toHaveBeenCalledWith(EVENT.id, REGISTRATION_ID, 'SF-EVT-E355F430'),
    );
  });

  it('never auto-admits someone found by name, even with Auto-Admit on', async () => {
    verifyMock.mockResolvedValue({ ok: true, data: found('search') });
    render(<GateKioskView event={EVENT} />);

    turnOnAutoAdmit();
    await lookUp('Kavya');

    expect(await screen.findByText(/FOUND BY NAME/i)).toBeInTheDocument();
    expect(checkInMock).not.toHaveBeenCalled();
  });

  it('lists every match instead of picking one, and looks up the chosen booking by id', async () => {
    verifyMock.mockResolvedValueOnce({
      ok: true,
      data: {
        valid: false,
        status: 'multiple_matches',
        matchedBy: 'search',
        message: '2 bookings match. Choose the right person.',
        candidates: [
          {
            registrationId: REGISTRATION_ID,
            fullName: 'Kavya Nair',
            passNumber: 'SF-EVT-E355F430',
            attendeeNames: ['Kavya Nair'],
            status: 'registered',
            totalPasses: 1,
            admittedCount: 0,
          },
          {
            registrationId: '9a9a9a9a-0000-4000-8000-000000000002',
            fullName: 'Kavya Raman',
            passNumber: 'SF-EVT-9A9A9A9A',
            attendeeNames: ['Kavya Raman'],
            status: 'registered',
            totalPasses: 1,
            admittedCount: 0,
          },
        ],
      },
    });
    verifyMock.mockResolvedValueOnce({ ok: true, data: found('pass') });
    render(<GateKioskView event={EVENT} />);

    turnOnAutoAdmit();
    await lookUp('Kavya');

    expect(await screen.findByText(/SEVERAL MATCHES/i)).toBeInTheDocument();
    expect(screen.getByText('Kavya Raman')).toBeInTheDocument();
    expect(checkInMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('Kavya Nair').closest('button')!);
    });
    expect(verifyMock).toHaveBeenLastCalledWith(EVENT.id, REGISTRATION_ID);
    // Chosen by name, so shown for confirmation: Auto-Admit stays out of it.
    expect(await screen.findByText(/ADMIT ATTENDEE NOW/i)).toBeInTheDocument();
    expect(checkInMock).not.toHaveBeenCalled();
  });

  it('gives each person on a group booking their own Check In, and counts people', async () => {
    const group: AdminEventRegistration = {
      id: REGISTRATION_ID,
      fullName: 'Asha One',
      email: 'asha@example.test',
      phone: '9876543210',
      attendeeCount: 3,
      functionName: null,
      attendees: [
        {
          fullName: 'Asha One',
          passNumber: 'SF-EVT-E355F430-1',
          checkedInAt: '2026-12-01T04:31:00.000Z',
        },
        { fullName: 'Bina Two', passNumber: 'SF-EVT-E355F430-2', checkedInAt: null },
        { fullName: 'Chitra Three', passNumber: 'SF-EVT-E355F430-3', checkedInAt: null },
      ],
      status: 'attended',
      registeredAt: '2026-11-01T04:30:00.000Z',
      attendedAt: '2026-12-01T04:31:00.000Z',
      cancellationReason: null,
    };
    render(<GateKioskView event={EVENT} initialRegistrations={[group]} />);

    expect(screen.getByText('1 / 3 Admitted')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Guest List/i }));
    expect(screen.getAllByRole('button', { name: /Check In/i })).toHaveLength(2);
    expect(screen.getByText('Bina Two')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Check In/i })[0]!);
    });
    expect(checkInMock).toHaveBeenCalledWith(EVENT.id, REGISTRATION_ID, 'SF-EVT-E355F430-2');
  });

  it('puts the camera area on screen before the camera starts (or no pass is ever read)', async () => {
    // html5-qrcode sizes its scan box from the area's on-screen size when the
    // video starts; an area that is still display:none measures 0×0 and the
    // scanner never starts reading.
    let classWhenStarted: string | null = null;
    scanner.start.mockImplementation(async () => {
      classWhenStarted = document.getElementById('kiosk-camera-viewport')!.className;
    });

    render(<GateKioskView event={EVENT} />);

    await waitFor(() => expect(scanner.start).toHaveBeenCalled());
    expect(classWhenStarted).not.toBeNull();
    const classes = String(classWhenStarted).split(/\s+/);
    expect(classes).not.toContain('hidden');
    expect(classes).toContain('block');
  });

  it('says why the camera did not start, instead of a generic line', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    scanner.start.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

    render(<GateKioskView event={EVENT} />);

    expect(await screen.findByText(/Camera access was refused/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable camera/i })).toBeInTheDocument();
  });

  describe('leaving the page', () => {
    type FakeScanner = { isScanning: boolean; busy?: boolean };

    it('does not crash when the camera is still stopping (Exit desk)', async () => {
      // Like html5-qrcode: a second stop while one is under way THROWS.
      scanner.start.mockImplementation(async function (this: FakeScanner) {
        this.isScanning = true;
      });
      scanner.stop.mockImplementation(function (this: FakeScanner) {
        if (this.busy) throw 'Cannot transition to a new state, already under transition';
        this.busy = true;
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            this.isScanning = false;
            this.busy = false;
            resolve();
          }, 20),
        );
      });

      const { unmount } = render(<GateKioskView event={EVENT} />);
      expect(await screen.findByRole('button', { name: /Pause/i })).toBeInTheDocument();

      expect(() => unmount()).not.toThrow();
      expect(scanner.stop).toHaveBeenCalledTimes(1);
    });

    it('switches the camera off if the page was left while it was starting', async () => {
      let finishStart: () => void = () => {};
      scanner.start.mockImplementation(function (this: FakeScanner) {
        return new Promise<void>((resolve) => {
          finishStart = () => {
            this.isScanning = true;
            resolve();
          };
        });
      });
      scanner.stop.mockImplementation(async function (this: FakeScanner) {
        this.isScanning = false;
      });

      const { unmount } = render(<GateKioskView event={EVENT} />);
      await waitFor(() => expect(scanner.start).toHaveBeenCalled());
      unmount();
      await act(async () => {
        finishStart();
      });

      await waitFor(() => expect(scanner.stop).toHaveBeenCalled());
    });
  });

  describe('Auto-Admit and the Admitted list', () => {
    it('shows a pass it has just admitted as ADMITTED, not ALREADY ADMITTED', async () => {
      verifyMock.mockResolvedValue({ ok: true, data: found('pass') });
      render(<GateKioskView event={EVENT} />);

      turnOnAutoAdmit();
      await lookUp('SF-EVT-E355F430');

      expect(await screen.findByText('ADMITTED', { exact: true })).toBeInTheDocument();
      expect(screen.queryByText('ALREADY ADMITTED')).not.toBeInTheDocument();
    });

    it('still says ALREADY ADMITTED for someone let in before', async () => {
      const before = found('pass');
      before.status = 'already_attended';
      before.valid = false;
      before.registration!.matchedAttendee!.admitted = true;
      verifyMock.mockResolvedValue({ ok: true, data: before });
      render(<GateKioskView event={EVENT} />);

      turnOnAutoAdmit();
      await lookUp('SF-EVT-E355F430');

      expect(await screen.findByText('ALREADY ADMITTED')).toBeInTheDocument();
      expect(checkInMock).not.toHaveBeenCalled();
    });

    it('looks a pass held in front of the camera up once, and still takes a different one', async () => {
      verifyMock.mockResolvedValue({ ok: true, data: found('pass') });
      render(<GateKioskView event={EVENT} />);
      await waitFor(() => expect(scanner.start).toHaveBeenCalled());
      const onScan = scanner.start.mock.calls[0]![2] as (code: string) => Promise<void>;

      await act(async () => {
        await onScan('SF-EVT-E355F430');
      });
      // Past the 1.2s cooldown, the same pass is still being read.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1300));
      });
      await act(async () => {
        await onScan('SF-EVT-E355F430');
        await onScan('SF-EVT-E355F430');
      });
      expect(verifyMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        await onScan('SF-EVT-9A9A9A9A');
      });
      expect(verifyMock).toHaveBeenCalledTimes(2);
      expect(verifyMock).toHaveBeenLastCalledWith(EVENT.id, 'SF-EVT-9A9A9A9A');
    });

    it('lists people admitted before the page was opened, matching the header count', () => {
      const group: AdminEventRegistration = {
        id: REGISTRATION_ID,
        fullName: 'Asha One',
        email: 'asha@example.test',
        phone: '9876543210',
        attendeeCount: 2,
        functionName: 'Dance',
        attendees: [
          {
            fullName: 'Asha One',
            passNumber: 'SF-EVT-E355F430-1',
            checkedInAt: '2026-12-01T04:31:00.000Z',
          },
          { fullName: 'Bina Two', passNumber: 'SF-EVT-E355F430-2', checkedInAt: null },
        ],
        status: 'attended',
        registeredAt: '2026-11-01T04:30:00.000Z',
        attendedAt: '2026-12-01T04:31:00.000Z',
        cancellationReason: null,
      };
      render(<GateKioskView event={EVENT} initialRegistrations={[group]} />);

      expect(screen.getByText('1 / 2 Admitted')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Admitted \(1\)/ }));
      expect(screen.getByText('1 Guests')).toBeInTheDocument();
      expect(screen.getByText('SF-EVT-E355F430-1')).toBeInTheDocument();
      expect(screen.queryByText('SF-EVT-E355F430-2')).not.toBeInTheDocument();
    });
  });
});
