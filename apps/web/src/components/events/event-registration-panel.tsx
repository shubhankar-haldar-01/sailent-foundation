import Link from 'next/link';
import { CalendarX2, Check, Link2, Lock } from 'lucide-react';
import { Button, Card, formatDate } from '@sailent/ui';

import { EventRegistrationForm } from './event-registration-form';
import { CancelRegistrationButton } from './cancel-registration-button';
import { currentDonor } from '@/lib/auth/donor-session';
import { donorFetch } from '@/lib/donor/api';
import type { SailentEvent } from '@/lib/mock/types';

/**
 * Everything to the right of an event: whether you can register, and whether
 * you already have.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SERVER COMPONENT THAT DECIDES, AND A CLIENT COMPONENT THAT SUBMITS.
 *
 * The decision needs the donor's session and their existing registration, and
 * both are server-side facts. Rendering the form and then discovering the
 * answer from a fetch would flash a register button at somebody who is already
 * registered, which is how people end up clicking it.
 *
 * NOTHING HERE IS THE ENFORCEMENT POINT. The API checks capacity, the
 * deadline and the event's state under a row lock, because two people
 * submitting at the same instant is a race no page can arbitrate. This decides
 * only what to SHOW, which is a different job and is allowed to be a moment
 * out of date.
 * ══════════════════════════════════════════════════════════════════════════
 */

interface MyRegistration {
  id: string;
  status: 'registered' | 'confirmed' | 'attended' | 'no_show' | 'cancelled' | 'waitlisted';
  attendeeCount: number;
  meetingUrl: string | null;
}

/**
 * The donor's own registration, or null.
 *
 * A failure here — expired session, API down — is swallowed deliberately. The
 * event page must still render; the worst outcome of getting this wrong is
 * that somebody is shown a register button and the API tells them they are
 * already registered, which is a clear message rather than a blank page.
 */
async function myRegistration(eventId: string | undefined): Promise<MyRegistration | null> {
  // No id means the page is rendering from the fixture fallback with the API
  // unreachable. There is nothing to ask about, and asking would throw.
  if (!eventId) return null;

  try {
    return await donorFetch<MyRegistration>(`events/${eventId}/registration`);
  } catch {
    return null;
  }
}

export async function EventRegistrationPanel({ event }: { event: SailentEvent }) {
  const isPast = new Date(event.startsAt).getTime() < Date.now();
  const lifecycle = event.lifecycle ?? (event.status === 'registration_open' ? 'open' : 'closed');

  // A cancelled event is checked FIRST, before the date and before capacity.
  // Somebody arriving at a cancelled camp needs to read that it is off, not
  // that they are late or that it is full.
  if (lifecycle === 'cancelled') {
    return (
      <Card className="border-destructive/30 bg-destructive-subtle p-5">
        <h2 className="text-h4 flex items-center gap-2 font-semibold">
          <CalendarX2 className="size-4 shrink-0" aria-hidden="true" />
          This event has been cancelled
        </h2>
        <p className="text-body-sm text-muted-foreground mt-2">
          It will not take place. If you had registered, we have emailed you.
        </p>
        <Button asChild variant="secondary" fullWidth className="mt-4">
          <Link href="/events">See upcoming events</Link>
        </Button>
      </Card>
    );
  }

  if (isPast || lifecycle === 'completed') {
    return (
      <Card className="p-5">
        <p className="text-body-sm text-muted-foreground">
          This event has finished. Upcoming events are listed on the events page.
        </p>
        <Button asChild variant="secondary" fullWidth className="mt-4">
          <Link href="/events">See upcoming events</Link>
        </Button>
      </Card>
    );
  }

  /*
    ══════════════════════════════════════════════════════════════════════════
    THE ORDER OF THE REMAINING BRANCHES IS THE WHOLE OF THIS COMPONENT.

      1. Do you already hold a place?   — outranks everything below it
      2. Can anybody join at all?       — a fact about the event
      3. Are you signed in?             — a fact about the visitor

    Each ordering mistake here has its own failure, and both were made before
    settling on this one:

      • Session first, availability second, sent a signed-out visitor to a
        sign-in form so they could reach a registration form that does not
        exist, because the event was full.

      • Availability first, registration second, told somebody who HAD a place
        at a full event that the event was full — hiding their own booking, and
        the joining link with it, precisely because other people had booked.
    ══════════════════════════════════════════════════════════════════════════
  */
  const donor = await currentDonor();
  const registration = donor ? await myRegistration(event.id) : null;
  const holdsPlace = registration !== null && registration.status !== 'cancelled';

  if (holdsPlace) {
    return (
      <Card className="border-success/30 bg-success-subtle p-5">
        <h2 className="text-h4 flex items-center gap-2 font-semibold">
          <Check className="text-success size-4 shrink-0" aria-hidden="true" />
          You are registered
        </h2>
        <p className="text-body-sm text-muted-foreground mt-2">
          {formatDate(event.startsAt)}
          {registration.attendeeCount > 1 ? ` · ${registration.attendeeCount} places` : null}
        </p>

        {/*
          The joining link, released here and on no public endpoint. It reaches
          this page only because the request carried a donor session and the API
          returned the row that donor owns.
        */}
        {registration.meetingUrl ? (
          <p className="text-body-sm mt-3">
            <a
              href={registration.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info-action focus-visible:outline-ring inline-flex items-center gap-1.5 rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Link2 className="size-3.5" aria-hidden="true" />
              Joining link
            </a>
          </p>
        ) : null}

        <div className="border-border mt-4 border-t pt-4">
          {/* `event.id` is non-null here by construction: a registration was
              only looked up because there was an id to look it up by. */}
          <CancelRegistrationButton eventId={event.id!} slug={event.slug} />
          <p className="text-caption text-muted-foreground mt-2">
            If you cannot come, cancelling frees your place for somebody else.
          </p>
        </div>
      </Card>
    );
  }

  const seatsLeft =
    event.capacity === null ? null : Math.max(0, event.capacity - event.registeredCount);
  const isFull = lifecycle === 'full' || (seatsLeft !== null && seatsLeft === 0);
  const deadlinePassed =
    event.registrationDeadline !== null &&
    event.registrationDeadline !== undefined &&
    new Date(event.registrationDeadline).getTime() <= Date.now();

  if (isFull || lifecycle === 'closed' || deadlinePassed) {
    return (
      <Card className="p-5">
        <h2 className="text-h4 font-semibold">
          {isFull ? 'This event is full' : 'Registration is closed'}
        </h2>
        <p className="text-body-sm text-muted-foreground mt-2">
          {isFull
            ? 'Every place has been taken. Places sometimes open up when somebody cancels, so it is worth checking back.'
            : deadlinePassed
              ? `Registration closed on ${formatDate(event.registrationDeadline!)}.`
              : 'Registration for this event is not open.'}
        </p>
        <Button asChild variant="secondary" fullWidth className="mt-4">
          <Link href="/events">See other events</Link>
        </Button>
      </Card>
    );
  }

  /*
    Signed out: an invitation to sign in, carrying the way back.

    Registration requires an account because a registration has to belong to
    somebody the server identified — otherwise anybody could cancel a
    stranger's place by typing their address. The account is the existing
    passwordless one, so the cost is a six-digit code rather than a password.
  */
  if (!donor) {
    return (
      <Card className="p-5">
        <h2 className="text-h4 font-semibold">Register to attend</h2>
        <p className="text-body-sm text-muted-foreground mt-2">
          Sign in with your email address and we will send you a six-digit code. There is no
          password to create.
        </p>
        <Button asChild fullWidth size="lg" className="mt-4">
          <Link href={`/sign-in?next=/events/${event.slug}`}>
            <Lock className="size-4" aria-hidden="true" />
            Sign in to register
          </Link>
        </Button>
      </Card>
    );
  }

  /*
    No id means this page is rendering from the fixture fallback, with the API
    unreachable. A register button that cannot name an event would fail on
    submit, so it is not offered — the page still reads correctly without it.
  */
  if (!event.id) {
    return (
      <Card className="p-5">
        <p className="text-body-sm text-muted-foreground">
          Registration is unavailable at the moment. Please try again shortly.
        </p>
      </Card>
    );
  }

  return (
    /*
      No name is passed down. The donor session carries an id and permissions,
      not a profile — and it does not need to: the API falls back to the name
      on the donor record when the field is left empty, which is the same value
      this page would have had to fetch to prefill it.
    */
    <EventRegistrationForm eventId={event.id} slug={event.slug} seatsLeft={seatsLeft} />
  );
}
