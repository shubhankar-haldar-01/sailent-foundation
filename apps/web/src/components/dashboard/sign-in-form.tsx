'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';

import { Button, Input, Label, cn } from '@sailent/ui';

import {
  requestSignInCode,
  verifySignInCode,
  type DonorSignInState,
} from '@/lib/auth/donor-actions';

/** How long "Resend OTP" (and "Send OTP" again) waits after a code is sent. */
const RESEND_SECONDS = 30;

/**
 * Donor sign-in: an email address and the one-time code sent to it, both on
 * one screen, as the owner's login design (2026-10-08) lays them out.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO PASSWORD EXISTS (decision A8). Donors authenticate with a six-digit code
 * emailed to an address the foundation already holds — from a donation or a
 * volunteer application. There is no separate sign-up; "Sign Up" on the page
 * explains that rather than pretending otherwise.
 *
 * THE FIRST STEP ALWAYS ADVANCES. The API answers identically whether or not
 * the address belongs to anyone, because anything else would make this a way
 * to ask "has this person donated?". The form says only "if this address
 * matches…" either way.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Two forms, because there are two actions: the address form (also how a code
 * is re-sent) and the code form. The code form appears only once a code has
 * been sent (owner request, 2026-10-08), and focus moves into it. Both inputs
 * are controlled, so React's reset of a form after its action never wipes what
 * somebody typed.
 */
export function DonorSignInForm({ next }: { next?: string }) {
  const [requestState, requestAction, requesting] = useActionState<DonorSignInState, FormData>(
    requestSignInCode,
    {},
  );
  const [verifyState, verifyAction, verifying] = useActionState<DonorSignInState, FormData>(
    verifySignInCode,
    {},
  );

  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  /** "Use a different email?" — back to the address field. */
  const [changingEmail, setChangingEmail] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  /** A message from this component itself (an empty field), before any request. */
  const [localError, setLocalError] = React.useState<string | null>(null);
  /** The code form's result as it stood when the latest code was sent — stale from then on. */
  const [staleVerify, setStaleVerify] = React.useState<DonorSignInState | null>(null);

  const emailRef = React.useRef<HTMLInputElement>(null);
  const codeRef = React.useRef<HTMLInputElement>(null);
  const verifyRef = React.useRef(verifyState);
  /** Set when a code has just been sent: focus the code field once it is on screen. */
  const focusCodeRef = React.useRef(false);

  const sentTo = requestState.sent ? requestState.email : undefined;
  const onCodeStep = Boolean(sentTo) && !changingEmail;
  /** The address the code form signs in with: the one a code went to, or the one being typed. */
  const signInEmail = onCodeStep ? (sentTo ?? '') : email;

  // Declared before the effect below, so it has the latest result when that runs.
  React.useEffect(() => {
    verifyRef.current = verifyState;
  }, [verifyState]);

  // Every answer from the address form: leave "changing" mode. A code sent
  // (or re-sent): hold the address, restart the wait, clear the old code and
  // its message, and move to the code field.
  React.useEffect(() => {
    setChangingEmail(false);
    if (!requestState.sent || !requestState.email || requestState.error) return;
    setEmail(requestState.email);
    setCode('');
    setLocalError(null);
    setStaleVerify(verifyRef.current);
    setCooldown(RESEND_SECONDS);
    focusCodeRef.current = true;
  }, [requestState]);

  // The code field exists only on the code step, so focus it once that renders.
  React.useEffect(() => {
    if (!onCodeStep || !focusCodeRef.current) return;
    focusCodeRef.current = false;
    codeRef.current?.focus();
  }, [onCodeStep, requestState]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const chooseDifferentEmail = () => {
    setChangingEmail(true);
    setCooldown(0);
    setCode('');
    setLocalError(null);
    // Once the field is editable again.
    window.requestAnimationFrame(() => emailRef.current?.focus());
  };

  /** The code form needs an address; say so here rather than after a round trip. */
  const checkBeforeLogin = (event: React.FormEvent<HTMLFormElement>) => {
    if (!signInEmail.trim()) {
      event.preventDefault();
      setLocalError('Enter your email address first, then the code we send to it.');
      emailRef.current?.focus();
    } else {
      setLocalError(null);
    }
  };

  const requestError = changingEmail ? undefined : requestState.error;
  const verifyError = verifyState !== staleVerify ? verifyState.error : undefined;

  return (
    <div className="mt-4">
      <form id="sign-in-request" action={requestAction} noValidate>
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="email" className="text-foreground text-[0.9375rem] font-semibold">
            Email Address
          </Label>
          {onCodeStep ? (
            <button
              type="button"
              onClick={chooseDifferentEmail}
              className="text-primary focus-visible:outline-ring rounded-sm text-[0.8125rem] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Use a different email?
            </button>
          ) : null}
        </div>
        <div className="relative mt-1.5">
          <Mail
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2"
            strokeWidth={1.7}
          />
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            readOnly={onCodeStep}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email address"
            hasError={Boolean(requestError || localError)}
            aria-describedby={
              requestError || localError ? 'email-error' : onCodeStep ? 'email-sent' : undefined
            }
            className={cn(
              'h-11 rounded-xl pl-11 pr-4 text-[0.9375rem]',
              onCodeStep && 'bg-muted/40 text-foreground/80',
            )}
          />
        </div>

        {requestError || localError ? (
          <p id="email-error" role="alert" className="text-destructive mt-1.5 text-[0.8125rem]">
            {requestError ?? localError}
          </p>
        ) : null}
        {onCodeStep && !requestError ? (
          <p
            id="email-sent"
            role="status"
            className="text-muted-foreground mt-1.5 text-[0.8125rem] leading-snug"
          >
            If <strong className="text-foreground font-semibold">{sentTo}</strong> matches a
            donation or a volunteer application, a 6-digit code is on its way. It expires in 10
            minutes.
          </p>
        ) : null}

        {/* Once a code is out, "Resend OTP" below does this job; the button would
            only push the code field down. */}
        {onCodeStep ? null : (
          <Button
            type="submit"
            size="lg"
            disabled={requesting}
            className="mt-2.5 h-11 w-full rounded-full text-base"
          >
            {requesting ? 'Sending…' : 'Send OTP'}
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </form>

      {/* The code step: shown once a code has been sent. */}
      {onCodeStep ? (
        <>
          <div
            aria-hidden="true"
            className="text-muted-foreground my-2.5 flex items-center gap-4 text-[0.8125rem]"
          >
            <span className="bg-border h-px flex-1" />
            Enter OTP
            <span className="bg-border h-px flex-1" />
          </div>

          <form action={verifyAction} onSubmit={checkBeforeLogin} noValidate>
            <input type="hidden" name="email" value={signInEmail} />
            {/*
          Where to go once the code is accepted — e.g. straight back to the event
          someone was trying to register for. The action validates the shape of
          this before redirecting; it arrives from a query string and is therefore
          attacker-controlled. See `safeReturnPath`.
        */}
            {next ? <input type="hidden" name="next" value={next} /> : null}

            <Label htmlFor="code" className="text-foreground text-[0.9375rem] font-semibold">
              OTP
            </Label>
            <div className="relative mt-1.5">
              <ShieldCheck
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2"
                strokeWidth={1.7}
              />
              <Input
                ref={codeRef}
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                // No `maxLength`: it would cut a pasted "123 456" before the spaces
                // are dropped. The change handler keeps the first six digits.
                pattern="\d{6}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                hasError={Boolean(verifyError)}
                aria-describedby={verifyError ? 'code-error' : undefined}
                className="h-11 rounded-xl pl-11 pr-4 text-[0.9375rem] tracking-wide"
              />
            </div>
            {verifyError ? (
              <p id="code-error" role="alert" className="text-destructive mt-1.5 text-[0.8125rem]">
                {verifyError}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={verifying}
              className="mt-2.5 h-11 w-full rounded-full text-base"
            >
              {verifying ? 'Checking…' : 'Login'}
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>
        </>
      ) : null}

      {onCodeStep ? (
        <p className="text-muted-foreground mt-2 text-center text-[0.8125rem]">
          Didn&rsquo;t receive OTP?{' '}
          {cooldown > 0 ? (
            <span className="text-primary font-medium">Resend OTP in {cooldown}s</span>
          ) : (
            <button
              type="submit"
              form="sign-in-request"
              disabled={requesting}
              className="text-primary focus-visible:outline-ring rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            >
              {requesting ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
        </p>
      ) : null}
    </div>
  );
}
