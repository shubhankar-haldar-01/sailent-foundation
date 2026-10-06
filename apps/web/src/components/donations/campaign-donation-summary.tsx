'use client';

import * as React from 'react';
import { ArrowRight, Lock, Minus, Plus, Share2, Trash2 } from 'lucide-react';

import { Button, Card, cn, formatCurrency, formatNumber } from '@sailent/ui';

import { PaymentLogos } from '@/components/donations/payment-logos';
import { MediaFrame } from '@/components/media/media-frame';
import type { CampaignProduct } from '@/lib/mock/types';

/** What the campaign has raised so far, as the API reported it. */
export interface CampaignProgressFigures {
  /** Paise. */
  raised: number;
  /** Paise. */
  goal: number;
  /** Not clamped: an over-subscribed campaign says so (design-system §5). */
  percent: number;
  donorCount: number;
}

/**
 * The preset amounts, in rupees. Round figures from a modest gift up, all well
 * above the ₹10 minimum, and each sits beside the products rather than
 * competing with them — a donor can add one on top of a school kit.
 */
export const PRESET_AMOUNTS = [500, 1_000, 2_500, 5_000, 10_000] as const;

/**
 * The donation summary card.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE HERE IS A DISPLAY OF WHAT THE SERVER WILL RECOMPUTE.
 *
 * The line amounts, the custom amount and the total are arithmetic on prices
 * this page was given. The server recalculates all of it from the database at
 * checkout and its figure is the one charged (decision A3) — if they ever
 * disagree, the server is right and the donor sees the difference before
 * paying, not after.
 *
 * So nothing in this component is allowed to become the source of a charged
 * amount, however convenient that would be.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE BASKET IS EDITABLE HERE, not only listed. The rail stays on screen while
 * somebody reads the rest of the page, so the steppers and the custom amount
 * field are repeated in it — changing your mind should not mean scrolling back
 * up to the product grid. Both write to the same state as the grid does.
 *
 * THE PAYMENT MARKS ARE TEXT, NOT LOGOS. Razorpay, UPI, Visa, Mastercard and
 * RuPay are other people's trademarks and this project holds no artwork for
 * them. Set in type they are honest and legible at any size; a downloaded PNG
 * of somebody's logo is a licensing question nobody asked.
 */
export function CampaignDonationSummary({
  productLines,
  customPaise,
  onCustomAmountChange,
  amountRef,
  customDisabled = false,
  total,
  minimum,
  belowMinimum,
  canContinue,
  onContinue,
  onQuantityChange,
  onRemoveProduct,
  onClearAll,
  mode,
  onModeChange,
  progress,
  assurances,
  className,
}: {
  productLines: { product: CampaignProduct; quantity: number }[];
  customPaise: number;
  onCustomAmountChange: (value: string) => void;
  /** The first preset, so the builder can focus it when "One-Time Donation" is chosen. */
  amountRef?: React.Ref<HTMLButtonElement>;
  customDisabled?: boolean;
  total: number;
  minimum: number;
  belowMinimum: boolean;
  canContinue: boolean;
  onContinue: () => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemoveProduct: (id: string) => void;
  onClearAll: () => void;
  /** Which way of giving the left column is currently offering. */
  mode?: 'amount' | 'products';
  /** Omitted when the campaign has no products — there is then nothing to switch. */
  onModeChange?: (mode: 'amount' | 'products') => void;
  /** Omitted where the page already shows the campaign's progress elsewhere. */
  progress?: CampaignProgressFigures;
  /**
   * The assurances (80G, secure payments, trusted), shown as a panel at the
   * foot of the card, under the payment methods and Share Campaign.
   */
  assurances?: React.ReactNode;
  className?: string;
}) {
  // "Selected Items" counts PRODUCTS. The chosen amount has its own row below,
  // and counting it here put "(1)" over an empty list.
  const itemCount = productLines.length;
  const isEmpty = productLines.length === 0 && customPaise === 0;
  const amountLabelId = React.useId();

  return (
    <Card className={cn('rounded-xl px-4 py-3 shadow-sm', className)}>
      <h2 className="text-body-lg font-bold leading-tight">Your Donation</h2>

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

        What it is NOT is a recurring/one-time choice. There is no recurring
        giving on this platform and there will not be, so both options are
        one-time; the distinction is money or goods.
      */}
      {onModeChange ? (
        <div
          role="radiogroup"
          aria-label="How would you like to give?"
          className="border-border bg-surface-sunken mt-2 flex rounded-lg border p-1"
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
                // the design's single row. Below 360px it may wrap: the card is
                // in the page there, and a label that cannot wrap pushed the
                // page 2px wider than a 320px screen.
                'focus-visible:outline-ring min-h-7 flex-1 text-nowrap rounded-md px-2 text-[0.8125rem] font-semibold tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 max-[359px]:text-wrap max-[359px]:py-1 max-[359px]:leading-tight',
                mode === value
                  ? // `-ink-strong`: the ordinary mint ink on the mint wash is
                    // 4.31:1 against a 4.5:1 floor for 13px text.
                    'bg-wash-mint text-wash-mint-ink-strong shadow-sm'
                  : 'text-foreground/80 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {progress ? <CampaignProgressBlock figures={progress} className="mt-2.5" /> : null}

      {/* Selected items ------------------------------------------------- */}
      {/*
        SHOWN ONCE THERE IS SOMETHING IN IT. An empty "Selected Items (0)" row
        was a line of nothing on arrival, in a card that has to fit a laptop
        screen whole. With nothing chosen at all, the hint takes its place —
        which is also when the Donate button is off, so it doubles as the reason.
      */}
      {productLines.length > 0 ? (
        <div className={cn(progress ? 'border-border mt-2 border-t pt-2' : 'mt-3')}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-body-sm font-semibold">
              Selected Items{' '}
              <span data-numeric="" className="font-semibold">
                ({itemCount})
              </span>
            </p>
            {!isEmpty ? (
              <button
                type="button"
                onClick={onClearAll}
                className="text-caption text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Clear All
              </button>
            ) : null}
          </div>
          <ul className="mt-2 space-y-2">
            {productLines.map(({ product, quantity }) => (
              <SummaryLine
                key={product.id}
                product={product}
                quantity={quantity}
                onQuantityChange={(next) => onQuantityChange(product.id, next)}
                onRemove={() => onRemoveProduct(product.id)}
              />
            ))}
          </ul>
        </div>
      ) : customPaise === 0 ? (
        <p
          className={cn(
            'text-body-sm text-muted-foreground',
            progress ? 'border-border mt-2 border-t pt-2' : 'mt-3',
          )}
        >
          Choose an item above, or pick an amount below.
        </p>
      ) : null}

      {/* Amount presets ------------------------------------------------- */}
      {/*
        PRESETS, NOT A TYPED FIELD.

        A row of round amounts is quicker than typing one, and on a phone it
        avoids the keyboard altogether. Pressing one adds it to the donation —
        beside any products, never instead of them — and pressing it again takes
        it off. Toggle buttons with `aria-pressed`, in a group named by the
        heading: one or none can be on, which a radio group cannot express.
      */}
      <div className="border-border mt-2 border-t pt-2">
        <div className="flex items-baseline justify-between gap-3">
          <p id={amountLabelId} className="text-body-sm font-semibold">
            Add an Amount
          </p>
          <span data-numeric="" className="text-body-sm font-semibold tabular-nums">
            {formatCurrency(customPaise)}
          </span>
        </div>
        <div role="group" aria-labelledby={amountLabelId} className="mt-1 grid grid-cols-5 gap-1.5">
          {PRESET_AMOUNTS.map((rupees, index) => {
            const pressed = customPaise === rupees * 100;
            return (
              <button
                key={rupees}
                ref={index === 0 ? amountRef : undefined}
                type="button"
                aria-pressed={pressed}
                disabled={customDisabled}
                onClick={() => onCustomAmountChange(pressed ? '' : String(rupees))}
                data-numeric=""
                className={cn(
                  'text-caption focus-visible:outline-ring h-8 rounded-lg border font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
                  pressed
                    ? // `-ink-strong` on the mint wash: the ordinary ink is 4.31:1.
                      'border-success bg-wash-mint text-wash-mint-ink-strong'
                    : 'border-border bg-surface hover:border-foreground/30',
                )}
              >
                {formatCurrency(rupees * 100)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Total ---------------------------------------------------------- */}
      <div className="border-border mt-2 flex items-baseline justify-between gap-3 border-t pt-2">
        <span className="text-body font-bold">Total Amount</span>
        <span data-numeric="" className="text-h3 text-success font-bold tabular-nums leading-tight">
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
        className="mt-2 h-10 rounded-lg"
      >
        {/* The amount is IN the button, so what is about to be asked for is
            the last thing read before pressing it. */}
        {total > 0 ? `Donate ${formatCurrency(total)}` : 'Donate'}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>

      {/* Under the button: the assurance, the methods, then sharing. */}
      <PaymentAssurance />

      <div className="mt-2 flex justify-center">
        <ShareButton />
      </div>

      {assurances ? <div className="mt-2">{assurances}</div> : null}
    </Card>
  );
}

/**
 * One product in the basket: what it is, what it adds, and how many.
 *
 * The stepper here is quieter than the card's — the card is where somebody
 * first decides, this is where they adjust — but its buttons are 28px, above
 * the 24px WCAG 2.5.8 floor, and named for the product so a list of them is
 * usable out of context. The names differ from the card's ("Add one School
 * Kit") so a screen-reader user can tell which control they are on.
 */
function SummaryLine({
  product,
  quantity,
  onQuantityChange,
  onRemove,
}: {
  product: CampaignProduct;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const max = Math.max(1, product.maxPerDonation || 99);

  return (
    <li className="flex items-center gap-3">
      <span className="border-border size-10 shrink-0 overflow-hidden rounded-lg border">
        <MediaFrame
          media={{ ...product.image, alt: '' }}
          aspect="square"
          rounded={false}
          sizes="40px"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-body-sm block truncate font-semibold">{product.name}</span>
        {/* The LINE amount — what this row adds to the total. */}
        <span data-numeric="" className="text-body-sm block font-semibold tabular-nums">
          {formatCurrency(product.unitAmount * quantity)}
        </span>
      </span>

      <span
        role="group"
        aria-label={`Quantity of ${product.name} in your donation`}
        className="flex shrink-0 items-center"
      >
        <MiniStep
          label={`Decrease ${product.name} quantity`}
          icon={Minus}
          disabled={quantity <= 0}
          onClick={() => onQuantityChange(quantity - 1)}
        />
        <span data-numeric="" className="text-body-sm w-6 text-center font-semibold tabular-nums">
          {quantity}
        </span>
        <MiniStep
          label={`Increase ${product.name} quantity`}
          icon={Plus}
          disabled={quantity >= max}
          onClick={() => onQuantityChange(Math.min(quantity + 1, max))}
        />
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${product.name} from your donation`}
        className="text-destructive hover:bg-destructive/10 focus-visible:outline-ring grid size-8 shrink-0 place-items-center rounded-md transition-colors focus-visible:outline-2"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function MiniStep({
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
      className="text-foreground/80 hover:bg-muted hover:text-foreground focus-visible:outline-ring grid size-7 place-items-center rounded-full transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/**
 * Raised, donors, the bar and the goal.
 *
 * ALL OF IT FROM THE RECORD. `raised` moves only on a captured payment
 * (decision A6), and the donor count is withheld below five — a campaign with
 * two donors reads as a failing one, and five is the floor the listing cards
 * already use.
 *
 * `role="img"` with a sentence for a label, not a `progressbar`: a progress bar
 * announces an operation in flight, and this is a static figure.
 */
export function CampaignProgressBlock({
  figures,
  className,
}: {
  figures: CampaignProgressFigures;
  className?: string;
}) {
  const { raised, goal, percent, donorCount } = figures;
  const width = Math.min(100, Math.max(percent, raised > 0 ? 2 : 0));

  return (
    <div className={className}>
      <p className="text-body-sm font-semibold">Campaign Progress</p>

      <div className="mt-0.5 flex items-end justify-between gap-3">
        <p
          data-numeric=""
          className="text-wash-violet-ink text-h3 font-bold tabular-nums leading-tight"
        >
          {formatCurrency(raised)}
          <span className="sr-only"> raised</span>
        </p>
        {donorCount >= 5 ? (
          <p className="text-right leading-none">
            <span
              data-numeric=""
              className="text-wash-violet-ink text-h4 block font-bold tabular-nums leading-none"
            >
              {formatNumber(donorCount)}
            </span>
            <span className="text-caption text-muted-foreground mt-1 block leading-none">
              Donors
            </span>
          </p>
        ) : null}
      </div>

      {goal > 0 ? (
        <>
          <div
            role="img"
            aria-label={`${percent}% of the ${formatCurrency(goal)} goal raised`}
            className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
          >
            <span
              aria-hidden="true"
              className="bg-success block h-full rounded-full"
              style={{ width: `${width}%` }}
            />
          </div>
          <div className="text-caption text-muted-foreground mt-1.5 flex items-baseline justify-between gap-3">
            <span data-numeric="">{percent}% Complete</span>
            <span data-numeric="">Goal {formatCurrency(goal)}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** "Secure & Safe Payment" and the accepted methods, set in type. */
export function PaymentAssurance() {
  return (
    <>
      <p className="text-body-sm text-foreground/85 mt-2 flex items-center justify-center gap-1.5 font-medium">
        <Lock className="text-foreground size-4 fill-current" aria-hidden="true" />
        Secure &amp; Safe Payment
      </p>
      <PaymentLogos className="mt-1.5" />
    </>
  );
}

/**
 * Share Campaign — an outlined pill under the payment methods.
 *
 * Uses the platform share sheet where there is one, which on a phone is the
 * only share anybody wants — it offers WhatsApp, which is how this link will
 * actually travel. Falls back to copying the URL.
 */
export function ShareButton() {
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
      className="border-border bg-surface text-body-sm hover:bg-muted focus-visible:outline-ring inline-flex h-9 items-center gap-2 rounded-full border px-5 font-bold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Share2 className="size-4" aria-hidden="true" />
      Share Campaign
    </button>
  );
}
