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
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:text-body-sm file:border-0 file:bg-transparent file:font-medium',
        hasError ? 'border-destructive' : 'border-input',
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
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        hasError ? 'border-destructive' : 'border-input',
        className,
      )}
      {...props}
    />
  );
});
