'use client';

import * as React from 'react';
import Link from 'next/link';
import { Alert, Button, Input, Label } from '@sailent/ui';
import { STAFF_PASSWORD_MIN } from '@sailent/validation';

import {
  acceptInvitation,
  resetPassword,
  type StaffAccountState,
} from '@/lib/auth/staff-account-actions';

/** The token from `#token=…`. Read in the browser: a fragment never reaches a server. */
function useFragmentToken(): string | null | undefined {
  const [token, setToken] = React.useState<string | null | undefined>(undefined);
  React.useEffect(() => {
    const match = /(?:^|[#&])token=([A-Za-z0-9_-]{43})(?:&|$)/.exec(window.location.hash);
    setToken(match?.[1] ?? null);
    // Out of the address bar, history and any screenshot.
    if (match) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return token;
}

/**
 * Set a password from an emailed link (Phase 13): accept an invitation, or
 * reset a forgotten password. One form, two endpoints.
 */
export function StaffPasswordForm({ mode }: { mode: 'invite' | 'reset' }) {
  const token = useFragmentToken();
  const [state, action, pending] = React.useActionState<StaffAccountState, FormData>(
    mode === 'invite' ? acceptInvitation : resetPassword,
    {},
  );

  if (token === undefined) return null;

  if (state.ok) {
    return (
      <div className="space-y-4">
        <Alert role="status">
          {mode === 'invite'
            ? 'Your password is set and the account is active.'
            : 'Your password has been changed, and every existing session has been signed out.'}
        </Alert>
        <Button asChild fullWidth size="lg">
          <Link href="/admin/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!token) {
    return (
      <Alert variant="destructive">
        This link is incomplete. Open it again from the email
        {mode === 'invite'
          ? ', or ask an administrator to send a new invitation.'
          : ', or ask for a new reset link.'}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={STAFF_PASSWORD_MIN}
          required
          autoFocus
          aria-describedby="password-help"
          hasError={!!state.fieldErrors?.password}
        />
        <p id="password-help" className="text-caption text-muted-foreground">
          {state.fieldErrors?.password ?? `At least ${STAFF_PASSWORD_MIN} characters.`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Type it again</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          hasError={!!state.fieldErrors?.confirmPassword}
        />
        {state.fieldErrors?.confirmPassword ? (
          <p className="text-caption text-destructive">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>

      <Button type="submit" fullWidth size="lg" disabled={pending}>
        {pending ? 'Saving…' : mode === 'invite' ? 'Set my password' : 'Change my password'}
      </Button>
    </form>
  );
}
