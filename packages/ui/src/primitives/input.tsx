import * as React from 'react';

import { cn } from '../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders the error styling and wires `aria-invalid`. */
  hasError?: boolean;
}

/**
 * Input. 44px minimum height on touch.
 *
 * Note there is no placeholder-as-label affordance: placeholder text disappears
 * the moment the user types and is not read reliably by screen readers, so a
 * visible <Label> is always required (docs/design-system.md §5).
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', hasError, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={hasError || undefined}
      className={cn(
        'bg-surface text-body flex h-11 w-full rounded-lg border px-3 py-2',
        'placeholder:text-muted-foreground',
        'duration-(--duration-fast) transition-colors',
        // Form focus is the brand orange (owner decision, 2026-10-07): the border
        // turns #EB6A1F and a 2px #EB6A1F ring hugs it — 3.18:1 against the
        // white field. An error keeps its red border while focused.
        'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:text-body-sm file:border-0 file:bg-transparent file:font-medium',
        hasError ? 'border-destructive' : 'border-input focus-visible:border-primary',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }
>(function Textarea({ className, hasError, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={hasError || undefined}
      className={cn(
        'bg-surface text-body flex w-full rounded-lg border px-3 py-2',
        'placeholder:text-muted-foreground resize-y',
        // Same focus treatment as the input above.
        'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        hasError ? 'border-destructive' : 'border-input focus-visible:border-primary',
        className,
      )}
      {...props}
    />
  );
});
