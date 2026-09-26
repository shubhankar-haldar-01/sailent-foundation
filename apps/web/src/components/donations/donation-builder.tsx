'use client';

import * as React from 'react';
import { ChevronUp, Gift, Info } from 'lucide-react';
import { Card, Input, cn, formatCurrency } from '@sailent/ui';
import { summariseDonation, type DonationSummary } from '@sailent/validation';

import { CampaignDonationSummary } from '@/components/donations/campaign-donation-summary';
import { CampaignProductCard } from '@/components/donations/campaign-product-card';
import { DonationCheckout } from '@/components/donations/donation-checkout';
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
  NO PRESET AMOUNT BUTTONS.

  There were four (₹500 / ₹1,000 / ₹2,500 / ₹5,000). The approved design gives
  the custom amount a single field beside the products, and presets on a page
  whose whole proposition is "buy a specific thing" compete with the products
  for the same decision. Somebody who wants to give a round number types one.
*/
const MINIMUM_AMOUNT = 1_000; // ₹10

export interface DonationBuilderProps {
  campaign: Campaign;
  /** Renders the sticky rail; off when embedded somewhere that supplies its own. */
  showSummary?: boolean;
  /**
   * The "Save Campaign" control, rendered by the SERVER and passed in.
   *
   * It has to know whether this visitor is a signed-in donor and whether they
   * have already saved this campaign — both of which are session state the
   * server holds. Passing the finished element down keeps that decision on the
   * server and keeps this client component from needing a session of its own.
   */
  saveSlot?: React.ReactNode;
  className?: string;
}

export function DonationBuilder({
  campaign,
  showSummary = true,
  saveSlot,
  className,
}: DonationBuilderProps) {
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [customAmount, setCustomAmount] = React.useState('');
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

  const chooseMode = (next: 'amount' | 'products') => {
    setMode(next);

    if (next === 'products') {
      productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const field = document.getElementById(customInputId);
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focused after the scroll, so the browser does not fight its own animation.
    window.setTimeout(() => field?.focus(), 350);
  };

  const isPaused = campaign.status === 'paused';
  const isClosed = campaign.status === 'completed' || campaign.status === 'archived';

  const setQuantity = (productId: string, quantity: number) => {
    setQuantities((current) => ({ ...current, [productId]: quantity }));
  };

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

  const summary = (
    <CampaignDonationSummary
      productLines={productLines}
      customPaise={customPaise}
      subtotal={summaryTotals.productTotal}
      total={total}
      minimum={MINIMUM_AMOUNT}
      belowMinimum={belowMinimum}
      canContinue={canContinue}
      onContinue={() => setStage('checkout')}
      onRemoveProduct={(id) => setQuantity(id, 0)}
      onClearAll={() => {
        setQuantities({});
        setCustomAmount('');
      }}
      saveSlot={saveSlot}
      mode={mode}
      {...(campaign.products.length > 0 ? { onModeChange: chooseMode } : {})}
    />
  );

  if (stage === 'checkout') {
    return (
      <div className={className} id="give">
        <DonationCheckout selection={checkoutSelection} onBack={() => setStage('build')} />
      </div>
    );
  }

  return (
    <div className={cn('grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start', className)}>
      <div className="min-w-0">
        {isPaused ? (
          <Card className="border-warning/30 bg-warning-subtle mb-6 flex gap-3 p-4">
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
          <Card className="bg-surface-sunken mb-6 flex gap-3 p-4">
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
          <section ref={productsRef} aria-labelledby="choose-products" className="scroll-mt-24">
            <h2 id="choose-products" className="text-h1 font-bold">
              Choose Products to Donate
            </h2>
            <p className="text-body-sm text-muted-foreground mt-1">
              Select the items you want to support. Your contribution will help us provide immediate
              relief to families in need.
            </p>

            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
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

        {/* Custom amount -------------------------------------------------- */}
        <section
          aria-labelledby="custom-amount"
          className={cn(
            'bg-wash-mint/40 border-wash-mint rounded-lg border p-4',
            campaign.products.length > 0 ? 'mt-5' : 'mt-0',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <Gift className="text-wash-mint-ink mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="custom-amount" className="text-body-sm font-bold">
                  {campaign.products.length > 0
                    ? 'Want to contribute a custom amount?'
                    : 'Choose an amount'}
                </h2>
                <p className="text-caption text-muted-foreground mt-0.5">
                  You can also make a general donation to support this campaign.
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-44">
              <label htmlFor={customInputId} className="sr-only">
                Custom donation amount in rupees
              </label>
              <span
                aria-hidden="true"
                className="text-body-sm text-muted-foreground border-border pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center border-r"
              >
                ₹
              </span>
              <Input
                id={customInputId}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="Enter amount"
                value={customAmount}
                disabled={isPaused || isClosed}
                onChange={(event) => setCustomAmount(event.target.value)}
                className="bg-surface pl-11"
                data-numeric=""
              />
            </div>
          </div>
        </section>
      </div>

      {showSummary ? (
        <>
          {/* Desktop: sticky rail. */}
          <div className="hidden lg:sticky lg:top-24 lg:block">{summary}</div>

          {/* Mobile: collapsed bar that expands into the full itemisation, so a
              donor can edit any line without scrolling back up. */}
          <div className="lg:hidden">
            <div
              className={cn(
                'border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t shadow-lg',
                'pb-[env(safe-area-inset-bottom,0px)]',
              )}
            >
              {isSheetOpen ? (
                <div className="max-h-[60dvh] overflow-y-auto p-4">{summary}</div>
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
        </>
      ) : null}
    </div>
  );
}
