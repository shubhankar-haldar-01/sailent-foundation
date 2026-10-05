import { Suspense, type CSSProperties } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { AlertCircle, SearchX } from 'lucide-react';
import { Button } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CampaignListingSkeleton } from '@/components/campaigns/listing-skeleton';
import { CampaignSearchBar } from '@/components/campaigns/campaign-search-bar';
import { ViewMoreLink } from '@/components/campaigns/view-more-link';
import { CampaignsHero } from '@/components/campaigns/campaigns-hero';
import { CauseFilters } from '@/components/campaigns/cause-filters';
import {
  API_STATUS,
  MAX_PAGES,
  PAGE_SIZE,
  listingHref,
  parseListingQuery,
  type ListingQuery,
} from '@/components/campaigns/listing-query';
import { categoryKey } from '@/lib/categories';
import { getCampaignFilters, getCampaignListing, type CampaignListing } from '@/lib/content';
import { readDonorViewer } from '@/lib/donor/viewer';
import { buildMetadata } from '@/lib/seo/metadata';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION =
  'Support causes that create real change. Browse Sailent Foundation campaigns, see what each has raised against its goal, and donate to the one you care about.';

/**
 * One canonical URL for every filtered view, so a cause or a page count is
 * never indexed as a page of its own. A free-text SEARCH result is also kept
 * out of the index: it is whatever somebody typed, not a page anybody wrote.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = parseListingQuery(await searchParams);
  return buildMetadata({
    title: 'Campaigns',
    description: DESCRIPTION,
    path: '/campaigns',
    noIndex: q !== '',
  });
}

/**
 * The campaign listing.
 *
 * Hero, then search, then causes, then the cards — the order a visitor
 * narrows by. Everything is driven by the URL (see `listing-query.ts`), so the
 * search box, the cause tiles, the status menu and "View More" are all
 * shareable, back-button-safe, and work without scripting.
 *
 * The hero and search bar render at once. The causes and the cards wait on
 * the API inside a Suspense boundary KEYED ON THE QUERY: a new search or cause
 * swaps the grid for skeleton cards until its own results arrive, rather than
 * leaving the previous results on screen looking like the answer. "View More"
 * is the exception — it keeps what is there and adds to it.
 */
export default async function CampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseListingQuery(await searchParams);

  return (
    <>
      <CampaignsHero />

      <PageShell className="relative z-10 -mt-7">
        <div className="mx-auto max-w-4xl">
          <CampaignSearchBar query={query} />
        </div>
      </PageShell>

      <section aria-labelledby="campaign-results-title" className="pb-16 pt-8 md:pb-20">
        <PageShell>
          <div className="max-w-(--container-wide) mx-auto">
            <h2 id="campaign-results-title" className="sr-only">
              Campaigns
            </h2>
            {/*
              Keyed on everything EXCEPT the page count. "View More" must
              append to the cards already on screen, not tear them down for a
              skeleton — a remount collapses the page for a frame and throws
              the reader back up it.
            */}
            <Suspense
              key={listingHref({ ...query, page: 1 })}
              fallback={<CampaignListingSkeleton />}
            >
              <CampaignDiscovery query={query} />
            </Suspense>
          </div>
        </PageShell>
      </section>
    </>
  );
}

/**
 * The causes and the grid, fetched together.
 *
 * The cause list comes first, because the cause in the URL is resolved against
 * it before the cards can be asked for. What a signed-in donor has saved does
 * not depend on either, so that read starts straight away and overlaps both.
 */
async function CampaignDiscovery({ query }: { query: ListingQuery }) {
  const viewerRead = readDonorViewer();
  const filters = await getCampaignFilters().catch(failSoft({ categories: [], locations: [] }));

  /*
    RESOLVED, not merely present. The slug from the URL is matched against the
    categories campaigns actually have; a stale or mistyped one falls back to
    every campaign rather than to an empty page, and the tiles then show "All
    Causes" as selected — so the two halves of the page agree.
  */
  const activeCategory = query.category
    ? (filters.categories.find((name) => categoryKey(name) === categoryKey(query.category)) ?? null)
    : null;

  const [listing, viewer] = await Promise.all([
    getCampaignListing({
      q: query.q || undefined,
      category: activeCategory ?? undefined,
      status: API_STATUS[query.status],
      limit: PAGE_SIZE * query.page,
    }).catch(failSoft<CampaignListing | null>(null)),
    viewerRead,
  ]);

  const isFiltered = query.q !== '' || activeCategory !== null || query.status !== 'active';
  const returnTo = listingHref({ ...query, page: 1 });

  return (
    <>
      <CauseFilters categories={filters.categories} activeCategory={activeCategory} query={query} />

      {listing === null ? (
        <LoadError retryHref={listingHref(query)} />
      ) : (
        <>
          {/*
            What is on screen, said in words. Visible only once somebody has
            narrowed the list — the unfiltered page needs no caption — but always
            in the DOM for assistive technology.
          */}
          <p
            role="status"
            className={isFiltered ? 'text-body-sm text-muted-foreground mt-6' : 'sr-only'}
          >
            {resultSummary(listing, query, activeCategory)}
            {isFiltered ? (
              <>
                {' '}
                <Link
                  href="/campaigns"
                  scroll={false}
                  className="text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Clear filters
                </Link>
              </>
            ) : null}
          </p>

          {listing.items.length === 0 ? (
            <NoResults />
          ) : (
            <ul
              aria-label="Campaigns"
              className="mt-6 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {listing.items.map((campaign, index) => (
                /*
                  Each card rises in a beat after the one before. Counted per
                  page, so cards added by "View More" stagger from the first
                  of THEIR set rather than waiting behind the eight above.
                */
                <li
                  key={campaign.slug}
                  className="rise-in flex"
                  style={{ '--rise-delay': `${(index % PAGE_SIZE) * 70}ms` } as CSSProperties}
                >
                  <CampaignCard
                    campaign={campaign}
                    className="w-full"
                    // Every view, so a card's state is always on the card.
                    showStatus
                    save={{
                      signedIn: viewer.signedIn,
                      saved: viewer.savedIds.includes(campaign.id),
                      returnTo,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {listing.hasMore && query.page < MAX_PAGES ? (
            <ViewMoreLink href={listingHref({ ...query, page: query.page + 1 })} />
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * Catch a failed read and return `fallback` — but let Next.js's own control
 * flow (dynamic rendering bail-outs, redirects, not-found) through untouched,
 * because swallowing those breaks the page in ways that look unrelated.
 */
function failSoft<T>(fallback: T) {
  return (error: unknown): T => {
    unstable_rethrow(error);
    console.error('[campaigns] listing failed to load:', error);
    return fallback;
  };
}

function resultSummary(
  listing: CampaignListing,
  query: ListingQuery,
  category: string | null,
): string {
  const shown = listing.items.length;
  const noun = query.status === 'all' ? 'campaign' : `${query.status} campaign`;
  const scope = [category ? ` in ${category}` : '', query.q ? ` matching “${query.q}”` : ''].join(
    '',
  );

  return shown < listing.total
    ? `Showing ${shown} of ${listing.total} ${noun}s${scope}.`
    : `${listing.total} ${listing.total === 1 ? noun : `${noun}s`}${scope}.`;
}

function NoResults() {
  return (
    <div className="border-border bg-surface rise-in mt-6 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="bg-wash-mint text-wash-mint-ink-strong grid size-12 place-items-center rounded-full">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <p className="font-display text-h4 mt-4 font-bold">No campaigns found</p>
      <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
        Try another search or explore a different cause.
      </p>
      <Button asChild className="mt-5 font-bold">
        <Link href="/campaigns" scroll={false}>
          View All Campaigns
        </Link>
      </Button>
    </div>
  );
}

/**
 * The API could not be reached.
 *
 * Inline, under a hero and search bar that still work, rather than replacing
 * the page — and the retry is a link to this same listing, so it works with
 * or without scripting.
 */
function LoadError({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive-subtle rise-in mt-6 flex flex-col items-center rounded-2xl border px-6 py-14 text-center"
    >
      <AlertCircle className="text-destructive size-8" aria-hidden="true" />
      <p className="font-display text-h4 mt-3 font-bold">Unable to load campaigns</p>
      <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
        We couldn&apos;t load campaigns right now. Please try again.
      </p>
      <Button asChild variant="secondary" className="mt-5 font-bold">
        <a href={retryHref}>Try again</a>
      </Button>
    </div>
  );
}
