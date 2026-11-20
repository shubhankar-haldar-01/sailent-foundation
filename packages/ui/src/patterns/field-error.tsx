import { AlertCircle } from 'lucide-react';

/**
 * A field's error, under the field (2026-11-19, docs/ui-feedback.md).
 *
 * Linked to its input by `fieldErrorProps(id, error)`, which gives the input
 * `aria-invalid` and `aria-describedby`, so a screen reader reads the error
 * with the field. An icon accompanies the colour.
 */
export function fieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

/** Spread onto the input: `<Input id="email" {...fieldErrorProps('email', errors.email, hintId)} />`. */
export function fieldErrorProps(fieldId: string, error?: string | null, describedBy?: string) {
  const ids = [describedBy, error ? fieldErrorId(fieldId) : null].filter(Boolean).join(' ');
  return {
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': ids || undefined,
  };
}

export function FieldError({ fieldId, error }: { fieldId: string; error?: string | null }) {
  if (!error) return null;
  return (
    <p
      id={fieldErrorId(fieldId)}
      className="text-caption text-destructive mt-1.5 flex items-start gap-1.5"
    >
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </p>
  );
}
