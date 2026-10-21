'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';

import { cn } from '@sailent/ui';

import { programsHref, type ProgramsQuery } from './programs-query';

/**
 * The search box in the programs toolbar.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A REAL GET FORM FIRST, A CLIENT NAVIGATION SECOND — the campaigns search's
 * pattern (`components/campaigns/campaign-search-bar.tsx`).
 *
 * With scripting off, Enter submits `?q=…` to /programs and the server
 * renders the match. With scripting on, the same submission is intercepted
 * to build a clean URL (no empty `q=`) and navigate without a reload or a
 * jump to the top. Emptying the box (the field's own clear button, or
 * deleting the text) lifts the search at once.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE INPUT IS UNCONTROLLED, ON PURPOSE. On a slow device the page is
 * readable before React has hydrated it, and a controlled input would then
 * overwrite whatever had been typed with its empty initial state — the text
 * vanished and Enter searched for nothing (seen on the WebKit tablet run).
 * `defaultValue` leaves the typed text alone; the `key` remounts the box when
 * the URL's search changes underneath it (the back button, "Clear filters"),
 * so it never shows a search the grid is no longer answering.
 *
 * The chosen area is carried along, so searching inside "Healthcare" stays
 * inside Healthcare. The page count is not: a new search starts from the
 * first page of its own results.
 */
export function ProgramSearch({ query, className }: { query: ProgramsQuery; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const current = query.q ?? '';

  function go(next: string) {
    const href = programsHref({ category: query.category, q: next.trim() || null });
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <form
      role="search"
      aria-label="Programs"
      action="/programs"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        go(String(new FormData(event.currentTarget).get('q') ?? ''));
      }}
      className={cn('relative', className)}
    >
      {query.category ? <input type="hidden" name="category" value={query.category} /> : null}

      <span
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute inset-y-0 left-4 grid place-items-center"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" strokeWidth={2} />
        )}
      </span>
      <label htmlFor="program-search" className="sr-only">
        Search programs
      </label>
      <input
        key={current}
        id="program-search"
        type="search"
        name="q"
        defaultValue={current}
        onChange={(event) => {
          if (event.target.value === '' && query.q) go('');
        }}
        maxLength={200}
        autoComplete="off"
        placeholder="Search programs..."
        aria-busy={pending || undefined}
        className={cn(
          'bg-background border-accent-100 dark:border-border text-foreground placeholder:text-muted-foreground h-12 w-full min-w-0 rounded-full border pl-11 pr-4 text-sm outline-none',
          'focus-visible:border-primary focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-0',
        )}
      />
    </form>
  );
}
