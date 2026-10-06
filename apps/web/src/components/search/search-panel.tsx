'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge, EmptyState, Input, Label, cn } from '@sailent/ui';

import type { SearchHit, SearchType } from '@/lib/content/search';

/**
 * Site search (Phase 13: real).
 *
 * The query is a plain GET form (`/search?q=…`); the page asks the API on the
 * server and passes the hits in. Only PUBLISHED content is ever returned. The
 * type chips filter what came back, in the browser.
 *
 * The result count is announced via aria-live.
 */
const TYPE_LABELS: Record<SearchType, string> = {
  campaign: 'Campaign',
  program: 'Program',
  story: 'Story',
  blog: 'Article',
  event: 'Event',
};

export function SearchPanel({
  query,
  results: allResults,
}: {
  query: string;
  results: SearchHit[];
}) {
  const inputId = React.useId();
  const [typeFilter, setTypeFilter] = React.useState<SearchType | 'all'>('all');

  const results = React.useMemo(
    () =>
      typeFilter === 'all' ? allResults : allResults.filter((item) => item.type === typeFilter),
    [allResults, typeFilter],
  );

  const hasQuery = query.trim().length >= 2;

  return (
    <div>
      <form action="/search" method="get" role="search" className="max-w-2xl">
        <Label htmlFor={inputId}>Search the site</Label>
        <div className="relative mt-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id={inputId}
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Campaigns, programs, stories, articles…"
            className="text-body h-12 pl-11"
            autoComplete="off"
            minLength={2}
            maxLength={100}
          />
        </div>
        <p className="text-caption text-muted-foreground mt-2">
          Searches published campaigns, programs, stories, articles and events. Press Enter to
          search.
        </p>
      </form>

      {hasQuery ? (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            <TypeChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
              All ({allResults.length})
            </TypeChip>
            {(Object.keys(TYPE_LABELS) as SearchType[]).map((type) => {
              const count = allResults.filter((item) => item.type === type).length;
              if (count === 0) return null;
              return (
                <TypeChip
                  key={type}
                  active={typeFilter === type}
                  onClick={() => setTypeFilter(type)}
                >
                  {TYPE_LABELS[type]} ({count})
                </TypeChip>
              );
            })}
          </div>

          <p aria-live="polite" className="text-body-sm text-muted-foreground mt-6">
            <span data-numeric="">{results.length}</span>{' '}
            {results.length === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
          </p>

          {results.length === 0 ? (
            <EmptyState
              kind="no-results"
              title="Nothing matched that search"
              description="Try a shorter phrase, or browse campaigns and programs directly."
              className="mt-6"
            />
          ) : (
            <ul className="divide-border border-border mt-6 divide-y border-y">
              {results.map((result) => (
                <li key={result.href}>
                  <Link
                    href={result.href}
                    className="focus-visible:outline-ring group block py-5 focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    <Badge variant="neutral">{TYPE_LABELS[result.type]}</Badge>
                    <h2 className="text-h4 group-hover:text-primary mt-2 font-semibold">
                      {result.title}
                    </h2>
                    {result.excerpt ? (
                      <p className="text-body-sm text-muted-foreground mt-1">{result.excerpt}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-body text-muted-foreground mt-8">
          Type at least two characters to search.
        </p>
      )}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'text-body-sm min-h-10 rounded-md border px-3 font-medium transition-colors',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        active
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border-strong hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
