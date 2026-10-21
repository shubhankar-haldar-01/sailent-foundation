'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const SORT_OPTIONS = [
  { value: '-donationDate', label: 'Newest first' },
  { value: 'donationDate', label: 'Oldest first' },
  { value: '-amount', label: 'Highest amount first' },
  { value: 'amount', label: 'Lowest amount first' },
] as const;

export function DonationsControls({
  currentQuery = '',
  currentSort = '-donationDate',
}: {
  currentQuery?: string;
  currentSort?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(currentQuery);

  const updateParam = useCallback(
    (name: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (value && value.trim()) {
        params.set(name, value.trim());
      } else {
        params.delete(name);
      }
      // Reset to page 1 on search or sort change
      params.delete('page');

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('q', query);
  };

  const handleClear = () => {
    setQuery('');
    updateParam('q', '');
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-72 sm:flex-initial">
        <label htmlFor="donations-search" className="sr-only">
          Search campaigns or transaction ID
        </label>
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[2]"
          aria-hidden="true"
        />
        <input
          id="donations-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search campaigns, transaction ID..."
          className="bg-surface text-foreground placeholder:text-muted-foreground/70 border-border/80 focus-visible:border-primary focus-visible:ring-primary/20 h-8.5 w-full rounded-full border pl-9 pr-8 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
            aria-label="Clear search query"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {/* Sort Select */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="donations-sort"
          className="text-caption text-muted-foreground shrink-0 font-medium"
        >
          Sort by
        </label>
        <div className="relative">
          <select
            id="donations-sort"
            value={currentSort}
            onChange={(e) => updateParam('sort', e.target.value)}
            disabled={isPending}
            className="bg-surface text-foreground border-border/80 focus-visible:border-primary focus-visible:ring-primary/20 h-8.5 pr-7.5 cursor-pointer appearance-none rounded-xl border py-1.5 pl-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 stroke-[2]"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
