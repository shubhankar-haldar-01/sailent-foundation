'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Card, Input, Label } from '@sailent/ui';

import { registerForEvent, type DonorActionState } from '@/lib/donor/actions';

/**
 * Register for an event.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS NO EMAIL FIELD, AND THAT IS THE SECURITY PROPERTY.
 *
 * A registration is keyed on (event, email). If this form collected an address
 * and the server trusted it, anybody could register under somebody else's
 * address — taking their place, and locking them out of the event, because the
 * duplicate check would then find the attacker's row against their name.
 *
 * So the address comes from the signed-in donor's record, server-side. The
 * form asks only for what genuinely varies: who is coming (the account holder
 * is not always the attendee), a number that can be reached on the day, and
 * how many people.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Capacity is NOT enforced here. `seatsLeft` is shown so somebody registering
 * a group of four can see there are two places, but the arithmetic that counts
 * is done by the API under a row lock — two people submitting at once is a race
 * this form has no way to arbitrate, and pretending otherwise would put the
 * only real check behind a disabled button.
 */
function Submit({ seatsLeft }: { seatsLeft: number | null }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth disabled={pending}>
      {pending ? 'Registering…' : seatsLeft === null ? 'Register' : 'Register my place'}
    </Button>
  );
}

export function EventRegistrationForm({
  eventId,
  slug,
  seatsLeft,
}: {
  eventId: string;
  slug: string;
  /** Null when the event is uncapped. */
  seatsLeft: number | null;
}) {
  const [state, action] = useActionState<DonorActionState, FormData>(registerForEvent, {});
  const ids = { name: React.useId(), phone: React.useId(), attendees: React.useId() };

  /*
    The cap on the stepper is the SMALLER of the seats left and a sensible group
    size. Offering "up to 20" on an event with three places left invites a
    submission the server is bound to refuse.
  */
  const maxAttendees = seatsLeft === null ? 20 : Math.max(1, Math.min(20, seatsLeft));

  return (
    <Card className="p-5">
      <h2 className="text-h4 font-semibold">Register to attend</h2>
      {seatsLeft !== null ? (
        <p className="text-caption text-muted-foreground mt-1" data-numeric="">
          {seatsLeft === 1 ? '1 place left' : `${seatsLeft} places left`}
        </p>
      ) : null}

      <form action={action} className="mt-4 space-y-4" noValidate>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="slug" value={slug} />

        {state.error ? (
          <Alert variant="destructive" role="alert">
            {state.error}
          </Alert>
        ) : null}

        <div>
          <Label htmlFor={ids.name}>Name of the person attending</Label>
          <Input
            id={ids.name}
            name="fullName"
            autoComplete="name"
            placeholder="Leave blank to use the name on your account"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor={ids.phone}>A number we can reach on the day</Label>
          <Input
            id={ids.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Leave blank to use the number on your account"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor={ids.attendees}>How many of you are coming?</Label>
          <Input
            id={ids.attendees}
            name="attendeeCount"
            type="number"
            min={1}
            max={maxAttendees}
            defaultValue={1}
            className="mt-1.5 max-w-24"
            data-numeric=""
          />
        </div>

        <Submit seatsLeft={seatsLeft} />

        <p className="text-caption text-muted-foreground">
          We will email you a confirmation. Your place is free, and you can cancel it at any time.
        </p>
      </form>
    </Card>
  );
}
