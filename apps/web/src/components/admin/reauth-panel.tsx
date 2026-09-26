'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

import { Button, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { reauthenticate, type ActionState } from '@/lib/admin/actions';

/**
 * Confirm your password again, for something sensitive.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SHOWN IN PLACE OF THE CONTENT, NOT OVER IT.
 *
 * The data behind a sensitive route has not been fetched — the API refused —
 * so there is nothing underneath to dim. A modal over an empty page would
 * imply the content is there and merely covered, which is the opposite of what
 * happened.
 *
 * The TOTP field is always offered rather than shown conditionally. Whether a
 * given operator has a second factor is a property of their account that this
 * component would have to be told, and an optional field labelled "if you have
 * one" costs an operator who does not exactly nothing.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * On success it refreshes the route rather than navigating: the window is now
 * open, and the same URL will now return the data that was refused a moment
 * ago.
 */
export function ReauthPanel({
  returnTo,
  what,
}: {
  returnTo: string;
  /** What is behind the wall, in a few words, so the prompt is not mysterious. */
  what: string;
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(reauthenticate, {});
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <div className="border-border mx-auto max-w-md rounded-lg border p-6">
      <h2 className="text-h4 flex items-center gap-2 font-semibold">
        <ShieldAlert className="text-warning size-5 shrink-0" aria-hidden="true" />
        Confirm it is you
      </h2>
      <p className="text-body-sm text-muted-foreground mt-2">
        {what} This asks for your password again, and the confirmation lasts five minutes.
      </p>

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <FormStatus state={state} />

        <Field label="Password" name="password" errors={state.fieldErrors} required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
        </Field>

        <Field
          label="Authentication code"
          name="totpCode"
          errors={state.fieldErrors}
          hint="If your account has two-factor authentication."
        >
          <Input
            id="totpCode"
            name="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="max-w-32"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending}>Confirm</SubmitButton>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Go back
          </Button>
        </div>
      </form>
    </div>
  );
}
