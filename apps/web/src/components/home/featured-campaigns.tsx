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
import { FEATURED_BAND_SIZE } from '@/lib/featured-campaigns';
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
 *
 * WHICH twelve is decided on the server (`getFeaturedCampaigns`): the ones an
 * administrator marked "Feature on the homepage", in their featured order,
 * then the other active campaigns by deadline.
 */
const VISIBLE_CARDS = FEATURED_BAND_SIZE;

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
  const rail = useAutoplayRail(visible.length, { intervalMs: 4000 });

  if (campaigns.length === 0) return null;

  const viewAllHref = area ? `/campaigns?category=${area.slug}` : '/campaigns';
  const viewAllLabel = area ? `View All ${area.title} Campaigns` : 'View All Campaigns';

  return (
    <section aria-labelledby="campaigns-title" className="bg-background border-border border-b">
      <PageShell className="band-y">
        {/*
          The band heading, as the approved design draws it: a green rule and
          eyebrow, the headline under it, the lead under that, and the listing
          link as a filled pill on the right rather than an underlined link.

          The pill is vertically centred on the HEADLINE, not on the whole
          block — centring it on eyebrow-plus-headline-plus-lead would drop it
          level with the lead, which is not where the design puts it.
        */}
        {/*
          Featured Campaigns section heading (inspired by reference layout):
          Centered eyebrow + dual-colored punchy headline + lead description.
        */}
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <p className="text-foreground/80 dark:text-foreground/70 text-sm font-bold tracking-tight sm:text-base">
            Featured Campaigns
          </p>

          <h2
            id="campaigns-title"
            className="font-display mt-1.5 text-2xl font-black leading-[1.2] tracking-tight sm:text-3xl md:text-[2.25rem]"
          >
            {/*
              The band's approved heading. The redesign's "Real Needs. Lasting
              Change. Transforming Lives Together." had no recorded owner
              decision, so the heading stays as approved (2026-10-21).
            */}
            <span className="text-[#36335C] dark:text-indigo-200">Make a Real Difference</span>
          </h2>
        </div>

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
        */}
        <ul
          ref={rail.ref}
          hidden={visible.length === 0}
          aria-label="Featured campaigns"
          className="rail -mb-6 mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-2 pb-10 pt-4"
        >
          {visible.map((campaign, index) => (
            <li
              key={campaign.slug}
              className="rise-in flex shrink-0 basis-full snap-start sm:basis-[calc((100%-1.25rem)/2)] xl:basis-[calc((100%-3.75rem)/4)]"
              style={{ '--rise-delay': `${Math.min(index, 3) * 70}ms` } as React.CSSProperties}
            >
              <CampaignCard
                campaign={campaign}
                variant="featured"
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

        {/* View All Campaigns button matching reference screenshot mint pill + glow */}
        {visible.length > 0 ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {rail.canPlay ? (
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
                'bg-wash-mint text-wash-mint-ink-strong group inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold shadow-[0_12px_28px_-6px_rgba(34,197,94,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-5px_rgba(34,197,94,0.42)] hover:brightness-95 sm:text-base',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
            >
              {viewAllLabel}
              <ArrowRight
                className="size-4.5 text-wash-mint-ink-strong transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Link>
          </div>
        ) : null}
      </PageShell>
    </section>
  );
}
