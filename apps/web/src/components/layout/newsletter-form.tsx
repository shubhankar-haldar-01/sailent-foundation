'use client';

import * as React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button, Input, Label, cn } from '@sailent/ui';
import { emailSchema } from '@sailent/validation';

/**
 * Newsletter signup — UI only.
 *
 * Validates with the SAME shared Zod schema the API will use, so the client
 * and server cannot disagree about what a valid address is. No email service
 * is wired up; Brevo integration lands in Phase 4.
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = emailSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    setError(null);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <p
        role="status"
        className={cn('text-body-sm text-success flex items-center gap-2', className)}
      >
        <Check className="size-4 shrink-0" aria-hidden="true" />
        Thank you — you would be subscribed once the email service is connected.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={cn('space-y-2', className)}>
      <Label htmlFor={inputId} className={cn(compact && 'sr-only')}>
        Email address
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
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
        <Button type="submit" variant={tone === 'info' ? 'info' : 'primary'} className="shrink-0">
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
