'use client';

import * as React from 'react';
import { Check, Send } from 'lucide-react';

import { cn } from '@sailent/ui';
import { emailSchema } from '@sailent/validation';
import { subscribeToNewsletter } from '@/lib/communications/actions';
import { Honeypot } from '@/components/forms/honeypot';

/**
 * "Stay Connected" newsletter card matching competitor reference (Image 2).
 */
export function StayConnectedCard({ className }: { className?: string }) {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = emailSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await subscribeToNewsletter(data);
      if (response.ok) {
        setSubmitted(true);
      } else {
        setError(response.fieldErrors?.email ?? response.error ?? 'That did not go through.');
      }
    });
  };

  return (
    <section
      aria-labelledby="stay-connected-title"
      className={cn('card-standard relative overflow-hidden rounded-2xl p-5 sm:p-6', className)}
    >
      {/* "Stay Connected" Pill Badge */}
      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Stay Connected
      </span>

      {/* Heading */}
      <h2
        id="stay-connected-title"
        className="font-display text-foreground mt-3 text-lg font-bold leading-snug sm:text-xl"
      >
        Get Campaign Updates And Impact Stories In Your Inbox
      </h2>

      {/* Form matching Image 2 */}
      {submitted ? (
        <div
          role="status"
          className="text-success mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium dark:bg-emerald-950/40"
        >
          <Check className="size-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
          <span>Thank you! Check your inbox to confirm your subscription.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4" noValidate>
          <Honeypot />
          <div className="relative flex items-center">
            <input
              type="email"
              name="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter your email"
              required
              aria-label="Email address for updates"
              className="bg-background border-border/80 text-foreground placeholder:text-muted-foreground focus-visible:outline-ring h-12 w-full rounded-2xl border pl-4 pr-14 text-sm transition-colors focus-visible:outline-2"
            />
            <button
              type="submit"
              disabled={pending}
              aria-label="Subscribe to updates"
              className="bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:outline-ring shadow-xs absolute right-1.5 flex size-9 items-center justify-center rounded-xl transition-transform focus-visible:outline-2 active:scale-95 disabled:opacity-50"
            >
              <Send className="size-4 stroke-[2.2]" aria-hidden="true" />
            </button>
          </div>
          {error ? <p className="text-destructive mt-1.5 text-xs font-medium">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
