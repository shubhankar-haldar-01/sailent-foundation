'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';

import { cn, formatCurrency } from '@sailent/ui';

export interface ProductQuantitySelectorProps {
  /** Announced to assistive technology: "Add one School Kit". */
  productName: string;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  /** The per-donation ceiling, from the API. Never a constant in the client. */
  max: number;
  /** Paise. Shown as a live line total beside the stepper. */
  unitPrice?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The quantity stepper, on its own.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Extracted from `ProductDonationCard` so the same control serves the public
 * donation page, the admin preview and anywhere else a quantity is chosen. One
 * implementation means the clamping rules cannot drift between them — and the
 * clamping is the point.
 *
 * NEGATIVE QUANTITIES ARE STRUCTURALLY IMPOSSIBLE HERE. `clamp` floors at zero
 * and ceilings at `max`, including on direct keyboard entry and on a paste.
 * That matters because a negative line SUBTRACTS from a donation total: it is
 * how a ₹9,000 clinic day becomes a ₹1 donation. This is the first of three
 * layers — the server revalidates with the same shared rules, and a CHECK
 * constraint backs both up. None of the three is trusted alone.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `−` is DISABLED at zero rather than hidden, so nothing shifts under the
 * pointer as the count changes. Controls are 44px because that is the touch
 * target WCAG 2.5.8 asks for, and a stepper is the control people miss most.
 */
export function ProductQuantitySelector({
  productName,
  quantity,
  onQuantityChange,
  max,
  unitPrice,
  disabled = false,
  size = 'md',
  className,
}: ProductQuantitySelectorProps) {
  const inputId = React.useId();
  const clamp = (next: number) => Math.min(Math.max(Math.trunc(next), 0), max);

  const button = cn(
    'border-border-strong inline-flex items-center justify-center rounded-lg border',
    'hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-transparent',
    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
    size === 'sm' ? 'size-11' : 'size-11',
  );

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onQuantityChange(clamp(quantity - 1))}
          disabled={disabled || quantity === 0}
          aria-label={`Remove one ${productName}`}
          className={button}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>

        <label htmlFor={inputId} className="sr-only">
          Quantity of {productName}
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={quantity}
          disabled={disabled}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            onQuantityChange(Number.isNaN(parsed) ? 0 : clamp(parsed));
          }}
          data-numeric=""
          className={cn(
            'border-input bg-surface text-body h-11 w-14 rounded-lg border text-center font-medium',
            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          )}
        />

        <button
          type="button"
          onClick={() => onQuantityChange(clamp(quantity + 1))}
          disabled={disabled || quantity >= max}
          aria-label={`Add one ${productName}`}
          className={button}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>

      {unitPrice !== undefined ? (
        // Announced, so a screen-reader user hears the total change rather than
        // having to navigate back to it after every press.
        <span
          data-numeric=""
          aria-live="polite"
          className={cn(
            'text-body font-semibold tabular-nums',
            quantity > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {formatCurrency(quantity * unitPrice)}
        </span>
      ) : null}
    </div>
  );
}
