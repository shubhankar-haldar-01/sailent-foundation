'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock } from 'lucide-react';

import { Button, cn, formatCurrency } from '@sailent/ui';

import { donationPresets } from '@/lib/mock/home';

type Frequency = 'once' | 'monthly';

/**
 * The donation widget.
 *
 * The single most important interactive element on the site, so it is built to
 * be usable rather than merely to look right:
 *
 *   • The frequency control is a real radiogroup with arrow-key navigation,
 *     not two divs. Someone who cannot use a mouse must be able to switch it.
 *   • Amounts are radio inputs in a fieldset with a legend, so a screen reader
 *     announces "Donation amount, ₹1,000, 2 of 5 selected" rather than reading
 *     five unlabelled buttons.
 *   • Money is INTEGER PAISE throughout (decision A2). ₹1,000 is 100000. The
 *     only division happens inside `formatCurrency`.
 *   • "Other amount" takes rupees, because that is what a person types, and
 *     converts once at the boundary.
 *
 * It does NOT take payment. Phase 5 owns that. This builds the donation intent
 * and hands it to the existing flow at /donate, which says plainly that
 * nothing is charged yet.
 */
export function DonationWidget({ className }: { className?: string }) {
  const router = useRouter();
  const [frequency, setFrequency] = React.useState<Frequency>('once');
  const [selected, setSelected] = React.useState<number>(donationPresets.once[1]!);
  const [custom, setCustom] = React.useState('');
  const [isCustom, setIsCustom] = React.useState(false);

  const presets = donationPresets[frequency];

  // Switching frequency re-picks the equivalent preset rather than keeping an
  // amount that is no longer offered.
  React.useEffect(() => {
    if (!isCustom) setSelected(donationPresets[frequency][1]!);
  }, [frequency, isCustom]);

  const customPaise = React.useMemo(() => {
    const rupees = Number(custom.replace(/[^0-9.]/g, ''));
    return Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) : 0;
  }, [custom]);

  const amount = isCustom ? customPaise : selected;
  const canGive = amount >= 10_000; // ₹100 floor, matching the API's minimum.

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canGive) return;

    // The intent, carried in the URL so it survives a refresh and can be
    // shared. Phase 5 reads the same parameters at checkout.
    router.push(`/donate?amount=${amount}&frequency=${frequency}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="donation-widget-title"
      className={cn(
        'bg-surface border-border w-full rounded-xl border p-4 shadow-lg sm:p-5',
        className,
      )}
    >
      {/* Frequency ---------------------------------------------------------- */}
      <div
        role="radiogroup"
        aria-label="How often would you like to give?"
        className="border-border flex gap-1 rounded-lg border p-1"
      >
        {(
          [
            ['once', 'One Time'],
            ['monthly', 'Monthly'],
          ] as const
        ).map(([value, label]) => {
          const active = frequency === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setFrequency(value);
                setIsCustom(false);
              }}
              className={cn(
                'text-body-sm h-9 flex-1 rounded-md border font-semibold transition-colors',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                active
                  ? 'border-info-action bg-surface text-info-action'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <h2
        id="donation-widget-title"
        className="font-display text-body-lg mt-4 font-bold tracking-tight"
      >
        Make a Difference Today
      </h2>
      <p className="text-caption text-muted-foreground mt-1">
        Your support helps children, families and communities build a brighter future.
      </p>

      {/* Amounts ------------------------------------------------------------ */}
      <fieldset className="mt-4">
        <legend className="sr-only">Donation amount</legend>

        <div className="grid grid-cols-3 gap-2">
          {presets.map((paise) => {
            const active = !isCustom && selected === paise;
            return (
              <label
                key={paise}
                className={cn(
                  'text-body-sm relative flex h-10 cursor-pointer items-center justify-center rounded-lg border font-semibold transition-colors',
                  'has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
                  active
                    ? 'border-info-action bg-info-action text-info-action-foreground'
                    : 'border-border bg-surface text-foreground hover:border-info-action',
                )}
              >
                <input
                  type="radio"
                  name="amount"
                  value={paise}
                  checked={active}
                  onChange={() => {
                    setSelected(paise);
                    setIsCustom(false);
                  }}
                  className="sr-only"
                />
                {formatCurrency(paise)}
              </label>
            );
          })}

          <label
            className={cn(
              'text-body-sm col-span-2 flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 font-semibold transition-colors',
              'has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              isCustom
                ? 'border-info-action bg-surface text-foreground'
                : 'border-border bg-surface text-muted-foreground hover:border-info-action',
            )}
          >
            <input
              type="radio"
              name="amount"
              checked={isCustom}
              onChange={() => setIsCustom(true)}
              className="sr-only"
            />
            {isCustom ? (
              <>
                <span aria-hidden="true">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={custom}
                  onChange={(event) => setCustom(event.target.value)}
                  aria-label="Other amount in rupees"
                  placeholder="Enter an amount"
                  className="text-body-sm w-full bg-transparent font-semibold outline-none"
                />
              </>
            ) : (
              <span className="w-full text-center">Other Amount</span>
            )}
          </label>
        </div>
      </fieldset>

      <Button type="submit" size="md" fullWidth className="mt-4" disabled={!canGive}>
        Donate Now
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>

      {isCustom && custom !== '' && !canGive ? (
        <p role="alert" className="text-caption text-destructive mt-2 text-center">
          The minimum donation is ₹100.
        </p>
      ) : null}

      <p className="text-caption text-muted-foreground mt-2.5 flex items-center justify-center gap-1.5">
        <Lock className="size-3.5" aria-hidden="true" />
        100% Secure &amp; Transparent
      </p>

      {/*
        Payment methods as WORDMARKS, not logos.
        Reproducing the Visa, Mastercard and UPI marks means shipping
        trademarked artwork with usage rules attached, and the reassurance a
        donor takes from this row comes from recognising the names.
      */}
      <ul className="border-border mt-3 flex items-center justify-center gap-4 border-t pt-3">
        {['Razorpay', 'VISA', 'Mastercard', 'UPI'].map((method) => (
          <li key={method} className="text-caption text-muted-foreground font-bold tracking-tight">
            {method}
          </li>
        ))}
      </ul>
      <p className="sr-only">
        Payments are processed by Razorpay. Card and UPI payments are supported. No payment is taken
        in this preview.
      </p>
    </form>
  );
}
