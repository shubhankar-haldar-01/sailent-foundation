'use client';

import * as React from 'react';
import { ChevronUp, Gift, Info } from 'lucide-react';
import { Card, Input, cn, formatCurrency, percentOf } from '@sailent/ui';
import { summariseDonation, type DonationSummary } from '@sailent/validation';

import {
  CampaignDonationSummary,
  CampaignProgressBlock,
  PRESET_AMOUNTS,
  type CampaignProgressFigures,
} from '@/components/donations/campaign-donation-summary';
import { CampaignProductCard } from '@/components/donations/campaign-product-card';
import { DonationCheckout } from '@/components/donations/donation-checkout';
import { donationColumns } from '@/components/donations/donation-layout';
import { StickyRail } from '@/components/donations/sticky-rail';
import { SectionHeading } from '@/components/sections/section-heading';
import type { Campaign } from '@/lib/mock/types';

/**
 * Donation builder — the signature interaction of this platform.
 *
 * UI ONLY in Phase 2. No payment provider, no order creation, no persistence.
 *
 * Three design decisions carried from Phase 0 §6.3:
 *
 *   1. There is no "mode" to choose. A donor who wants to give ₹500 never
 *      touches a product; a donor who wants two kits never types an amount.
 *      The hybrid is what happens naturally when someone does both, not a
 *      third path they have to select.
 *   2. Continue is disabled at zero with the REASON stated. A dead control
 *      with no explanation is one of the most common conversion killers in
 *      checkout.
 *   3. The running total is announced to assistive technology, so a screen
 *      reader user hears the amount change when they adjust a quantity.
 *
 * Note what this component does NOT do: compute a total the server will trust.
 * The request carries campaign-product ids and quantities only — never a price,
 * never a total. The figures here are for the donor's benefit; the server
 * recomputes everything from the database before it creates a payment order.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ARITHMETIC IS NOT WRITTEN HERE. `summariseDonation` comes from
 * `@sailent/validation`, the same function the API calls before it charges
 * anybody. Two implementations of a total is not duplication — it is two
 * answers to "what am I paying", and the donor only ever sees one of them.
 *
 * THERE IS NO MONTHLY OPTION, and its absence is deliberate rather than
 * pending. A donation in this system is a single act: no subscriptions, no
 * auto-debit, no mandate. Nothing here should acquire a recurring toggle
 * without the tables, the cancellation path and the mandate handling that a
 * real one needs.
 * ══════════════════════════════════════════════════════════════════════════
 */

/*
  PRESET AMOUNTS LIVE IN THE DONATION CARD.

  ₹500 to ₹10,000, as toggle buttons beside the total (see
  `CampaignDonationSummary`). A typed field remains only in the optional panel
  under the products, which /donate shows and the campaign page does not.
*/
const MINIMUM_AMOUNT = 1_000; // ₹10

export interface DonationBuilderProps {
  campaign: Campaign;
  /** Renders the sticky rail; off when embedded somewhere that supplies its own. */
  showSummary?: boolean;
  /**
   * What sits ABOVE the products in the main column — on a campaign page, the
   * photograph, the title and the section links.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * WHY THE PAGE HANDS ITS CONTENT TO THE BUILDER.
   *
   * The donation card has to stay beside the whole page, from the photograph
   * down to the FAQs, and it has to share one basket with the product grid. A
   * sticky element only travels inside its own grid row, so the card, the
   * grid and everything around them have to be in the same two-column layout —
   * and the basket is client state, so that layout lives here. The page's own
   * sections stay server-rendered; they arrive as already-rendered slots.
   *
   * All three slots are optional. The /donate page passes none of them and
   * gets the builder on its own, as before.
   * ══════════════════════════════════════════════════════════════════════════
   */
  lead?: React.ReactNode;
  /** What follows the ways of giving in the main column. */
  children?: React.ReactNode;
  /**
   * The assurances (80G, secure payments, trusted). On a desktop they sit at
   * the foot of the donation card, so the side column is one card; on a phone,
   * where that card is the bottom sheet, they close the page in a small card of
   * their own.
   */
  assurances?: React.ReactNode;
  /**
   * The custom-amount panel under the products ("Other Ways to Support").
   *
   * On by default, because on /donate a campaign without products has no
   * other field in the main column. The campaign page turns it off: there the
   * donation card's own Custom Amount field is always beside the products,
   * and a second field for the same amount was one panel too many.
   */
  showCustomAmountSection?: boolean;
  /**
   * Start with the smallest amount preset already chosen, so the card opens
   * on "Donate ₹500" rather than on a disabled button. The campaign page turns
   * it on; /donate, where somebody has just picked a campaign and may well
   * want only products, leaves it off. Never applied to a campaign that is not
   * taking donations.
   */
  preselectSmallestAmount?: boolean;
  className?: string;
}

export function DonationBuilder({
  campaign,
  showSummary = true,
  lead,
  children,
  assurances,
  showCustomAmountSection = true,
  preselectSmallestAmount = false,
  className,
}: DonationBuilderProps) {
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [customAmount, setCustomAmount] = React.useState(() =>
    preselectSmallestAmount && campaign.status === 'active' ? String(PRESET_AMOUNTS[0]) : '',
  );
  /**
   * The builder and the checkout are ONE component with two stages, not two
   * routes. Navigating away and back would lose the basket — and the basket is
   * client state, because nothing is created on the server until the donor has
   * said who they are.
   */
  const [stage, setStage] = React.useState<'build' | 'checkout'>('build');
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  /**
   * Which way of giving the donor last chose to work in.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * IT DOES NOT HIDE EITHER PANEL, AND THAT IS THE DESIGN.
   *
   * The approved layout shows "One-Time Donation" selected with the product
   * grid still on screen and products already in the basket — so the control
   * cannot be a filter. It is a JUMP: pressing a segment scrolls to that way of
   * giving and puts the cursor in it.
   *
   * That is also the only reading that leaves a hybrid donation reachable. A
   * filter would mean giving both products and an amount required finding a
   * toggle first, and most people would never discover they could.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const [mode, setMode] = React.useState<'amount' | 'products'>('amount');
  const customInputId = React.useId();
  const productsRef = React.useRef<HTMLElement>(null);
  // The donation card renders twice — the desktop rail and the phone sheet —
  // so the first amount preset in each copy gets its own ref.
  const railAmountRef = React.useRef<HTMLButtonElement>(null);
  const sheetAmountRef = React.useRef<HTMLButtonElement>(null);

  const chooseMode = (next: 'amount' | 'products') => {
    setMode(next);

    if (next === 'products') {
      productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    /*
      The panel's field when there is one; otherwise the first amount preset
      in whichever copy of the card is on screen. `offsetParent` is null for the copy inside a
      `display: none` rail, which is how the phone and desktop copies are told
      apart without asking for the viewport width.
    */
    const field = showCustomAmountSection
      ? document.getElementById(customInputId)
      : ([railAmountRef.current, sheetAmountRef.current].find(
          (preset) => preset !== null && preset.offsetParent !== null,
        ) ?? null);

    // `nearest` for the card's presets: they are already beside the reader, and
    // centring it would scroll the page away from what they were reading.
    field?.scrollIntoView({
      behavior: 'smooth',
      block: showCustomAmountSection ? 'center' : 'nearest',
    });
    // Focused after the scroll, so the browser does not fight its own animation.
    window.setTimeout(() => field?.focus(), 350);
  };

  const isPaused = campaign.status === 'paused';
  // Past its end date counts as finished: the checkout refuses it, so the
  // controls must not invite it.
  const isClosed =
    campaign.status === 'completed' ||
    campaign.status === 'archived' ||
    campaign.donation?.state === 'ended';

  const setQuantity = (productId: string, quantity: number) => {
    setQuantities((current) => ({ ...current, [productId]: Math.max(0, quantity) }));
  };

  /**
   * Raised, goal and donors, straight from the API's own computation when it
   * sent one, derived from the same two figures when it did not (the fixture
   * fallback carries no `progress`).
   */
  const progress: CampaignProgressFigures = React.useMemo(() => {
    const goal = campaign.progress?.goal ?? campaign.goalAmount;
    const raised = campaign.progress?.raised ?? campaign.amountRaised;
    return {
      goal,
      raised,
      percent: campaign.progress?.rawPercent ?? percentOf(raised, goal),
      donorCount: campaign.donorCount,
    };
  }, [campaign.progress, campaign.goalAmount, campaign.amountRaised, campaign.donorCount]);

  /**
   * MOVE TO THE CHECKOUT WHEN IT OPENS, and back to the products on return.
   *
   * The Donate button is in a rail that follows the reader down the page, so it
   * can be pressed from beside the FAQs. Without this the form would open far
   * above, off screen, and the press would appear to do nothing. Focus goes to
   * the form's container so a screen reader starts from the right place too.
   */
  const checkoutRef = React.useRef<HTMLDivElement>(null);
  const previousStage = React.useRef(stage);
  React.useEffect(() => {
    if (previousStage.current === stage) return;
    previousStage.current = stage;

    if (stage === 'checkout') {
      checkoutRef.current?.scrollIntoView({ block: 'start' });
      checkoutRef.current?.focus({ preventScroll: true });
    } else {
      productsRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [stage]);

  const customPaise = React.useMemo(() => {
    const parsed = Number.parseFloat(customAmount);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [customAmount]);

  const productLines = React.useMemo(
    () =>
      campaign.products
        .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [campaign.products, quantities],
  );

  /**
   * The one implementation, shared with the server.
   *
   * `summary.type` is DERIVED from what is in the basket — 'custom', 'product'
   * or 'hybrid' — and is never something the donor picks. There is no mode
   * selector on this page because there is no mode: somebody who wants two kits
   * never types an amount, somebody who wants to give ₹500 never touches a
   * product, and the hybrid is what happens when they do both.
   */
  const summaryTotals: DonationSummary = React.useMemo(
    () =>
      summariseDonation(
        productLines.map((line) => ({
          campaignProductId: line.product.id,
          productId: line.product.id,
          productName: line.product.name,
          unitPrice: line.product.unitAmount,
          quantity: line.quantity,
        })),
        customPaise,
      ),
    [productLines, customPaise],
  );

  const total = summaryTotals.total;
  const itemCount = summaryTotals.itemCount + (customPaise > 0 ? 1 : 0);

  const belowMinimum = total > 0 && total < MINIMUM_AMOUNT;
  const canContinue = total > 0 && !belowMinimum && !isPaused && !isClosed;

  const checkoutSelection = React.useMemo(
    () => ({
      campaignSlug: campaign.slug,
      campaignTitle: campaign.title,
      items: productLines.map((line) => ({
        campaignProductId: line.product.id,
        quantity: line.quantity,
      })),
      customAmount: customPaise,
      // DISPLAY ONLY. The server recomputes this from database prices and its
      // figure is the one charged.
      displayTotal: total,
    }),
    [campaign.slug, campaign.title, productLines, customPaise, total],
  );

  const renderSummary = (withProgress: boolean) => (
    <CampaignDonationSummary
      amountRef={withProgress ? railAmountRef : sheetAmountRef}
      productLines={productLines}
      customPaise={customPaise}
      onCustomAmountChange={setCustomAmount}
      customDisabled={isPaused || isClosed}
      total={total}
      minimum={MINIMUM_AMOUNT}
      belowMinimum={belowMinimum}
      canContinue={canContinue}
      onContinue={() => setStage('checkout')}
      onQuantityChange={setQuantity}
      onRemoveProduct={(id) => setQuantity(id, 0)}
      onClearAll={() => {
        setQuantities({});
        setCustomAmount('');
      }}
      mode={mode}
      {...(campaign.products.length > 0 ? { onModeChange: chooseMode } : {})}
      {...(withProgress ? { progress, assurances } : {})}
    />
  );

  if (stage === 'checkout') {
    return (
      <div className={className}>
        {lead}
        <div
          id="give"
          ref={checkoutRef}
          tabIndex={-1}
          className={cn('scroll-mt-32 focus:outline-none', lead ? 'mt-8' : null)}
        >
          <DonationCheckout selection={checkoutSelection} onBack={() => setStage('build')} />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={cn(donationColumns, className)}>
      <div className="min-w-0">
        {lead}

        {isPaused ? (
          <Card className="border-warning/30 bg-warning-subtle mt-6 flex gap-3 p-4 first:mt-0">
            <Info className="text-warning-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-body-sm font-semibold">Donations are paused for this campaign</p>
              <p className="text-body-sm text-muted-foreground mt-1">
                We have paused giving while the program team reviews delivery. The story below stays
                available, and you can support the program instead.
              </p>
            </div>
          </Card>
        ) : null}

        {isClosed ? (
          <Card className="bg-surface-sunken mt-6 flex gap-3 p-4 first:mt-0">
            <Info className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-body-sm font-semibold">This campaign has finished</p>
              <p className="text-body-sm text-muted-foreground mt-1">
                It is no longer accepting donations. The story and the results stay here, and the
                programme it belongs to is still running.
              </p>
            </div>
          </Card>
        ) : null}

        {campaign.products.length > 0 ? (
          /*
            `id="give"` IS THE PAGE'S DONATE ANCHOR. Campaign cards, programme
            pages and receipts all link to `/campaigns/…#give`, and this is
            where they should land — on the things to give.
          */
          <section
            id="give"
            ref={productsRef}
            aria-labelledby="choose-products"
            className="mt-6 scroll-mt-32 first:mt-0"
          >
            <SectionHeading
              id="choose-products"
              size="md"
              title="Choose How You Want to Help"
              lead="Select the items you want to support. Your contribution will help us provide immediate relief to those in need."
            />

            {/*
              Two across only where two FIT. Each card lays its picture beside
              its facts, so it needs about 400px; beside the rail at `lg` the
              column is about 600px, and two cards there would crush the price
              into the stepper. Full width at `md`, with no rail, has room for
              two again.
            */}
            <ul className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {campaign.products.map((product, index) => (
                <li key={product.id}>
                  <CampaignProductCard
                    product={product}
                    quantity={quantities[product.id] ?? 0}
                    onQuantityChange={(next: number) => setQuantity(product.id, next)}
                    disabled={isPaused || isClosed}
                    /*
                      "Most Needed" marks the FIRST card and only the first.
                      Products arrive in the order the campaign team set, so the
                      first is the one they put first — and a badge on three of
                      four cards says nothing at all.
                    */
                    featured={index === 0}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Other ways to support --------------------------------------------- */}
        {showCustomAmountSection ? (
          <section
            aria-labelledby="custom-amount"
            className="bg-surface-warm border-wash-amber mt-6 rounded-xl border p-4 first:mt-0 md:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="bg-wash-amber text-wash-amber-ink grid size-10 shrink-0 place-items-center rounded-full"
                >
                  <Gift className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="custom-amount" className="text-body font-bold">
                    {campaign.products.length > 0 ? 'Other Ways to Support' : 'Choose an amount'}
                  </h2>
                  <p className="text-body-sm text-muted-foreground mt-0.5">
                    {campaign.products.length > 0
                      ? 'Can’t find what you need? Give any amount you choose and we’ll use it where it’s needed most.'
                      : 'Give any amount you choose to support this campaign.'}
                  </p>
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <label htmlFor={customInputId} className="sr-only">
                  Custom donation amount in rupees
                </label>
                <span
                  aria-hidden="true"
                  className="text-body-sm text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center"
                >
                  ₹
                </span>
                <Input
                  id={customInputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder={
                    campaign.products.length > 0 ? 'Enter amount (optional)' : 'Enter amount'
                  }
                  value={customAmount}
                  disabled={isPaused || isClosed}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  className="bg-surface rounded-lg pl-9"
                  data-numeric=""
                />
              </div>
            </div>
          </section>
        ) : null}

        {children}
      </div>

      {showSummary || assurances ? (
        <StickyRail>
          {/* Desktop: the card, sticky with everything in this column. */}
          {showSummary ? <div className="hidden lg:block">{renderSummary(true)}</div> : null}

          {/*
            Below `lg` there is no rail: the card lives in the bottom sheet, and
            the campaign's progress — which the sheet leaves out to stay short —
            closes the page here, after the FAQs, with the assurances under it.
          */}
          {showSummary ? (
            <div className="border-border bg-surface rounded-xl border p-5 shadow-sm lg:hidden">
              <CampaignProgressBlock figures={progress} />
            </div>
          ) : null}

          {assurances ? (
            <div className="border-border bg-surface rounded-xl border p-4 shadow-sm lg:hidden">
              {assurances}
            </div>
          ) : null}
        </StickyRail>
      ) : null}

      {showSummary ? (
        /* Mobile: collapsed bar that expands into the full itemisation, so a
           donor can edit any line without scrolling back up. */
        <div className="lg:hidden">
          <div
            className={cn(
              'border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t shadow-lg',
              'pb-[env(safe-area-inset-bottom,0px)]',
            )}
          >
            {isSheetOpen ? (
              <div className="max-h-[60dvh] overflow-y-auto p-4">{renderSummary(false)}</div>
            ) : null}

            <button
              type="button"
              onClick={() => setIsSheetOpen((open) => !open)}
              aria-expanded={isSheetOpen}
              className="focus-visible:outline-ring flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <span>
                <span data-numeric="" className="text-h4 font-semibold tabular-nums">
                  {formatCurrency(total)}
                </span>
                <span className="text-body-sm text-muted-foreground ml-2">
                  {itemCount === 0
                    ? 'Nothing selected'
                    : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                </span>
              </span>
              <span className="text-body-sm text-primary flex items-center gap-2 font-medium">
                {isSheetOpen ? 'Hide' : 'Review'}
                <ChevronUp
                  aria-hidden="true"
                  className={cn('size-4 transition-transform', isSheetOpen && 'rotate-180')}
                />
              </span>
            </button>
          </div>
          {/* Spacer so the sticky bar never covers page content. */}
          <div aria-hidden="true" className="h-16" />
        </div>
      ) : null}
    </div>
  );
}
