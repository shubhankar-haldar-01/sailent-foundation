'use client';

import * as React from 'react';

import { cn } from '@sailent/ui';
import { PageShell } from '@/components/layout/page-shell';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CauseFilters } from '@/components/campaigns/cause-filters';
import { ViewMoreLink } from '@/components/campaigns/view-more-link';
import { categorySlug } from '@/lib/categories';
import type { DonorViewer } from '@/lib/donor/viewer';
import type { Campaign } from '@/lib/mock/types';

/** Two rows of four at desktop, as the campaigns page opens with. */
const VISIBLE_CARDS = 8;

/**
 * The campaigns page's own grid, on the homepage, just before "Who we are".
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IN ADDITION TO THE FEATURED BAND, NOT INSTEAD OF IT.
 *
 * The band under the hero stays as it is — the focus-area strip and four
 * featured cards. This is the campaigns page's layout brought onto the
 * homepage: its cause tiles, two rows of its cards, and its "View More
 * Campaigns" pill, built from the same components so the two pages cannot
 * drift apart.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The tiles are the causes the live campaigns actually have, and they narrow
 * the cards IN PLACE — toggles, not links, so choosing one costs no page load.
 * "View More Campaigns" is where it becomes a link, carrying the chosen cause
 * through to the full listing.
 *
 * Its selection is its own. The featured band above keeps its own, so pressing
 * a tile here never rearranges a section the reader has already scrolled past.
 *
 * Renders nothing when there are no campaigns.
 */
export function CampaignShowcase({
  campaigns,
  viewer,
  excludeCampaignIds,
}: {
  campaigns: Campaign[];
  /** Signed in, and what was saved — for the cards' save hearts. */
  viewer?: DonorViewer;
  /** Campaign IDs to de-duplicate against the featured rail above. */
  excludeCampaignIds?: string[];
}) {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  // In the same order the campaigns page lists them, so no tile leads nowhere.
  const categories = React.useMemo(
    () => [...new Set(campaigns.map((campaign) => campaign.category).filter(Boolean))].sort(),
    [campaigns],
  );

  // Narrowed in the browser from the list already fetched — instant, no spinner.
  // When browsing all causes, prioritizes fresh campaigns not already showcased
  // in the featured rail directly above, eliminating duplication.
  const matching = React.useMemo(() => {
    const list = activeCategory
      ? campaigns.filter((campaign) => campaign.category === activeCategory)
      : campaigns;

    if (!excludeCampaignIds || excludeCampaignIds.length === 0) {
      return list;
    }

    const excludedSet = new Set(excludeCampaignIds);
    const fresh = list.filter((campaign) => !excludedSet.has(campaign.id));
    const alreadyFeatured = list.filter((campaign) => excludedSet.has(campaign.id));

    return activeCategory ? list : [...fresh, ...alreadyFeatured];
  }, [campaigns, activeCategory, excludeCampaignIds]);

  const visible = matching.slice(0, VISIBLE_CARDS);

  if (campaigns.length === 0) return null;

  return (
    <section aria-labelledby="campaign-showcase-title" className="border-border band-y border-b">
      <PageShell>
        <div className="max-w-(--container-wide) mx-auto">
          {/* Section heading matching reference layout: centered eyebrow + dual-tone headline */}
          <div className="mx-auto mb-6 flex max-w-5xl flex-col items-center text-center sm:mb-8 md:mb-10">
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="h-0.5 w-6 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
              <p className="text-primary text-xs font-extrabold uppercase tracking-[0.2em] sm:text-[13px]">
                Browse By Cause
              </p>
              <span className="h-0.5 w-6 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
            </div>

            <h2
              id="campaign-showcase-title"
              className="font-display mt-1 text-2xl font-black leading-[1.2] tracking-tight sm:text-3xl md:text-[2.25rem]"
            >
              <span className="text-[#36335C] dark:text-indigo-200">Discover Causes That</span>{' '}
              <span className="text-primary dark:text-orange-400">Inspire You.</span>
            </h2>
          </div>

          <CauseFilters
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
          />

          {/* Always in the DOM, so a tile press is announced rather than silent. */}
          <p aria-live="polite" className="sr-only">
            {activeCategory
              ? `Showing ${matching.length} ${activeCategory} ${matching.length === 1 ? 'campaign' : 'campaigns'}.`
              : `Showing ${visible.length} of ${matching.length} campaigns.`}
          </p>

          {/*
            The campaigns page's grid and card: one, two, three, then four
            across, each card badged with its state and rising in a beat after
            the one before.
          */}
          <ul
            aria-label="Campaigns by cause"
            className="mt-6 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {visible.map((campaign, index) => (
              <li
                key={campaign.slug}
                className={cn('rise-in flex', index >= 6 && 'hidden md:flex')}
                style={{ '--rise-delay': `${index * 70}ms` } as React.CSSProperties}
              >
                <CampaignCard
                  campaign={campaign}
                  className="w-full"
                  showStatus
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

          {/* Carries the chosen cause through, so the listing opens on it. */}
          <ViewMoreLink
            direction="right"
            href={
              activeCategory ? `/campaigns?category=${categorySlug(activeCategory)}` : '/campaigns'
            }
            label={activeCategory ? `View More ${activeCategory} Campaigns` : 'View More Campaigns'}
          />
        </div>
      </PageShell>
    </section>
  );
}
