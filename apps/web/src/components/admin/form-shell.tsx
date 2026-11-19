'use client';

import * as React from 'react';

import { Alert, Button, Input, Label, cn } from '@sailent/ui';

import type { ActionState } from '@/lib/admin/actions';
import { useRevealResult } from '@/lib/ui/reveal-result';

/**
 * The admin form primitives.
 *
 * Every field renders its own error beneath itself and points at it with
 * `aria-describedby`, because the API returns errors per field and a single
 * summary at the top makes the operator hunt for which of eleven inputs is
 * wrong.
 */

export function Field({
  label,
  name,
  errors,
  hint,
  children,
  required,
}: {
  label: string;
  name: string;
  errors?: Record<string, string>;
  hint?: string;
  children?: React.ReactNode;
  required?: boolean;
}) {
  const error = errors?.[name];
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children ?? (
        <Input
          id={name}
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
      )}
      {hint ? (
        <p id={`${name}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({
  name,
  defaultValue,
  value,
  rows = 4,
  errors,
  onChange,
  ref,
  maxLength,
  placeholder,
  className,
  required,
}: {
  name: string;
  defaultValue?: string | null;
  value?: string | null;
  rows?: number;
  errors?: Record<string, string>;
  /**
   * Optional, for a form that needs to reach the element itself.
   *
   * The blog editor's markdown toolbar inserts markers at the cursor, which
   * needs `selectionStart` — and reading that from a controlled value would
   * mean owning every keystroke. In React 19 `ref` is an ordinary prop on a
   * function component, so this adds nothing but a pass-through.
   */
  ref?: React.Ref<HTMLTextAreaElement>;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  required?: boolean;
  /**
   * Optional, and the field stays UNCONTROLLED when value is not passed.
   *
   * A form that needs to react to typing — to warn that a figure will need a
   * source, say — can listen without taking ownership of the value.
   */
  onChange?: (value: string) => void;
}) {
  return (
    <textarea
      ref={ref}
      id={name}
      name={name}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      required={required}
      defaultValue={value !== undefined ? undefined : (defaultValue ?? '')}
      value={value !== undefined ? (value ?? '') : undefined}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      aria-invalid={errors?.[name] ? true : undefined}
      aria-describedby={errors?.[name] ? `${name}-error` : undefined}
      className={cn(
        'border-input bg-surface text-body-sm w-full rounded-md border px-3 py-2',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-1',
        className,
      )}
    />
  );
}

export function SubmitButton({
  children,
  pending,
  variant,
  className,
  onClick,
}: {
  children: React.ReactNode;
  pending: boolean;
  variant?: React.ComponentProps<typeof Button>['variant'];
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
      onClick={onClick}
    >
      {pending ? 'Saving…' : children}
    </Button>
  );
}

/**
 * Success and failure banners, announced to assistive technology when they
 * appear, and brought into view with focus after each save (`useRevealResult`).
 */
export function FormStatus({ state }: { state: ActionState }) {
  const ref = useRevealResult(state);
  if (state.error) {
    const errorDetails = state.fieldErrors
      ? Object.values(state.fieldErrors).filter((msg) => msg && msg !== state.error)
      : [];
    return (
      <Alert ref={ref} variant="destructive" role="alert" className="space-y-1.5">
        <p className="font-semibold">{state.error}</p>
        {errorDetails.length > 0 ? (
          <ul className="text-caption list-inside list-disc space-y-0.5">
            {errorDetails.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        ) : null}
      </Alert>
    );
  }
  if (state.ok) {
    return (
      <Alert ref={ref} variant="success" role="status">
        Saved.
      </Alert>
    );
  }
  return null;
}
