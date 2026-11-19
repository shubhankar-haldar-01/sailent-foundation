import { isPassAdmitted, passesOf } from '@sailent/validation';

import type { GatePass, VerifyPassResponse } from './actions';
import type { AdminEventRegistration } from './api';

/**
 * The gate desk's view of passes, shared by the kiosk and the check-in page.
 *
 * The rules themselves — which passes a booking holds, and whether a person
 * is in — live in `@sailent/validation`, the same functions the API decides
 * with. This file only applies them to what the desk is showing, so a
 * check-in is reflected on screen without waiting for a reload.
 */

/** Every pass on a guest's booking, each with whether that person is in. */
export function guestPasses(guest: AdminEventRegistration): GatePass[] {
  return passesOf(guest).map((pass) => ({ ...pass, admitted: isPassAdmitted(guest, pass) }));
}

/** The guest's booking after `passNumber` was admitted at `at`. */
export function stampGuestPass(
  guest: AdminEventRegistration,
  passNumber: string,
  at: string,
): AdminEventRegistration {
  return {
    ...guest,
    attendees: passesOf(guest).map((pass) =>
      pass.passNumber === passNumber ? { ...pass, checkedInAt: pass.checkedInAt ?? at } : pass,
    ),
    status: 'attended',
    attendedAt: guest.attendedAt ?? at,
  };
}

/**
 * The lookup on screen after `passNumber` on registration `registrationId` was
 * admitted. It turns to "already admitted" once the person it named is in —
 * or, for a group found as a whole, once everyone on it is.
 */
export function admitInVerification(
  previous: VerifyPassResponse | null,
  registrationId: string,
  passNumber: string,
  at: string,
  message: string,
): VerifyPassResponse | null {
  const registration = previous?.registration;
  if (!previous || !registration || registration.id !== registrationId) return previous;

  const mark = (pass: GatePass): GatePass =>
    pass.passNumber === passNumber
      ? { ...pass, admitted: true, checkedInAt: pass.checkedInAt ?? at }
      : pass;

  const allAttendees = registration.allAttendees?.map(mark);
  const matchedAttendee = registration.matchedAttendee
    ? mark(registration.matchedAttendee)
    : registration.matchedAttendee;
  const done = matchedAttendee
    ? matchedAttendee.admitted
    : (allAttendees ?? []).every((pass) => pass.admitted);

  return {
    ...previous,
    valid: done ? false : previous.valid,
    status: done ? 'already_attended' : previous.status,
    message: done ? message : previous.message,
    registration: {
      ...registration,
      status: 'attended',
      attendedAt: registration.attendedAt ?? at,
      matchedAttendee,
      allAttendees,
    },
  };
}

/**
 * May Auto-Admit let this person in without anyone looking?
 *
 * Only for an exact pass match naming one person who is not yet in. A match
 * by name, email or phone (`search`) always waits for a person to check —
 * a QR code carrying someone's name must not open the gate for them.
 */
export function canAutoAdmit(result: VerifyPassResponse): boolean {
  const pass = result.registration?.matchedAttendee;
  return result.status === 'valid' && result.matchedBy === 'pass' && !!pass && !pass.admitted;
}

/** Whether a lookup in this state may still admit people from its pass list. */
export function canAdmitFrom(result: VerifyPassResponse): boolean {
  return result.status === 'valid' || result.status === 'already_attended';
}

/** One admitted person, for the gate desk's Admitted list. */
export interface AdmittedEntry {
  key: string;
  registrationId: string;
  name: string;
  passNumber: string;
  functionName: string | null;
  /** When they were admitted, or null for a booking marked attended before passes were stamped. */
  admittedAt: string | null;
}

/**
 * Everyone admitted to the event, newest first, read from the guest list.
 *
 * It used to be a list kept in the page and filled only by this desk's own
 * check-ins, so a reload emptied it ("Admitted (0)") while the header still
 * counted people in. Built from the guest data it survives a reload, includes
 * every desk's admissions as of the page load, and always agrees with the
 * header's count.
 */
export function admittedEntries(guests: AdminEventRegistration[]): AdmittedEntry[] {
  return guests
    .filter((guest) => guest.status !== 'cancelled')
    .flatMap((guest) =>
      guestPasses(guest)
        .filter((pass) => pass.admitted)
        .map((pass) => ({
          key: `${guest.id}:${pass.passNumber}`,
          registrationId: guest.id,
          name: pass.fullName || guest.fullName,
          passNumber: pass.passNumber,
          functionName: guest.functionName ?? null,
          admittedAt: pass.checkedInAt ?? guest.attendedAt ?? null,
        })),
    )
    .sort((a, b) => (b.admittedAt ?? '').localeCompare(a.admittedAt ?? ''));
}
