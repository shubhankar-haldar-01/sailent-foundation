'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, SearchX } from 'lucide-react';

import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { RailPauseToggle } from '@/components/motion/rail-pause-toggle';
import { useAutoplayRail } from '@/components/motion/use-autoplay-rail';
import { matchesCategory } from '@/lib/categories';
import { focusAreas } from '@/lib/mock/home';
import type { DonorViewer } from '@/lib/donor/viewer';
import type { Campaign } from '@/lib/mock/types';

/**
 * How many cards the band carries.
 *
 * FOUR ON SCREEN at desktop — the approved four-up width the cards are drawn
 * against — and up to twelve in the rail behind them, which it moves through
 * on its own. The band is still a teaser, not an index: everything else is
 * reached through "View All Campaigns", which queries the server rather than
 * shipping a longer list to the browser.
 */
const VISIBLE_CARDS = 12;

/**
 * Featured campaigns.
 *
 * Renders nothing when there are none — an empty state on the homepage's most
 * important band is an admission, and absence is quieter and more honest.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A RAIL THAT ADVANCES ON ITS OWN — AT THE CLIENT'S REQUEST — AND CARRIES
 * EVERYTHING THAT OBLIGES.
 *
 * It was a static grid because a moving row has to clear WCAG 2.2.2 (Level A):
 * anything that moves by itself for more than five seconds needs a way to stop
 * it. It moves again now, so the obligation is met in full, by
 * `useAutoplayRail`:
 *   • a pause/play control for keyboard and screen-reader users, which shows
 *     itself when tabbed to (the visible pause button and the previous/next
 *     arrows were taken off at the client's request);
 *   • hover, or focus anywhere in a card, holds it still;
 *   • swiping or scrolling it yourself stops it for good;
 *   • `prefers-reduced-motion` means it never starts;
 *   • it waits while the tab is hidden or the band is off screen.
 *
 * It is a real horizontally scrolling list underneath, so with scripting off
 * it still scrolls by hand — it just does not move on its own. And it is still
 * a `<ul>` with an accessible name: a list of campaigns is a list whether it
 * scrolls or not.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function FeaturedCampaigns({
  campaigns,
  activeCategory = null,
  viewer,
}: {
  campaigns: Campaign[];
  /** A focus-area slug narrowing the grid, or null for everything. */
  activeCategory?: string | null;
  /** Signed in, and what was saved — for the cards' save hearts. */
  viewer?: DonorViewer;
}) {
  const area = activeCategory
    ? (focusAreas.find((entry) => entry.slug === activeCategory) ?? null)
    : null;

  /**
   * Filtered HERE, in the browser, from a list already fetched.
   *
   * The band shows four at a time out of a couple of dozen, so shipping the
   * set and narrowing it costs a few kilobytes and answers instantly. Fetching
   * per click would put a spinner on a row that is a teaser, not an index.
   */
  const matching = React.useMemo(
    () => campaigns.filter((campaign) => matchesCategory(campaign.category, activeCategory)),
    [campaigns, activeCategory],
  );

  const visible = matching.slice(0, VISIBLE_CARDS);
  const rail = useAutoplayRail(visible.length);

  if (campaigns.length === 0) return null;

  const viewAllHref = area ? `/campaigns?category=${area.slug}` : '/campaigns';
  const viewAllLabel = area ? `View All ${area.title} Campaigns` : 'View All Campaigns';

  return (
    <section aria-labelledby="campaigns-title" className="bg-surface border-border border-b">
      <PageShell className="band-y">
        {/*
          The band heading, as the approved design draws it: a green rule and
          eyebrow, the headline under it, the lead under that, and the listing
          link as a filled pill on the right rather than an underlined link.

          The pill is vertically centred on the HEADLINE, not on the whole
          block — centring it on eyebrow-plus-headline-plus-lead would drop it
          level with the lead, which is not where the design puts it.
        */}
        <div className="flex items-center gap-3">
          {/* Decorative: the eyebrow beside it already names the band. */}
          <span
            aria-hidden="true"
            className="bg-wash-mint-ink-strong block h-[3px] w-8 shrink-0 rounded-full"
          />
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-wash-mint-ink-strong font-bold uppercase">
            Featured Campaigns
          </p>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h2
            id="campaigns-title"
            className="font-display text-h2 tracking-(--text-section--letter-spacing) font-extrabold"
          >
            Make a Real Difference
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            {/*
              The rail's only control: pause/play, hidden until it is tabbed to
              (see RailPauseToggle for why it must exist). It is the stop just
              before "View All Campaigns" and appears above it when focused.
            */}
            {rail.canPlay ? (
              // Full row height, so "above" means above the pill, not over it.
              <div className="relative self-stretch">
                <RailPauseToggle
                  rail={rail}
                  label="featured campaigns"
                  className="focus-visible:bottom-full focus-visible:left-0 focus-visible:mb-2"
                />
              </div>
            ) : null}

            <Link
              href={viewAllHref}
              className={cn(
                'bg-wash-mint text-wash-mint-ink-strong text-body-sm group inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold',
                'focus-visible:outline-ring hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
            >
              {viewAllLabel}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>

        {/* `max-w-3xl` so the sentence sits on ONE line at desktop, as the
            approved design shows it, and still wraps sanely under that. */}
        <p className="text-body text-muted-foreground mt-2 max-w-3xl">
          Support our ongoing campaigns and help us create a better tomorrow for communities in
          need.
        </p>

        {/*
          Announced, so a filter press is not a silent change.

          `aria-live="polite"` on a region that is ALWAYS in the DOM: a live
          region inserted at the same moment its text appears is frequently
          missed, because the announcement fires before assistive technology
          has finished registering the region.

          It counts what is ON SCREEN, not what matched. With the grid capped
          at four, "showing all six" would be a claim the page does not back up.
        */}
        <p aria-live="polite" className="sr-only">
          {area
            ? `Showing ${matching.length} ${area.title} ${matching.length === 1 ? 'campaign' : 'campaigns'}.`
            : `Showing ${visible.length} of ${matching.length} featured ${matching.length === 1 ? 'campaign' : 'campaigns'}.`}
        </p>

        {visible.length === 0 ? (
          /*
            An area with nothing running right now is an ordinary state, not an
            error — so this says what is true and offers the two ways onward,
            rather than apologising.
          */
          <div className="border-border mt-6 rounded-xl border border-dashed px-6 py-10 text-center">
            <SearchX className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
            <p className="text-body mt-3 font-semibold">
              No {area?.title.toLowerCase()} campaign is running at the moment
            </p>
            <p className="text-body-sm text-muted-foreground mx-auto mt-1 max-w-md">
              The work continues — it is just not raising money through a campaign today. Look at
              every campaign, or read about this programme.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
              <Link
                href="/campaigns"
                className="text-body-sm text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                All campaigns
              </Link>
              {area ? (
                <Link
                  href={`/programs/${area.slug}`}
                  className="text-body-sm text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  About our {area.title.toLowerCase()} work
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {/*
          THE SAME CARD AS THE CAMPAIGNS PAGE — one component, so the homepage
          and the listing cannot drift apart. Rail items stretch to the tallest
          card, so the Donate buttons line up across whatever is on screen.

          Two on screen until `xl`, then four: the card sets donors, raised and
          goal side by side, and a quarter of a 1024px screen is too narrow for
          those three figures. A phone shows one with the next peeking in, so
          the row reads as one that moves.

          Vertical padding, cancelled by negative margin, gives a hovered card
          room to lift and cast its shadow: a scrolling row clips everything
          outside its own box. No horizontal padding — the rail measures each
          card's position from its edge to know where the next one starts.
        */}
        <ul
          ref={rail.ref}
          hidden={visible.length === 0}
          aria-label="Featured campaigns"
          className="rail -mb-8 mt-2 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-8 pt-4"
        >
          {visible.map((campaign, index) => (
            <li
              key={campaign.slug}
              className="rise-in flex shrink-0 basis-[85%] snap-start sm:basis-[calc((100%-1.25rem)/2)] xl:basis-[calc((100%-3.75rem)/4)]"
              style={{ '--rise-delay': `${Math.min(index, 3) * 70}ms` } as React.CSSProperties}
            >
              <CampaignCard
                campaign={campaign}
                className="w-full"
                {...(viewer
                  ? {
                      save: {
                        signedIn: viewer.signedIn,
                        saved: viewer.savedIds.includes(campaign.id),
                        returnTo: '/',
                      },
                    }
                  : {})}
              />
            </li>
          ))}
        </ul>
      </PageShell>
    </section>
  );
}
