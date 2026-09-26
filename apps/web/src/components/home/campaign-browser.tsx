'use client';

import * as React from 'react';

import { FeaturedCampaigns } from '@/components/home/featured-campaigns';
import { FocusAreas } from '@/components/home/focus-areas';
import type { Campaign } from '@/lib/mock/types';

/**
 * The focus-area strip and the campaigns band, joined.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS COMPONENT EXISTS ONLY TO HOLD ONE PIECE OF STATE.
 *
 * The two bands are siblings on a server-rendered page, and one has to change
 * what the other shows. Something has to own "which area is selected", and the
 * options were a React context or a wrapper. A context for a single boolean-ish
 * value shared between two adjacent components is machinery without a purpose;
 * a wrapper is four lines and the data flow is visible in them.
 *
 * It renders no markup of its own. Both children stay full-width `<section>`
 * elements in the document, so the page's band rhythm and heading outline are
 * exactly what they were before this was introduced.
 *
 * The selection is DELIBERATELY NOT IN THE URL. Putting it in a query string
 * would make it shareable and survive the back button, which is genuinely
 * better — but in the App Router that means a router push and a server
 * round-trip on every press of a tile, and the request was for the row to
 * change without a page load. If this should become linkable later, the change
 * is `useState` to `useSearchParams` here and nowhere else.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignBrowser({ campaigns }: { campaigns: Campaign[] }) {
  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <>
      <FocusAreas selected={selected} onSelect={setSelected} />
      <FeaturedCampaigns campaigns={campaigns} activeCategory={selected} />
    </>
  );
}
