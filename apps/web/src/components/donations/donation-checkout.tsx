'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  Spinner,
  Switch,
  cn,
  fieldErrorProps,
  formatCurrency,
} from '@sailent/ui';
import { emailSchema, phoneSchema } from '@sailent/validation';

import { attemptFor, basketKey, type CheckoutAttempt } from '@/lib/payments/checkout-attempt';
import {
  forgetAttempt,
  saveAttempt,
  saveDonor,
  selectionKey,
  storedAttempt,
  storedDonor,
  verdictFor,
  type CheckoutDonorDetails,
} from '@/lib/payments/checkout-session';
import {
  loadRazorpayScript,
  openRazorpayCheckout,
  type CheckoutHandoff,
} from '@/lib/payments/razorpay-checkout';
import { useRevealResult } from '@/lib/ui/reveal-result';

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
  | { kind: 'checking' }
  | { kind: 'creating' }
  | { kind: 'paying' }
  | { kind: 'verifying' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string; retryable: boolean; reference?: string };

type FieldName = 'name' | 'email' | 'phone';
const FIELD_ORDER: FieldName[] = ['name', 'email', 'phone'];

/** One field's rule; the same rules run again on the server. */
function validateField(field: FieldName, value: string): string | null {
  const trimmed = value.trim();
  if (field === 'name') return trimmed.length < 2 ? 'Enter your name' : null;
  if (field === 'email') {
    const result = emailSchema.safeParse(trimmed);
    return result.success ? null : (result.error.issues[0]?.message ?? 'Enter a valid email');
  }
  const result = phoneSchema.safeParse(trimmed);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Enter a valid mobile number');
}

/** The donation's status on the server, or `unreachable`. */
async function donationStatus(reference: string): Promise<string | null | 'unreachable'> {
  try {
    const response = await fetch(`/api/bff/donations/${encodeURIComponent(reference)}`, {
      cache: 'no-store',
    });
    if (response.status === 404) return null;
    const payload = (await response.json()) as { success?: boolean; data?: { status?: string } };
    return payload.success && payload.data?.status ? payload.data.status : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

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
 *
 * NEVER TWICE (Phase 3 of the UI feedback system, 2026-11-19). A second press
 * of Pay while one is under way is ignored. An earlier attempt for the same
 * basket, remembered by this tab (`checkout-session.ts`), is checked with the
 * server before anything is created: paid goes to the receipt, still open
 * reopens the same order, finished starts afresh. Closing Razorpay is
 * "cancelled", not an error, and the donor's details stay for a retry.
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
  // A payment's outcome here (failed, cancelled) is brought into view and focused.
  const resultRef = useRevealResult(
    stage.kind === 'error' || stage.kind === 'cancelled' ? stage : null,
  );
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({});
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  /*
    The current attempt: the donation and order already created for this exact
    request, reused when the donor tries again (Phase 11, `checkout-attempt.ts`),
    and remembered by this tab (`checkout-session.ts`).
  */
  const attemptRef = React.useRef<CheckoutAttempt | null>(null);
  const submitting = React.useRef(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const basket = React.useMemo(() => selectionKey(selection), [selection]);
  // Details remembered from earlier in this visit; the inputs remount once to show them.
  const [prefill, setPrefill] = React.useState<{
    version: number;
    donor: CheckoutDonorDetails | null;
  }>({ version: 0, donor: null });

  const busy =
    stage.kind === 'checking' ||
    stage.kind === 'creating' ||
    stage.kind === 'paying' ||
    stage.kind === 'verifying';

  /** Paid or being confirmed: show the result, and never take a second payment. */
  const showResult = React.useCallback(
    (reference: string) => {
      router.replace(`/donation/${reference}`);
    },
    [router],
  );

  // On arrival: restore what this tab remembers, and settle an earlier attempt.
  React.useEffect(() => {
    let cancelled = false;
    const donor = storedDonor();
    if (donor) {
      setPrefill({ version: 1, donor });
      setIsAnonymous(donor.anonymous);
    }
    const earlier = storedAttempt(basket);
    if (!earlier?.handoff?.reference) return;
    const reference = earlier.handoff.reference;
    void donationStatus(reference).then((status) => {
      if (cancelled || status === 'unreachable') return;
      const verdict = verdictFor(status);
      if (verdict === 'show-result') {
        if (status === 'successful') forgetAttempt();
        showResult(reference);
      } else if (verdict === 'reopen') {
        attemptRef.current = earlier;
      } else {
        forgetAttempt();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [basket, showResult]);

  function onFieldBlur(field: FieldName, value: string) {
    setErrors((current) => ({ ...current, [field]: validateField(field, value) ?? undefined }));
  }

  function onFieldChange(field: FieldName, value: string) {
    // Corrected live once shown, so the donor sees the moment it is right.
    if (!errors[field]) return;
    setErrors((current) => ({ ...current, [field]: validateField(field, value) ?? undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A second press before the first has finished does nothing.
    if (submitting.current) return;
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
    const next: Partial<Record<FieldName, string>> = {};
    for (const field of FIELD_ORDER) {
      const error = validateField(field, donor[field]);
      if (error) next[field] = error;
    }
    setErrors(next);
    const firstInvalid = FIELD_ORDER.find((field) => next[field]);
    if (firstInvalid) {
      const input = formRef.current?.querySelector<HTMLInputElement>(`#${firstInvalid}`);
      input?.scrollIntoView?.({ block: 'center' });
      input?.focus({ preventScroll: true });
      return;
    }

    submitting.current = true;
    try {
      await pay(donor);
    } finally {
      submitting.current = false;
    }
  }

  async function pay(donor: CheckoutDonorDetails) {
    saveDonor(donor);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStage({
        kind: 'error',
        message: 'You’re offline. Check your connection, then try again. Nothing has been charged.',
        retryable: true,
      });
      return;
    }

    const requestBody = {
      campaignSlug: selection.campaignSlug,
      items: selection.items,
      // Omitted rather than sent as zero, so a pure product donation is
      // typed `product` and not `hybrid`.
      ...(selection.customAmount > 0 ? { customAmount: selection.customAmount } : {}),
      donor,
    };
    const attempt = attemptFor(attemptRef.current, basketKey(requestBody));
    attemptRef.current = attempt;

    // An earlier attempt for this request: ask the server what became of it first.
    if (attempt.handoff?.reference) {
      setStage({ kind: 'checking' });
      const status = await donationStatus(attempt.handoff.reference);
      if (status === 'unreachable') {
        setStage({
          kind: 'error',
          message: 'We could not reach our server. Nothing new has been charged.',
          retryable: true,
          reference: attempt.handoff.reference,
        });
        return;
      }
      const verdict = verdictFor(status);
      if (verdict === 'show-result') {
        showResult(attempt.handoff.reference);
        return;
      }
      if (verdict === 'start-afresh') {
        forgetAttempt();
        attemptRef.current = attemptFor(null, basketKey(requestBody));
        return pay(donor);
      }
    }

    setStage({ kind: 'creating' });

    // The same request as last time reopens its order rather than creating a
    // second donation for it; otherwise the donation is created now.
    if (!attempt.handoff) {
      try {
        const response = await fetch('/api/bff/donations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.idempotencyKey,
          },
          body: JSON.stringify(requestBody),
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

        attempt.handoff = payload.data;
        saveAttempt(basket, attempt);
      } catch {
        setStage({
          kind: 'error',
          message: 'We could not reach our server. Nothing has been charged.',
          retryable: true,
        });
        return;
      }
    }
    const handoff: CheckoutHandoff = attempt.handoff;

    try {
      await loadRazorpayScript();
    } catch {
      setStage({
        kind: 'error',
        message: 'The payment window could not load. Nothing has been charged.',
        retryable: true,
        reference: handoff.reference,
      });
      return;
    }

    setStage({ kind: 'paying' });
    const outcome = await openRazorpayCheckout(handoff);

    // Closing the payment window is a normal thing to do, and is not an error.
    if (outcome.kind === 'dismissed') {
      setStage({ kind: 'cancelled' });
      return;
    }

    if (outcome.kind === 'failed') {
      setStage({
        kind: 'error',
        message: outcome.reason,
        retryable: true,
        reference: handoff.reference,
      });
      return;
    }

    setStage({ kind: 'verifying' });

    try {
      await fetch(`/api/bff/donations/${handoff.donationId}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outcome.result),
      });
    } catch {
      // Unreachable: the status page asks again, and the webhook records it.
    }
    /**
     * Whatever verification said, the status page decides what to show. A
     * failed verification may still be a taken payment that Razorpay's
     * webhook records a moment later; calling it failed here would be a
     * guess, and the wrong guess makes somebody pay twice.
     */
    if (handoff.reference) router.push(`/donation/${handoff.reference}`);
  }

  const payLabel = `Pay ${formatCurrency(selection.displayTotal)}`;
  const busyLabel =
    stage.kind === 'checking'
      ? 'Checking…'
      : stage.kind === 'creating'
        ? 'Preparing your donation…'
        : stage.kind === 'paying'
          ? 'Waiting for payment…'
          : 'Confirming your payment…';
  const fieldEvents = (field: FieldName) => ({
    onBlur: (event: React.FocusEvent<HTMLInputElement>) =>
      onFieldBlur(field, event.currentTarget.value),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onFieldChange(field, event.currentTarget.value),
  });

  return (
    <div className={cn('grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start', className)}>
      {stage.kind === 'verifying' ? (
        /*
          Full screen while the SERVER confirms. Nothing can be pressed, and
          the donor is told not to leave: the result is on its way.
        */
        <div
          role="status"
          aria-live="polite"
          className="bg-background/95 z-(--z-overlay) fixed inset-0 grid place-items-center p-6 backdrop-blur-sm"
        >
          <div className="max-w-sm text-center">
            <Spinner className="text-primary mx-auto size-8" />
            <p className="text-h3 mt-4 font-semibold">Confirming your payment…</p>
            <p className="text-body-sm text-muted-foreground mt-2">
              This usually takes a few seconds. Please don’t close or refresh this page.
            </p>
          </div>
        </div>
      ) : null}

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
          <Alert ref={resultRef} variant="destructive" role="alert" className="mt-5">
            <span>{stage.message}</span>
            {stage.reference ? (
              <span className="text-caption mt-1 block">
                Reference{' '}
                <span data-numeric="" className="font-semibold">
                  {stage.reference}
                </span>
                . Your details are still here; you can try again.
              </span>
            ) : null}
          </Alert>
        ) : null}

        {stage.kind === 'cancelled' ? (
          <Alert ref={resultRef} variant="info" role="status" className="mt-5">
            <span>
              <strong>Payment cancelled.</strong> Your donation wasn’t made. Your details are still
              here, so you can pay whenever you’re ready.
            </span>
          </Alert>
        ) : null}

        <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <Field id="name" label="Full name" error={errors.name} required>
            <Input
              key={`name-${prefill.version}`}
              id="name"
              name="name"
              autoComplete="name"
              required
              disabled={busy}
              defaultValue={prefill.donor?.name}
              {...fieldEvents('name')}
              {...fieldErrorProps('name', errors.name)}
            />
          </Field>

          <Field
            id="email"
            label="Email"
            error={errors.email}
            required
            hint="Your receipt goes here."
          >
            <Input
              key={`email-${prefill.version}`}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
              defaultValue={prefill.donor?.email}
              {...fieldEvents('email')}
              {...fieldErrorProps('email', errors.email, 'email-hint')}
            />
          </Field>

          <Field
            id="phone"
            label="Mobile number"
            error={errors.phone}
            required
            hint="Used to find your giving history if you contact us."
          >
            <Input
              key={`phone-${prefill.version}`}
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              disabled={busy}
              defaultValue={prefill.donor?.phone}
              {...fieldEvents('phone')}
              {...fieldErrorProps('phone', errors.phone, 'phone-hint')}
            />
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

            NO REFUND WORDING. There is no published refund or cancellation
            policy yet (DEVELOPMENT_STATUS.md §6), and Phase 9 keeps refund
            terms off the site until there is (e2e/phase-9.spec.ts).
          */}

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={busy}
            loadingText={busyLabel}
            loadingLabel={busyLabel}
          >
            {payLabel}
          </Button>

          {stage.kind === 'paying' || stage.kind === 'verifying' ? (
            <p
              role="status"
              className="text-caption text-warning-foreground bg-warning-subtle rounded-md px-3 py-2 text-center font-medium"
            >
              Don’t close or refresh this page until your payment is complete.
            </p>
          ) : null}

          <p className="text-caption text-muted-foreground text-center">
            Payments are handled by Razorpay. We never see your card details.
          </p>
        </form>
      </Card>

      <Card variant="elevated" className="space-y-5 p-6 lg:sticky lg:top-24">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-h4 font-semibold">Your donation</h2>
          </div>
          <p className="text-body-sm text-muted-foreground mt-1 line-clamp-2">
            {selection.campaignTitle}
          </p>
        </div>

        {/* Item breakdown if products or custom amount present */}
        {selection.items.length > 0 || selection.customAmount > 0 ? (
          <div className="border-border/60 divide-border/40 text-caption space-y-2 border-y py-3">
            {selection.items.length > 0 ? (
              <div className="text-muted-foreground flex justify-between">
                <span>
                  Product add-ons ({selection.items.reduce((s, i) => s + i.quantity, 0)} items)
                </span>
                <span className="text-foreground font-medium">Included</span>
              </div>
            ) : null}
            {selection.customAmount > 0 ? (
              <div className="text-muted-foreground flex justify-between">
                <span>Custom donation</span>
                <span data-numeric="" className="text-foreground font-medium tabular-nums">
                  {formatCurrency(selection.customAmount)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <span className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
            Total to Pay
          </span>
          <p data-numeric="" className="font-display text-h2 font-bold tabular-nums">
            {formatCurrency(selection.displayTotal)}
          </p>
        </div>

        <div className="border-border/60 text-caption text-muted-foreground space-y-3 border-t pt-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Your donation is recorded only after our server confirms the payment with Razorpay —
              never on the browser alone.
            </span>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="text-info mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {/*
                Careful wording. A receipt is not an 80G certificate: that is Form
                10BE, issued by the Income Tax Department after the annual filing.
              */}
              You will receive an itemised receipt by email. Relief under Section 80G is claimed
              separately, through Form 10BE after our annual filing.
            </span>
          </div>
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
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {/* Linked to the input (`fieldErrorProps`), so it is read with the field. */}
      <FieldError fieldId={id} error={error} />
    </div>
  );
}
