'use client';

import * as React from 'react';
import Link from 'next/link';

import { Alert, Button, Input, Label } from '@sailent/ui';

import { signIn, type LoginState } from '@/lib/auth/actions';

/**
 * Staff sign-in.
 *
 * Deliberately plain. This page's only jobs are to take two fields and to be
 * unambiguous about failure — the API returns the same message for an unknown
 * address and a wrong password, and this page does not embellish it, because
 * the whole point of that uniformity is that it cannot be used to discover
 * which accounts exist.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE FIELDS ARE CONTROLLED, AND THAT IS NOT A STYLE CHOICE.
 *
 * React 19 RESETS an uncontrolled form once its action completes. For a
 * single-step sign-in that is invisible — a success navigates away, and a
 * failure means retyping anyway. For an account with a second factor it broke
 * the flow outright:
 *
 *   1. Type email and password. Submit.
 *   2. The API asks for a code, and the field below appears.
 *   3. …with the email and password now BLANK, because React cleared them.
 *   4. Type the code, submit, and the request goes out with no credentials.
 *
 * Step 4 comes back as "Those details do not match an account", which is true
 * and completely misleading — the details were right, the form threw them
 * away. Super Admin and Finance were the only roles affected, because they are
 * the only ones with TOTP, so it looked like their passwords were wrong.
 *
 * Holding the values in client state keeps them across the re-render. The
 * password lives ONLY here — it is never sent back from the server and never
 * written into the rendered HTML, which is what a `defaultValue` fix would
 * have done.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default function AdminLoginPage() {
  const [state, action, pending] = React.useActionState<LoginState, FormData>(signIn, {});
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <main className="bg-surface-sunken grid min-h-dvh place-items-center px-4 py-12">
      <div className="bg-surface border-border w-full max-w-sm rounded-xl border p-7 shadow-sm">
        <h1 className="font-display text-h2 font-bold tracking-tight">Staff sign-in</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Sailent Foundation administration.
        </p>

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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {/* Revealed only once the API asks for it, so accounts that do not
              use a second factor never see an empty box they must ignore. */}
          {state.needsTotp ? (
            <div className="space-y-1.5">
              <Label htmlFor="totpCode">Authenticator code</Label>
              <Input
                id="totpCode"
                name="totpCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                required
                autoFocus
              />
              <p className="text-caption text-muted-foreground">
                The six-digit code from your authenticator app.
              </p>
            </div>
          ) : null}

          <Button type="submit" fullWidth size="lg" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <Link
            href="/admin/forgot-password"
            className="text-body-sm text-primary block text-center underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        </form>
      </div>
    </main>
  );
}
