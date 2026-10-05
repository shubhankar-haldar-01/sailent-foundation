'use client';

import * as React from 'react';

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
}: {
  campaigns: Campaign[];
  /** Signed in, and what was saved — for the cards' save hearts. */
  viewer?: DonorViewer;
}) {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  // In the same order the campaigns page lists them, so no tile leads nowhere.
  const categories = React.useMemo(
    () => [...new Set(campaigns.map((campaign) => campaign.category).filter(Boolean))].sort(),
    [campaigns],
  );

  // Narrowed in the browser from the list already fetched — instant, no spinner.
  const matching = React.useMemo(
    () =>
      activeCategory
        ? campaigns.filter((campaign) => campaign.category === activeCategory)
        : campaigns,
    [campaigns, activeCategory],
  );

  const visible = matching.slice(0, VISIBLE_CARDS);

  if (campaigns.length === 0) return null;

  return (
    <section aria-labelledby="campaign-showcase-title" className="border-border band-y border-b">
      <PageShell>
        <div className="max-w-(--container-wide) mx-auto">
          {/* Named for assistive technology; the tiles and cards are the visible heading. */}
          <h2 id="campaign-showcase-title" className="sr-only">
            Browse campaigns by cause
          </h2>

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
                className="rise-in flex"
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
