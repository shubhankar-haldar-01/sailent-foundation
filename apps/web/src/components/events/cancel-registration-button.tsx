'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button } from '@sailent/ui';

import { cancelEventRegistration, type DonorActionState } from '@/lib/donor/actions';

/**
 * Give up a place.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO CLICKS, NOT ONE.
 *
 * A single destructive button in a card somebody opened to check a date is a
 * button that gets pressed by accident — and the consequence here is losing a
 * place at an event that may be full, which is not recoverable by pressing it
 * again.
 *
 * The confirmation is INLINE rather than a dialog: it needs no focus trap, no
 * portal and no escape handling to be correct, and it cannot be dismissed by a
 * stray click the way a modal backdrop can.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * No registration id is sent. The API resolves the row from the session, so
 * there is no parameter by which this form could cancel somebody else's place.
 */
function Confirm() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? 'Cancelling…' : 'Yes, cancel my place'}
    </Button>
  );
}

export function CancelRegistrationButton({ eventId, slug }: { eventId: string; slug: string }) {
  const [state, action] = useActionState<DonorActionState, FormData>(cancelEventRegistration, {});
  const [confirming, setConfirming] = React.useState(false);

  if (!confirming) {
    return (
      <>
        {state.error ? (
          <Alert variant="destructive" role="alert" className="mb-3">
            {state.error}
          </Alert>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          Cancel my registration
        </Button>
      </>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />

      {state.error ? (
        <Alert variant="destructive" role="alert">
          {state.error}
        </Alert>
      ) : null}

      <p className="text-body-sm" role="status">
        Cancel your place at this event?
      </p>
      <div className="flex flex-wrap gap-2">
        <Confirm />
        <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming(false)}>
          Keep my place
        </Button>
      </div>
    </form>
  );
}
