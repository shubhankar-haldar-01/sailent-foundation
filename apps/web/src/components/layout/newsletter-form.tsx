'use client';

import * as React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button, Input, Label, cn } from '@sailent/ui';
import { emailSchema } from '@sailent/validation';

import { subscribeToNewsletter } from '@/lib/communications/actions';
import { Honeypot } from '@/components/forms/honeypot';

/**
 * Newsletter sign-up (Phase 13: real, double opt-in).
 *
 * Validates with the SAME shared Zod schema the API uses. Submitting stores a
 * PENDING subscription and emails a confirmation link; only that link
 * subscribes the address, so nobody can sign somebody else up. The answer is
 * the same whether or not the address was already on the list.
 */
export function NewsletterForm({
  className,
  compact = false,
  tone = 'primary',
}: {
  className?: string;
  compact?: boolean;
  /**
   * `info` gives the blue Subscribe button the approved homepage band uses.
   * Orange is the site's single donate colour, and a newsletter sign-up
   * competing with it at the foot of the page is the one place that matters.
   */
  tone?: 'primary' | 'info';
}) {
  const inputId = React.useId();
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
      if (response.ok) setSubmitted(true);
      else setError(response.fieldErrors?.email ?? response.error ?? 'That did not go through.');
    });
  };

  if (submitted) {
    return (
      <p
        role="status"
        className={cn('text-body-sm text-success flex items-center gap-2', className)}
      >
        <Check className="size-4 shrink-0" aria-hidden="true" />
        Nearly done — check your inbox and confirm with the link we sent.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={cn('relative space-y-2', className)}>
      <Honeypot />
      <Label htmlFor={inputId} className={cn(compact && 'sr-only')}>
        Email address
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={value}
          hasError={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            // Revalidate as they correct it, so the error clears the moment
            // they are right rather than on the next submit.
            if (error) {
              setError(emailSchema.safeParse(event.target.value).success ? null : error);
            }
          }}
          className="sm:flex-1"
        />
        <Button
          type="submit"
          variant={tone === 'info' ? 'info' : 'primary'}
          className="shrink-0"
          disabled={pending}
          aria-busy={pending}
        >
          Subscribe
          {tone === 'info' ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </Button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
