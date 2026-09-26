'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';

import { Alert, Button, Card, Input, Label, Switch, cn, formatCurrency } from '@sailent/ui';
import { emailSchema, phoneSchema } from '@sailent/validation';

import {
  loadRazorpayScript,
  openRazorpayCheckout,
  type CheckoutHandoff,
} from '@/lib/payments/razorpay-checkout';

export interface CheckoutSelection {
  campaignSlug: string;
  campaignTitle: string;
  items: { campaignProductId: string; quantity: number }[];
  customAmount: number;
  /** For display only. The server recomputes the figure it will charge. */
  displayTotal: number;
}

type Stage =
  | { kind: 'form' }
  | { kind: 'creating' }
  | { kind: 'paying' }
  | { kind: 'verifying' }
  | { kind: 'error'; message: string; retryable: boolean };

/**
 * Donor details, then payment.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TOTAL ON SCREEN IS NOT THE TOTAL THAT IS CHARGED.
 *
 * `displayTotal` exists so the donor can see what they are agreeing to. What
 * they are actually charged comes back from the server, which recomputed it
 * from database prices, and the amount shown after this point is the server's.
 * The two agree because both run the same `summariseDonation` — but if they
 * ever disagreed, the server's figure is the one that is right.
 *
 * NOTHING HERE DECIDES THE OUTCOME. Razorpay's success callback carries a
 * signature made with a secret this browser has never seen; it is posted back
 * for the server to verify. A donor who edits this code can change what they
 * see and nothing else.
 *
 * THE WEBHOOK IS THE SAFETY NET. If verification fails here — a dropped
 * connection, a closed laptop — the donation is still recorded when Razorpay
 * calls the server directly. That is why a failed verification says the payment
 * may still complete rather than declaring it lost.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function DonationCheckout({
  selection,
  onBack,
  className,
}: {
  selection: CheckoutSelection;
  onBack?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>({ kind: 'form' });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isAnonymous, setIsAnonymous] = React.useState(false);

  const busy = stage.kind === 'creating' || stage.kind === 'paying' || stage.kind === 'verifying';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const donor = {
      name: String(form.get('name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      anonymous: isAnonymous,
      message: String(form.get('message') ?? '').trim() || undefined,
    };

    /**
     * Client-side validation is a COURTESY, and the same rules run on the
     * server. It exists so a typo is caught before a network round trip, not
     * because anything here is trusted.
     */
    const next: Record<string, string> = {};
    if (donor.name.length < 2) next.name = 'Enter your name';
    const email = emailSchema.safeParse(donor.email);
    if (!email.success) next.email = email.error.issues[0]?.message ?? 'Enter a valid email';
    const phone = phoneSchema.safeParse(donor.phone);
    if (!phone.success)
      next.phone = phone.error.issues[0]?.message ?? 'Enter a valid mobile number';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStage({ kind: 'creating' });

    let handoff: CheckoutHandoff;
    try {
      const response = await fetch('/api/bff/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignSlug: selection.campaignSlug,
          items: selection.items,
          // Omitted rather than sent as zero, so a pure product donation is
          // typed `product` and not `hybrid`.
          ...(selection.customAmount > 0 ? { customAmount: selection.customAmount } : {}),
          donor,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: CheckoutHandoff;
        error?: { message: string; details?: { message?: string }[] };
      };

      if (!response.ok || !payload.success || !payload.data) {
        const detail = payload.error?.details?.[0]?.message;
        setStage({
          kind: 'error',
          message: detail ?? payload.error?.message ?? 'We could not start this donation.',
          retryable: true,
        });
        return;
      }

      handoff = payload.data;
    } catch {
      setStage({
        kind: 'error',
        message: 'We could not reach our server. Nothing has been charged.',
        retryable: true,
      });
      return;
    }

    try {
      await loadRazorpayScript();
    } catch {
      setStage({
        kind: 'error',
        message: 'The payment window could not load. Nothing has been charged.',
        retryable: true,
      });
      return;
    }

    setStage({ kind: 'paying' });
    const outcome = await openRazorpayCheckout(handoff);

    // Closing the payment window is a normal thing to do, and is not an error.
    if (outcome.kind === 'dismissed') {
      setStage({ kind: 'form' });
      return;
    }

    if (outcome.kind === 'failed') {
      setStage({ kind: 'error', message: outcome.reason, retryable: true });
      return;
    }

    setStage({ kind: 'verifying' });

    try {
      const verified = await fetch(`/api/bff/donations/${handoff.donationId}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outcome.result),
      });

      if (!verified.ok) {
        /**
         * Verification failed, but the money may well have been taken — and
         * Razorpay's webhook will record it independently. Sending the donor to
         * the status page is the honest move: it polls, and it will show the
         * donation succeeding a few seconds later if it did.
         *
         * Telling them it failed here would be a guess, and the wrong guess
         * makes somebody pay twice.
         */
        router.push(`/donation/${handoff.reference}`);
        return;
      }

      router.push(`/donation/${handoff.reference}`);
    } catch {
      router.push(`/donation/${handoff.reference}`);
    }
  }

  return (
    <div className={cn('grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start', className)}>
      <Card className="p-6 md:p-8">
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={busy} className="-ml-2 mb-4">
            <ArrowLeft aria-hidden="true" />
            Back to your donation
          </Button>
        ) : null}

        <h2 className="text-h3 font-semibold">Your details</h2>
        <p className="text-body-sm text-muted-foreground mt-2">
          We need these to send your receipt. You do not need an account.
        </p>

        {stage.kind === 'error' ? (
          <Alert variant="destructive" role="alert" className="mt-5">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <span>{stage.message}</span>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <Field id="name" label="Full name" error={errors.name} required>
            <Input id="name" name="name" autoComplete="name" required disabled={busy} />
          </Field>

          <Field
            id="email"
            label="Email"
            error={errors.email}
            required
            hint="Your receipt goes here."
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
            />
          </Field>

          <Field
            id="phone"
            label="Mobile number"
            error={errors.phone}
            required
            hint="Used to find your giving history if you contact us."
          >
            <Input id="phone" name="phone" type="tel" autoComplete="tel" required disabled={busy} />
          </Field>

          <Field id="message" label="Message (optional)">
            <Input id="message" name="message" disabled={busy} />
          </Field>

          <div className="border-border flex items-start gap-3 rounded-lg border p-4">
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              disabled={busy}
            />
            <div>
              <Label htmlFor="anonymous" className="text-body-sm font-medium">
                Give anonymously
              </Label>
              {/* Says exactly what it does. "Anonymous" that still appears on a
                  receipt would be a broken promise, so the scope is stated. */}
              <p className="text-caption text-muted-foreground mt-1">
                Your name will not appear publicly. It still appears on your own receipt, and our
                finance team can always identify a donation.
              </p>
            </div>
          </div>

          {/*
            NO TAX-ID FIELD. A PAN is collected later, from donors who choose to
            claim relief — asking for one at the highest-abandonment step of the
            funnel costs donations for a benefit most people will not use.
          */}

          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {stage.kind === 'creating'
              ? 'Preparing your donation…'
              : stage.kind === 'paying'
                ? 'Waiting for payment…'
                : stage.kind === 'verifying'
                  ? 'Confirming your payment…'
                  : `Pay ${formatCurrency(selection.displayTotal)}`}
          </Button>

          <p className="text-caption text-muted-foreground text-center">
            Payments are handled by Razorpay. We never see your card details.
          </p>
        </form>
      </Card>

      <Card className="p-5 lg:sticky lg:top-24">
        <h2 className="text-h4 font-semibold">Your donation</h2>
        <p className="text-body-sm text-muted-foreground mt-2">{selection.campaignTitle}</p>
        <p data-numeric="" className="font-display text-h2 mt-4 font-bold tabular-nums">
          {formatCurrency(selection.displayTotal)}
        </p>
        <div className="border-border mt-4 space-y-2 border-t pt-4">
          <p className="text-caption text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Your donation is recorded only after our server confirms the payment with Razorpay —
              never on the browser saying it worked.
            </span>
          </p>
          {/*
            Careful wording. A receipt is not an 80G certificate: that is Form
            10BE, issued by the Income Tax Department after the annual filing.
          */}
          <p className="text-caption text-muted-foreground">
            You will receive an itemised receipt by email. Relief under Section 80G is claimed
            separately, through Form 10BE after our annual filing.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
