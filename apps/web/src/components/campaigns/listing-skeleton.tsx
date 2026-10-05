import { Skeleton } from '@sailent/ui';

import { CampaignCardSkeleton } from './campaign-card';

/**
 * The cause tiles and a row of cards, while the listing loads.
 *
 * Drawn at the real tiles' and cards' sizes so the page does not jump when the
 * results land. Four cards — one desktop row — rather than a full page: a
 * screen of grey boxes reads as a page that is broken, one row as one that is
 * arriving.
 */
export function CampaignListingSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading campaigns…
      </p>
      <div className="rail -mx-4 flex gap-3 overflow-hidden px-4 py-1 md:-mx-6 md:px-6 lg:mx-0 lg:justify-center lg:px-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[4.75rem] w-[8.25rem] shrink-0 rounded-xl" />
        ))}
      </div>
      <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="flex">
            <CampaignCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The search row's two pills, for the route-level loading state. */
export function CampaignSearchBarSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 md:flex-row">
      <Skeleton className="bg-surface ring-border h-14 flex-1 rounded-full shadow-md ring-1" />
      <Skeleton className="bg-surface ring-border h-14 rounded-full shadow-md ring-1 md:w-60" />
    </div>
  );
}
