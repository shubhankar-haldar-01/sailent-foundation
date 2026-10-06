'use client';

import * as React from 'react';
import Link from 'next/link';
import { Alert, Button, Input, Label } from '@sailent/ui';

import { requestPasswordReset, type StaffAccountState } from '@/lib/auth/staff-account-actions';

/**
 * Ask for a password-reset link (Phase 13).
 *
 * The answer is the same whether or not the address belongs to a staff
 * account, so this page cannot be used to find out who works here.
 */
export default function ForgotPasswordPage() {
  const [state, action, pending] = React.useActionState<StaffAccountState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <main className="bg-surface-sunken grid min-h-dvh place-items-center px-4 py-12">
      <div className="bg-surface border-border w-full max-w-sm rounded-xl border p-7 shadow-sm">
        <h1 className="font-display text-h2 font-bold tracking-tight">Forgot your password?</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Enter your staff email address and we will send a link to choose a new one.
        </p>

        {state.ok ? (
          <div className="mt-7 space-y-4">
            <Alert role="status">
              If that address belongs to an active staff account, a reset link is on its way. It
              works once, for one hour.
            </Alert>
            <Link href="/admin/login" className="text-body-sm text-primary underline">
              Back to sign-in
            </Link>
          </div>
        ) : (
          <form action={action} className="mt-7 space-y-4">
            {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <Button type="submit" fullWidth size="lg" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
            </Button>
            <Link href="/admin/login" className="text-body-sm text-primary block underline">
              Back to sign-in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
