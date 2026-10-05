'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';

import { cn } from '@sailent/ui';

import { CampaignStatusMenu } from './campaign-status-menu';
import { listingHref, type CampaignStatusFilter, type ListingQuery } from './listing-query';

/**
 * Search and the status filter, on one row at desktop and stacked on a phone.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A REAL GET FORM FIRST, A CLIENT NAVIGATION SECOND.
 *
 * With scripting off this submits `?q=…&status=…` to /campaigns and the server
 * renders the result — the API's own search does the matching. With scripting
 * on, the same submission is intercepted to build a clean URL (no empty
 * `q=`) and navigate without a full reload or a jump to the top of the page.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The chosen cause is carried along, so searching inside "Education" stays
 * inside Education. "View More" is not: a new search starts from the first
 * page of its own results.
 *
 * The status menu applies on pick, like the cause tiles beside it. It narrows
 * what is on this page; it does not move focus or open anything. Unlike the
 * search box it needs scripting — the cause tiles and the search still work
 * without it.
 */
export function CampaignSearchBar({ query }: { query: ListingQuery }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  /*
    Controlled, and re-synced when the URL changes underneath — the back
    button, or a cause tile clearing the search — so the box never shows a
    query the grid is no longer answering.
  */
  const [q, setQ] = React.useState(query.q);
  const [status, setStatus] = React.useState<CampaignStatusFilter>(query.status);
  const [synced, setSynced] = React.useState(query);
  if (synced.q !== query.q || synced.status !== query.status) {
    setSynced(query);
    setQ(query.q);
    setStatus(query.status);
  }

  function go(next: { q: string; status: CampaignStatusFilter }) {
    const href = listingHref({ ...next, category: query.category });
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <form
      role="search"
      aria-label="Campaigns"
      action="/campaigns"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        go({ q, status });
      }}
      className="flex flex-col gap-3 md:flex-row md:items-center"
    >
      {query.category ? <input type="hidden" name="category" value={query.category} /> : null}

      <div
        className={cn(
          'bg-surface ring-border group/search relative flex flex-1 items-center rounded-full shadow-md ring-1',
          'focus-within:ring-ring focus-within:ring-2',
          // Deepens under the pointer and while typing.
          'duration-(--duration-slow) ease-(--ease-out-soft) transition-shadow focus-within:shadow-lg hover:shadow-lg',
        )}
      >
        <Search
          className="text-muted-foreground group-focus-within/search:text-wash-mint-ink duration-(--duration-base) pointer-events-none absolute left-5 size-5 transition-colors"
          aria-hidden="true"
        />
        <label htmlFor="campaign-search" className="sr-only">
          Search campaigns
        </label>
        <input
          id="campaign-search"
          type="search"
          name="q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          maxLength={200}
          autoComplete="off"
          placeholder="Search campaigns, causes or keywords..."
          className="text-body-sm placeholder:text-muted-foreground pl-13 pr-30 h-14 w-full min-w-0 rounded-full bg-transparent outline-none sm:pr-32"
        />
        <button
          type="submit"
          aria-busy={pending || undefined}
          className={cn(
            'bg-wash-mint-ink text-body-sm absolute right-1.5 inline-flex h-11 items-center gap-2 rounded-full px-5 font-bold text-white sm:px-7',
            'hover:bg-wash-mint-ink-strong duration-(--duration-base) ease-(--ease-out-soft) transition-[translate,scale,box-shadow,background-color]',
            'hover:shadow-md motion-safe:hover:-translate-y-px motion-safe:active:scale-[0.97]',
            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Search
        </button>
      </div>

      {/* Wide enough for the longest name, "Completed Campaigns", in full. */}
      <div className="md:w-[15.5rem] md:shrink-0">
        <CampaignStatusMenu
          value={status}
          onChange={(next) => {
            setStatus(next);
            go({ q, status: next });
          }}
        />
      </div>
    </form>
  );
}
