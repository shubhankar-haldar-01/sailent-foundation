import { Loader2 } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * The one spinner (2026-11-19, docs/ui-feedback.md).
 *
 * For buttons and small areas only. A page or section that is loading for the
 * first time gets a skeleton shaped like its content, not a spinner. Still
 * under `prefers-reduced-motion`.
 */
export function Spinner({
  className,
  label,
}: {
  className?: string;
  /** Announced to assistive technology. Leave empty when the text beside it says it. */
  label?: string;
}) {
  return (
    <>
      <Loader2
        data-slot="spinner"
        className={cn('size-4 shrink-0 animate-spin motion-reduce:animate-none', className)}
        aria-hidden="true"
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
