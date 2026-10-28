'use client';

import * as React from 'react';
import Link from 'next/link';
import { Alert, Button, Input, Label, Card, CardContent } from '@sailent/ui';
import { KeyRound, ArrowLeft } from 'lucide-react';

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
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-primary/10 text-primary mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
            Reset Password
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Enter your staff email to receive a password reset link.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-8">
            {state.ok ? (
              <div className="space-y-4">
                <Alert role="status">
                  If that address belongs to an active staff account, a reset link is on its way. It
                  works once, for one hour.
                </Alert>
                <Button asChild variant="secondary" fullWidth size="lg">
                  <Link href="/admin/login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to sign-in
                  </Link>
                </Button>
              </div>
            ) : (
              <form action={action} className="space-y-4">
                {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Staff email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    autoFocus
                    placeholder="name@sailent.org"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  disabled={pending}
                  className="mt-2"
                >
                  {pending ? 'Sending reset link…' : 'Send password reset link'}
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    href="/admin/login"
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    ← Back to sign-in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
