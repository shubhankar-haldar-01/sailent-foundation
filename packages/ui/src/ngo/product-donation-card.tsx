'use client';

import * as React from 'react';
import { Check, Minus, Plus } from 'lucide-react';

import { cn } from '../lib/cn';
import { formatCurrency, percentOf } from '../lib/format';
import { Card } from '../primitives/card';
import { Progress } from '../primitives/progress';
import type { ProductDonationModel } from './types';

export interface ProductDonationCardProps {
  product: ProductDonationModel;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  /** All steppers disable together when the campaign is paused. */
  disabled?: boolean;
  className?: string;
}

/**
 * ProductDonationCard — the signature component of this platform.
 *
 * The quantity stepper is the interaction that matters:
 *   • 44px controls, per the touch-target requirement
 *   • `−` is DISABLED at zero rather than hidden, so nothing shifts
 *   • the line total updates live beside it
 *   • direct numeric entry for donors giving at scale
 *
 * Negative quantities are structurally impossible here — the control clamps —
 * which is the first of the three layers guarding that edge case. The server
 * re-validates and a CHECK constraint backs it up.
 */
export function ProductDonationCard({
  product,
  quantity,
  onQuantityChange,
  disabled = false,
  className,
}: ProductDonationCardProps) {
  const inputId = React.useId();
  const isFulfilled = product.status === 'fulfilled';
  const isDisabled = disabled || isFulfilled;
  const lineTotal = quantity * product.unitAmount;

  const remaining =
    product.targetQuantity === null
      ? null
      : Math.max(product.targetQuantity - product.providedQuantity, 0);
  const isNearlyFulfilled =
    remaining !== null &&
    product.targetQuantity !== null &&
    remaining > 0 &&
    remaining / product.targetQuantity < 0.1;

  const clamp = (next: number) => Math.min(Math.max(next, 0), product.maxPerDonation);

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden transition-colors',
        quantity > 0 && 'border-primary ring-primary ring-1',
        isFulfilled && 'opacity-70',
        className,
      )}
    >
      {product.image ? (
        <div className="aspect-4/3 bg-muted relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image.url}
            alt={product.image.alt}
            className="size-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-body font-semibold">{product.name}</h3>
          <span data-numeric="" className="text-body text-primary shrink-0 font-semibold">
            {formatCurrency(product.unitAmount)}
          </span>
        </div>

        {/* Says what the donor is buying. "School Kit ₹900" alone converts far worse. */}
        <p className="text-body-sm text-muted-foreground">{product.description}</p>

        {product.targetQuantity !== null ? (
          <div className="space-y-1.5">
            <Progress
              value={percentOf(product.providedQuantity, product.targetQuantity)}
              size="sm"
              label={`${product.providedQuantity} of ${product.targetQuantity} ${product.name} provided`}
            />
            <p className="text-caption text-muted-foreground">
              <span data-numeric="">
                {product.providedQuantity} of {product.targetQuantity}
              </span>{' '}
              provided
              {isNearlyFulfilled ? (
                <span className="text-warning-foreground ml-1 font-medium">
                  · only {remaining} remaining
                </span>
              ) : null}
            </p>
          </div>
        ) : (
          product.providedQuantity > 0 && (
            <p className="text-caption text-muted-foreground">
              <span data-numeric="">{product.providedQuantity}</span> provided so far
            </p>
          )
        )}

        <div className="mt-auto pt-2">
          {isFulfilled ? (
            <p className="bg-success-subtle text-body-sm text-success flex items-center gap-2 rounded-md px-3 py-2.5 font-medium">
              <Check className="size-4" aria-hidden="true" />
              Fully funded — thank you
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onQuantityChange(clamp(quantity - 1))}
                  disabled={isDisabled || quantity === 0}
                  aria-label={`Remove one ${product.name}`}
                  className={cn(
                    'border-border-strong inline-flex size-11 items-center justify-center rounded-lg border',
                    'hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-transparent',
                    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>

                <label htmlFor={inputId} className="sr-only">
                  Quantity of {product.name}
                </label>
                <input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={product.maxPerDonation}
                  value={quantity}
                  disabled={isDisabled}
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
                  disabled={isDisabled || quantity >= product.maxPerDonation}
                  aria-label={`Add one ${product.name}`}
                  className={cn(
                    'border-border-strong inline-flex size-11 items-center justify-center rounded-lg border',
                    'hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-transparent',
                    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>

              {/* Announced so a screen-reader user hears the total change. */}
              <span
                data-numeric=""
                aria-live="polite"
                className={cn(
                  'text-body font-semibold tabular-nums',
                  quantity > 0 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {formatCurrency(lineTotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
