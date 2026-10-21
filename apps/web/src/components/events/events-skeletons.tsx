import { Skeleton } from '@sailent/ui';

/**
 * The upcoming-events area's loading shape, block for block: the search box
 * and the date menu, then a screen of cards — the same frame ratio, padding
 * and rows as `EventListingCard` — so the real ones replace it without
 * anything moving.
 *
 * Shown on the FIRST arrival only. A new search, month or page afterwards is
 * a navigation in a transition, which keeps the current cards on screen
 * (dimmed) until the new ones arrive, as on /campaigns.
 */
export function UpcomingEventsSkeleton() {
  return (
    <div aria-busy="true">
      {/* Said, not drawn: the shapes below are hidden from assistive technology. */}
      <p role="status" className="sr-only">
        Loading upcoming events…
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem] lg:gap-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="border-border/60 bg-surface flex flex-col overflow-hidden rounded-[1.125rem] border shadow-sm">
      <Skeleton className="aspect-[15/8] w-full rounded-none" />
      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-4">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="mt-1 h-3.5 w-2/3" />
        <div className="mt-3 flex items-center justify-between">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}
