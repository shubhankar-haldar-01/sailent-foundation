'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, Button, Input, Label } from '@sailent/ui';

import {
  requestSignInCode,
  verifySignInCode,
  type DonorSignInState,
} from '@/lib/auth/donor-actions';

/**
 * Donor sign-in, in two steps.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO PASSWORD EXISTS, AND THE COPY SAYS SO RATHER THAN HIDING IT.
 *
 * Donors authenticate by a one-time code sent to the email address they gave
 * with their donation (decision A8). There is no password to set, forget or
 * reset, and there is no "create an account" step: an account is created BY a
 * donation, and this is how it is claimed afterwards.
 *
 * That last part is the thing people get stuck on, so the form says it plainly
 * under the address field instead of letting somebody discover it only after
 * typing a correct code.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FIRST STEP ALWAYS ADVANCES. The API answers identically whether or not
 * the address belongs to a donor, because anything else would make this a way
 * to ask "has this person donated?". The form must not undo that by only moving
 * on when the address is known.
 */
function Submit({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function DonorSignInForm({ next }: { next?: string }) {
  const [requestState, requestAction] = useActionState<DonorSignInState, FormData>(
    requestSignInCode,
    {},
  );
  const [verifyState, verifyAction] = useActionState<DonorSignInState, FormData>(
    verifySignInCode,
    {},
  );

  // Once a code has been sent we stay on the second step, even after a wrong
  // code — sending the donor back to the address field would mean a new code.
  const email = verifyState.email ?? requestState.email;
  const onCodeStep = Boolean(email) && (verifyState.sent || requestState.sent);

  if (!onCodeStep) {
    return (
      <form action={requestAction} className="space-y-4" noValidate>
        {requestState.error ? (
          <Alert variant="destructive" role="alert">
            {requestState.error}
          </Alert>
        ) : null}

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="you@example.com"
            aria-describedby="email-help"
          />
          <p id="email-help" className="text-caption text-muted-foreground mt-2">
            The address you gave with your donation. Your account is created by your first donation
            — there is no separate sign-up, and no password.
          </p>
        </div>

        <Submit pendingLabel="Sending…">Send me a code</Submit>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4" noValidate>
      {verifyState.error ? (
        <Alert variant="destructive" role="alert">
          {verifyState.error}
        </Alert>
      ) : (
        <Alert variant="info">
          If <strong>{email}</strong> matches a donation, a six-digit code is on its way to that
          address.
        </Alert>
      )}

      <input type="hidden" name="email" value={email ?? ''} />
      {/*
        Where to go once the code is accepted — e.g. straight back to the event
        someone was trying to register for. The action validates the shape of
        this before redirecting; it arrives from a query string and is therefore
        attacker-controlled. See `safeReturnPath`.
      */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <Label htmlFor="code">Six-digit code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          pattern="\d{6}"
          placeholder="000000"
          className="text-center text-xl tracking-[0.4em]"
        />
        <p className="text-caption text-muted-foreground mt-2">
          It expires in 10 minutes and can be used once.
        </p>
      </div>

      <Submit pendingLabel="Checking…">Sign in</Submit>

      <p className="text-caption text-muted-foreground text-center">
        Wrong address?{' '}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-info-action focus-visible:outline-ring rounded-sm font-medium underline underline-offset-4 focus-visible:outline-2"
        >
          Start again
        </button>
      </p>
    </form>
  );
}
