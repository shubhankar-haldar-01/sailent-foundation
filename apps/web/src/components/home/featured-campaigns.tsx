'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, SearchX } from 'lucide-react';

import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { HomeCampaignCard } from '@/components/home/campaign-card';
import { matchesCategory } from '@/lib/categories';
import { focusAreas } from '@/lib/mock/home';
import type { Campaign } from '@/lib/mock/types';

/**
 * How many cards the band shows at once.
 *
 * FOUR, because the approved design is a four-up grid and the fourth column is
 * what the card widths are drawn against. The band is a teaser, not an index —
 * everything past the fourth is reached through "View All Campaigns", which
 * queries the server rather than shipping a longer list to the browser.
 */
const VISIBLE_CARDS = 4;

/**
 * Featured campaigns.
 *
 * Renders nothing when there are none — an empty state on the homepage's most
 * important band is an admission, and absence is quieter and more honest.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A STATIC GRID, NOT A CAROUSEL.
 *
 * This was a scrolling rail that advanced on its own, which meant it also had
 * to carry a pause button to clear WCAG 2.2.2 (Level A) — a mechanism to stop
 * anything moving for more than five seconds. The approved design shows four
 * cards standing still, so the movement is gone and the obligation goes with
 * it: there is nothing to pause, no arrows to mis-aim, and the row works
 * identically with scripting off.
 *
 * It is still a `<ul>` with an accessible name. The focus-area strip finds the
 * band by that name, and a list of campaigns is a list whether it scrolls or
 * not.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function FeaturedCampaigns({
  campaigns,
  activeCategory = null,
}: {
  campaigns: Campaign[];
  /** A focus-area slug narrowing the grid, or null for everything. */
  activeCategory?: string | null;
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
          Four equal columns at `lg`, and `items-stretch` so every card is the
          height of the tallest in the row — the Donate buttons line up across
          the band however many lines each title and description take.

          Two columns from `sm` rather than four: a quarter of a tablet is
          narrower than the card's own content, and the meta row wraps onto a
          second line before the picture is even legible.
        */}
        <ul
          hidden={visible.length === 0}
          aria-label="Featured campaigns"
          className="mt-6 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {visible.map((campaign) => (
            <li key={campaign.slug} className="flex">
              <HomeCampaignCard campaign={campaign} className="w-full" />
            </li>
          ))}
        </ul>
      </PageShell>
    </section>
  );
}
