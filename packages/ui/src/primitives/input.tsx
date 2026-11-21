import * as React from 'react';

import { CircleCheck } from 'lucide-react';

import { cn } from '../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders the error styling and wires `aria-invalid`. */
  hasError?: boolean;
  /**
   * The value has been checked and is good: a teal border and a check mark.
   * Never the only signal — pair it with a message where it matters.
   */
  isValid?: boolean;
  /** A short fixed lead-in drawn inside the field, e.g. "₹" on amount fields. */
  prefix?: string;
}

/** The field's look, shared by Input and Textarea. */
function fieldClasses(hasError?: boolean, isValid?: boolean) {
  return [
    'bg-surface text-body w-full rounded-lg border px-3 py-2',
    'placeholder:text-muted-foreground',
    'duration-(--duration-fast) transition-[border-color,box-shadow,outline-color]',
    'hover:border-foreground/40',
    // Focus is the brand green (colour roles, 2026-11-21): the border and a
    // 2px ring turn `primary`, 5.4:1 against the white field. An error keeps
    // its red border and rings red; a valid field keeps its teal.
    'focus-visible:outline-2 focus-visible:outline-offset-0',
    'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-input',
    hasError
      ? 'border-destructive hover:border-destructive focus-visible:outline-destructive'
      : isValid
        ? 'border-success hover:border-success focus-visible:outline-success'
        : 'border-input focus-visible:border-primary focus-visible:outline-primary',
  ];
}

/**
 * Input. 44px high, 8px corners.
 *
 * States: default, hover (the border darkens), focus (brand ring), error
 * (`hasError`), valid (`isValid`), disabled. Helper and error text sit under
 * it in `FieldHint` / `FieldError`, never inside it.
 *
 * Note there is no placeholder-as-label affordance: placeholder text disappears
 * the moment the user types and is not read reliably by screen readers, so a
 * visible <Label> is always required (docs/design-system.md §5).
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', hasError, isValid, prefix, ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      type={type}
      aria-invalid={hasError || undefined}
      className={cn(
        'flex h-11',
        fieldClasses(hasError, isValid),
        'file:text-body-sm file:border-0 file:bg-transparent file:font-medium',
        prefix && 'pl-8',
        isValid && !hasError && 'pr-10',
        className,
      )}
      {...props}
    />
  );
  if (!prefix && !(isValid && !hasError)) return field;
  return (
    <div className="relative w-full">
      {prefix ? (
        <span
          aria-hidden="true"
          className="text-muted-foreground text-body pointer-events-none absolute inset-y-0 left-3 flex items-center"
        >
          {prefix}
        </span>
      ) : null}
      {field}
      {isValid && !hasError ? (
        <CircleCheck
          aria-hidden="true"
          className="text-success pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2"
        />
      ) : null}
    </div>
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
      className={cn('flex min-h-24 resize-y', fieldClasses(hasError), className)}
      {...props}
    />
  );
});
