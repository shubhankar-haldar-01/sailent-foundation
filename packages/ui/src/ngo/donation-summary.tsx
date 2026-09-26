import { ShieldCheck, X } from 'lucide-react';

import { cn } from '../lib/cn';
import { formatCurrency } from '../lib/format';
import { Button } from '../primitives/button';
import { Separator } from '../primitives/separator';
import type { DonationLineModel } from './types';

export interface DonationSummaryProps {
  lines: DonationLineModel[];
  onRemoveLine?: (id: string) => void;
  onContinue?: () => void;
  isSubmitting?: boolean;
  /** Paise. Shown when the total is below the accepted minimum. */
  minimumAmount?: number;
  /** Whether 80G eligibility may be stated. Only true once registration is confirmed. */
  showTaxNote?: boolean;
  className?: string;
}

/**
 * DonationSummary.
 *
 * Sticky rail on desktop; the mobile bottom-sheet wrapper lives in the web app.
 * Every line is editable HERE, so a donor never scrolls back up to change a
 * quantity.
 *
 * Continue is disabled at a zero total with the REASON stated — a dead control
 * with no explanation is one of the most common conversion killers in checkout.
 */
export function DonationSummary({
  lines,
  onRemoveLine,
  onContinue,
  isSubmitting = false,
  minimumAmount,
  showTaxNote = false,
  className,
}: DonationSummaryProps) {
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
  const isEmpty = total === 0;
  const belowMinimum = minimumAmount !== undefined && total > 0 && total < minimumAmount;
  const canContinue = !isEmpty && !belowMinimum;

  return (
    <div className={cn('border-border bg-surface rounded-lg border p-5', className)}>
      <h2 className="text-h4 font-semibold">Your donation</h2>

      {isEmpty ? (
        <p className="text-body-sm text-muted-foreground mt-3">
          Choose what to fund, or enter any amount you like.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-medium">
                  {line.name}
                  {line.type === 'product' && line.quantity > 1 ? (
                    <span className="text-muted-foreground"> × {line.quantity}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span data-numeric="" className="text-body-sm font-medium">
                  {formatCurrency(line.quantity * line.unitAmount)}
                </span>
                {onRemoveLine ? (
                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.id)}
                    aria-label={`Remove ${line.name}`}
                    className={cn(
                      'text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 transition-colors',
                      'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                    )}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Separator className="my-4" />

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-medium">Total</span>
        <span
          data-numeric=""
          aria-live="polite"
          className="font-display text-h3 font-semibold tabular-nums"
        >
          {formatCurrency(total)}
        </span>
      </div>

      {belowMinimum && minimumAmount !== undefined ? (
        <p className="text-caption text-destructive mt-2">
          The minimum donation is {formatCurrency(minimumAmount)}.
        </p>
      ) : null}

      <Button
        className="mt-4"
        size="lg"
        fullWidth
        disabled={!canContinue}
        isLoading={isSubmitting}
        onClick={onContinue}
      >
        Continue
      </Button>

      {/* State the reason rather than leaving the donor to infer it. */}
      {isEmpty ? (
        <p className="text-caption text-muted-foreground mt-2 text-center">
          Add a product or an amount to continue
        </p>
      ) : null}

      {showTaxNote ? (
        <p className="text-caption text-muted-foreground mt-4 flex items-start gap-2">
          <ShieldCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Eligible for tax deduction under Section 80G. Your receipt is emailed immediately; the
            80G certificate follows after the annual filing.
          </span>
        </p>
      ) : null}
    </div>
  );
}
