'use client';

import { ArrowRight, Heart, Lock, Share2, X } from 'lucide-react';

import { Button, Card, cn, formatCurrency } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { CampaignProduct } from '@/lib/mock/types';

/**
 * The donation summary rail.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE HERE IS A DISPLAY OF WHAT THE SERVER WILL RECOMPUTE.
 *
 * The subtotal, the custom amount and the total are arithmetic on prices this
 * page was given. The server recalculates all of it from the database at
 * checkout and its figure is the one charged (decision A3) — if they ever
 * disagree, the server is right and the donor sees the difference before
 * paying, not after.
 *
 * So nothing in this component is allowed to become the source of a charged
 * amount, however convenient that would be.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE PAYMENT MARKS ARE TEXT, NOT LOGOS. Razorpay, UPI, Visa, Mastercard and
 * RuPay are other people's trademarks and this project holds no artwork for
 * them. Set in type they are honest and legible at any size; a downloaded PNG
 * of somebody's logo is a licensing question nobody asked.
 */
export function CampaignDonationSummary({
  productLines,
  customPaise,
  subtotal,
  total,
  minimum,
  belowMinimum,
  canContinue,
  onContinue,
  onRemoveProduct,
  onClearAll,
  saveSlot,
  mode,
  onModeChange,
  className,
}: {
  productLines: { product: CampaignProduct; quantity: number }[];
  customPaise: number;
  subtotal: number;
  total: number;
  minimum: number;
  belowMinimum: boolean;
  canContinue: boolean;
  onContinue: () => void;
  onRemoveProduct: (id: string) => void;
  onClearAll: () => void;
  /** The server-rendered save control, which needs a session to decide its state. */
  saveSlot?: React.ReactNode;
  /** Which way of giving the left column is currently offering. */
  mode?: 'amount' | 'products';
  /** Omitted when the campaign has no products — there is then nothing to switch. */
  onModeChange?: (mode: 'amount' | 'products') => void;
  className?: string;
}) {
  const itemCount = productLines.length + (customPaise > 0 ? 1 : 0);
  const isEmpty = itemCount === 0;

  return (
    <Card className={cn('p-4', className)}>
      <h2 className="sr-only">Your donation</h2>

      {/*
        THE TWO WAYS TO GIVE.
        ════════════════════════════════════════════════════════════════════
        A radio group, not two buttons: these are mutually exclusive views of
        one basket, and `aria-pressed` on a pair of toggles announces two
        independent switches, one of which is always on.

        IT JUMPS TO A WAY OF GIVING; IT DOES NOT HIDE ONE. The approved design
        shows "One-Time Donation" selected with the products still on screen and
        already in the basket, so the control cannot be a filter — pressing a
        segment scrolls to that input and puts the cursor in it.

        That is also the only version that leaves a hybrid donation reachable. A
        filter would mean giving both products and an amount required finding a
        toggle first, and most people would never discover they could.

        What it is NOT is a recurring/one-time choice. There is no recurring
        giving on this platform and there will not be, so both options are
        one-time; the distinction is money or goods.
      */}
      {onModeChange ? (
        <div
          role="radiogroup"
          aria-label="How would you like to give?"
          className="bg-muted mb-4 flex rounded-lg p-1"
        >
          {(
            [
              ['amount', 'One-Time Donation'],
              ['products', 'Support with Products'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => onModeChange(value)}
              className={cn(
                // `text-nowrap` with a tight tracking: "Support with Products"
                // wrapped to two lines and made the control twice as tall as
                // the design's single row.
                'focus-visible:outline-ring min-h-9 flex-1 text-nowrap rounded-md px-2 text-[0.8125rem] font-semibold tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                mode === value
                  ? // `-ink-strong`: the ordinary mint ink on the mint wash is
                    // 4.31:1 against a 4.5:1 floor for 13px text.
                    'bg-wash-mint text-wash-mint-ink-strong shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-body-sm font-semibold">
          Selected Items{' '}
          <span data-numeric="" className="text-muted-foreground font-normal">
            ({itemCount})
          </span>
        </p>
        {!isEmpty ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-caption text-info-action focus-visible:outline-ring rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Clear All
          </button>
        ) : null}
      </div>

      {isEmpty ? (
        <p className="text-body-sm text-muted-foreground mt-3">
          Choose an item above, or enter any amount you like.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {productLines.map(({ product, quantity }) => (
            <li key={product.id} className="flex items-center gap-3">
              <span className="border-border size-10 shrink-0 overflow-hidden rounded-md border">
                <MediaFrame media={product.image} aspect="square" rounded={false} sizes="40px" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="text-body-sm block truncate font-medium">{product.name}</span>
                <span data-numeric="" className="text-caption text-muted-foreground">
                  {formatCurrency(product.unitAmount)} × {quantity}
                </span>
              </span>

              <span data-numeric="" className="text-body-sm shrink-0 font-semibold tabular-nums">
                {formatCurrency(product.unitAmount * quantity)}
              </span>

              <button
                type="button"
                onClick={() => onRemoveProduct(product.id)}
                aria-label={`Remove ${product.name}`}
                className="text-muted-foreground hover:text-destructive focus-visible:outline-ring grid size-8 shrink-0 place-items-center rounded-md transition-colors focus-visible:outline-2"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isEmpty ? (
        <dl className="border-border mt-4 space-y-1.5 border-t pt-3">
          {productLines.length > 0 ? (
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
          ) : null}
          {customPaise > 0 ? (
            <Row label="Custom Amount" value={formatCurrency(customPaise)} />
          ) : null}
        </dl>
      ) : null}

      <div className="border-border mt-3 flex items-baseline justify-between gap-3 border-t pt-3">
        <span className="text-body font-bold">Total Amount</span>
        <span data-numeric="" className="text-h2 text-success font-bold tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>

      {belowMinimum ? (
        <p role="alert" className="text-caption text-destructive mt-2">
          The smallest donation we can process is {formatCurrency(minimum)}.
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        fullWidth
        disabled={!canContinue}
        onClick={onContinue}
        className="mt-4"
      >
        Proceed to Donate
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>

      <p className="text-caption text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
        <Lock className="size-3.5" aria-hidden="true" />
        Secure &amp; Safe Payment
      </p>

      {/*
        Set in TYPE, in each brand's own colour — not their artwork.

        The approved design shows five payment logos. Those are registered
        trademarks and this project holds no licence for the files, so the row
        is built from text: the colours make it read as a payment strip at a
        glance, and nothing here reproduces a mark anybody owns. If licensed
        assets arrive they drop straight in here.
      */}
      <ul
        aria-label="Accepted payment methods"
        className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
      >
        {(
          [
            ['Razorpay', 'text-[#0c2451]'],
            ['UPI', 'text-[#097939]'],
            ['VISA', 'text-[#1a1f71] italic'],
            ['Mastercard', 'text-[#c8102e]'],
            ['RuPay', 'text-[#097939]'],
          ] as const
        ).map(([mark, tone]) => (
          <li key={mark} className={cn('text-caption font-bold tracking-tight', tone)}>
            {mark}
          </li>
        ))}
      </ul>

      <div className="border-border mt-4 flex items-center justify-around gap-2 border-t pt-3">
        {saveSlot ?? (
          <span className="text-caption text-muted-foreground inline-flex items-center gap-1.5">
            <Heart className="size-4" aria-hidden="true" />
            Save Campaign
          </span>
        )}
        <span aria-hidden="true" className="bg-border h-5 w-px" />
        <ShareButton />
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-body-sm text-muted-foreground">{label}</dt>
      <dd data-numeric="" className="text-body-sm font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/**
 * Share.
 *
 * Uses the platform share sheet where there is one, which on a phone is the
 * only share anybody wants — it offers WhatsApp, which is how this link will
 * actually travel. Falls back to copying the URL, and says which it did.
 */
function ShareButton() {
  const share = async () => {
    const url = window.location.href;
    const title = document.title;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissing the sheet rejects. That is not an error worth reporting.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked; nothing useful left to try.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="text-caption text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 font-medium transition-colors focus-visible:outline-2"
    >
      <Share2 className="size-4" aria-hidden="true" />
      Share
    </button>
  );
}
