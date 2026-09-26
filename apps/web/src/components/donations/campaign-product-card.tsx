'use client';

import { Minus, Plus } from 'lucide-react';

import { cn, formatCurrency, formatNumber } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { CampaignProduct } from '@/lib/mock/types';

/**
 * One thing a donor can buy for this campaign.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE PROGRESS LINE IS THE POINT OF THE CARD.
 *
 * "26 / 2000 Donated" tells somebody what is still needed, which is the fact
 * that decides whether they give. A percentage alone hides the scale — 1% of
 * 2000 and 1% of 20 are very different asks — so both are shown, the counts
 * plainly and the percentage as a quiet right-aligned figure.
 *
 * ALL OF IT COMES FROM THE RECORD. `providedQuantity` is written only inside
 * the payment-capture transaction (decision A6), so this number is money
 * actually received, never a pledge or a projection. A product with no target
 * shows no bar at all rather than an invented denominator.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The stepper's buttons are 44px and the value between them is a real `input`,
 * so somebody wanting twenty of something types 20 instead of pressing a button
 * twenty times.
 */
export function CampaignProductCard({
  product,
  quantity,
  onQuantityChange,
  disabled,
  featured,
}: {
  product: CampaignProduct;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  disabled: boolean;
  /** Marks the single most-needed item. At most one card per campaign. */
  featured?: boolean;
}) {
  const target = product.targetQuantity;
  const provided = product.providedQuantity;
  const percent =
    target && target > 0 ? Math.min(100, Math.round((provided / target) * 100)) : null;

  const max = Math.max(1, product.maxPerDonation || 99);
  const isFulfilled = product.status === 'fulfilled';
  const isOff = disabled || isFulfilled || product.status === 'inactive';

  const setQuantity = (next: number) => {
    onQuantityChange(Math.min(Math.max(0, Math.round(next)), max));
  };

  return (
    <article
      className={cn(
        'border-border bg-surface relative flex h-full flex-col rounded-lg border p-3',
        isOff && 'opacity-70',
      )}
    >
      {/*
        IMAGE LEFT, FACTS RIGHT — not a full-width photograph on top.

        A banner image pushes the price and the stepper below the fold on a
        two-column grid, and the picture of a sack of flour is the least
        decision-relevant thing on the card. Beside the text it still says what
        the item is, and the numbers that decide the donation stay together.
      */}
      <div className="flex gap-3">
        <div className="relative w-[38%] shrink-0">
          <MediaFrame media={product.image} aspect="photo" rounded className="rounded-md" />

          {featured && !isFulfilled ? (
            <span className="bg-success text-caption absolute -left-1 -top-1 rounded-md px-2 py-0.5 font-semibold text-white shadow-sm">
              Most Needed
            </span>
          ) : null}

          {isFulfilled ? (
            <span className="bg-surface/95 text-caption text-muted-foreground absolute -left-1 -top-1 rounded-md px-2 py-0.5 font-semibold">
              Fully funded
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-body-sm font-bold">{product.name}</h3>

          {target && target > 0 ? (
            <>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <span data-numeric="" className="text-caption text-muted-foreground">
                  {formatNumber(provided)} / {formatNumber(target)} Donated
                </span>
                <span data-numeric="" className="text-caption text-muted-foreground font-medium">
                  {percent}%
                </span>
              </div>

              {/*
                `role="img"` with a label, not a `progressbar`. A progress bar
                announces an operation in flight; this is a static figure, and
                the label reads as a sentence rather than as "45 percent" with
                no subject.
              */}
              <div
                role="img"
                aria-label={`${formatNumber(provided)} of ${formatNumber(target)} funded`}
                className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full"
              >
                <span
                  aria-hidden="true"
                  className="bg-wash-gold-ink block h-full rounded-full"
                  style={{ width: `${Math.max(percent ?? 0, provided > 0 ? 2 : 0)}%` }}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="border-border mt-3 flex items-end justify-between gap-3 border-t pt-3">
        <div>
          <p className="text-caption text-muted-foreground font-semibold uppercase tracking-wide">
            Price
          </p>
          <p data-numeric="" className="text-h3 font-bold">
            {formatCurrency(product.unitAmount)}
          </p>
        </div>

        <div className="border-border flex items-center rounded-lg border">
          <StepButton
            label={`Remove one ${product.name}`}
            icon={Minus}
            disabled={isOff || quantity <= 0}
            onClick={() => setQuantity(quantity - 1)}
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            value={quantity}
            disabled={isOff}
            aria-label={`Quantity of ${product.name}`}
            onChange={(event) => setQuantity(Number(event.target.value))}
            data-numeric=""
            className="text-body-sm h-11 w-11 border-0 bg-transparent text-center font-semibold tabular-nums [appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <StepButton
            label={`Add one ${product.name}`}
            icon={Plus}
            disabled={isOff || quantity >= max}
            onClick={() => setQuantity(quantity + 1)}
          />
        </div>
      </div>
    </article>
  );
}

function StepButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Minus;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-ring grid size-11 place-items-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
