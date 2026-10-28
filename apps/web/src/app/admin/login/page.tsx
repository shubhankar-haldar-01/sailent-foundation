'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Alert, Button, Input, Label, Card, CardContent } from '@sailent/ui';
import { Lock } from 'lucide-react';

import { signIn, type LoginState } from '@/lib/auth/actions';

/**
 * Staff sign-in.
 *
 * Deliberately plain and secure. This page's only jobs are to take two fields and to be
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
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-3 inline-flex">
            <Image
              src="/images/sailent-logo.png"
              alt="Sailent Foundation"
              width={2048}
              height={746}
              priority
              className="h-12 w-auto object-contain sm:h-14"
            />
          </Link>
          <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
            Sailent Foundation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Staff Administration Console</p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-8">
            <form action={action} className="space-y-4">
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
                  placeholder="admin@sailent.org"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/admin/forgot-password"
                    className="text-primary text-xs hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                />
              </div>

              {/* Revealed only once the API asks for it, so accounts that do not
                  use a second factor never see an empty box they must ignore. */}
              {state.needsTotp ? (
                <div className="border-border mt-3 space-y-1.5 border-t pt-1">
                  <div className="text-warning mb-1 flex items-center gap-1.5 text-xs font-medium">
                    <Lock className="h-3.5 w-3.5" />
                    Two-Factor Authentication Required
                  </div>
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
                    className="text-center font-mono text-lg tracking-widest"
                  />
                  <p className="text-muted-foreground text-xs">
                    Enter the six-digit code from your authenticator app.
                  </p>
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                disabled={pending}
                className="mt-2"
              >
                {pending ? 'Signing in…' : 'Sign in to Console'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Protected administrative system. Unauthorized access attempts are monitored and logged.
        </p>
      </div>
    </main>
  );
}
