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
 * "354 / 500 Donated" tells somebody what is still needed, which is the fact
 * that decides whether they give. A percentage alone hides the scale — 1% of
 * 2000 and 1% of 20 are very different asks — so both are shown, the counts
 * plainly and the percentage as a quiet figure at the end of the line.
 *
 * ALL OF IT COMES FROM THE RECORD. `providedQuantity` is written only inside
 * the payment-capture transaction (decision A6), so this number is money
 * actually received, never a pledge or a projection. A product with no target
 * shows no bar at all rather than an invented denominator.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * PICTURE LEFT, FACTS RIGHT, as the approved product card has it: the photo
 * sits whole in its own white box (`contain`, so a product shot is never
 * cropped), and the name, the progress, the price and the stepper share the
 * column beside it. The value between the stepper's buttons is a real `input`,
 * so somebody wanting twenty of something types 20 instead of pressing twenty
 * times.
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
        'border-border/70 from-surface to-surface-warm relative flex h-full gap-4 rounded-2xl border bg-gradient-to-r p-3 shadow-sm',
        isOff && 'opacity-70',
      )}
    >
      {/* The picture, whole, in its own white box. */}
      <div className="border-border/60 bg-surface relative w-[34%] max-w-[13rem] shrink-0 self-start rounded-xl border p-1.5 sm:w-[38%] sm:p-2">
        <MediaFrame
          media={product.image}
          aspect="photo"
          rounded={false}
          fit="contain"
          className="rounded-lg"
          sizes="(max-width: 768px) 40vw, 208px"
        />

        {featured && !isFulfilled ? (
          <span className="bg-primary text-caption text-primary-foreground absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 font-semibold shadow-sm">
            Most Needed
          </span>
        ) : null}

        {isFulfilled ? (
          <span className="bg-surface/95 text-caption text-muted-foreground absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 font-semibold">
            Fully funded
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-1">
        <h3 className="text-body-lg font-bold leading-snug">{product.name}</h3>

        {target && target > 0 ? (
          <>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span data-numeric="" className="text-body-sm text-muted-foreground font-semibold">
                {formatNumber(provided)} / {formatNumber(target)} Donated
              </span>
              <span data-numeric="" className="text-body-sm text-wash-violet-ink font-semibold">
                {percent}%
              </span>
            </div>

            {/*
              `role="img"` with a label, not a `progressbar`. A progress bar
              announces an operation in flight; this is a static figure, and
              the label reads as a sentence rather than as "45 percent" with no
              subject.
            */}
            <div
              role="img"
              aria-label={`${formatNumber(provided)} of ${formatNumber(target)} funded`}
              className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full"
            >
              <span
                aria-hidden="true"
                className="bg-warning block h-full rounded-full"
                style={{ width: `${Math.max(percent ?? 0, provided > 0 ? 2 : 0)}%` }}
              />
            </div>
          </>
        ) : null}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3">
          <div>
            <p className="text-caption text-muted-foreground font-semibold uppercase tracking-wide">
              Price
            </p>
            <p data-numeric="" className="text-h4 font-bold tabular-nums leading-tight">
              {formatCurrency(product.unitAmount)}
            </p>
          </div>

          <div className="border-border bg-surface divide-border flex divide-x overflow-hidden rounded-xl border">
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
              className="text-body h-10 w-10 border-0 bg-transparent text-center font-semibold tabular-nums [appearance:textfield] focus-visible:outline-none sm:w-12 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <StepButton
              label={`Add one ${product.name}`}
              icon={Plus}
              disabled={isOff || quantity >= max}
              onClick={() => setQuantity(quantity + 1)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/** 40px segments of the stepper — above the 24px WCAG 2.5.8 floor. */
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
      className="text-wash-violet-ink hover:bg-muted focus-visible:outline-ring grid h-10 w-9 place-items-center transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 sm:w-10"
    >
      <Icon className="size-4" strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
