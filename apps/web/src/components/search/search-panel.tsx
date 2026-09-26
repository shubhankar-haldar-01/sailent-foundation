'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge, EmptyState, Input, Label, cn } from '@sailent/ui';

import { searchContent } from '@/lib/mock';
import type { SearchRecord } from '@/lib/mock/types';

/**
 * Site search — client-side over the mock index in Phase 2.
 *
 * The shape is what matters: a query string in, scored `SearchRecord`s out.
 * Phase 4 replaces `searchContent` with a Postgres full-text query behind the
 * API and this component is unchanged apart from becoming async.
 *
 * Results are announced via aria-live so a screen reader user knows the list
 * changed as they type.
 */
const TYPE_LABELS: Record<SearchRecord['type'], string> = {
  campaign: 'Campaign',
  program: 'Program',
  story: 'Story',
  blog: 'Article',
  event: 'Event',
};

export function SearchPanel() {
  const inputId = React.useId();
  const [query, setQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<SearchRecord['type'] | 'all'>('all');

  const allResults = React.useMemo(() => searchContent(query), [query]);
  const results = React.useMemo(
    () =>
      typeFilter === 'all' ? allResults : allResults.filter((item) => item.type === typeFilter),
    [allResults, typeFilter],
  );

  const hasQuery = query.trim().length >= 2;

  return (
    <div>
      <div className="max-w-2xl">
        <Label htmlFor={inputId}>Search the site</Label>
        <div className="relative mt-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Campaigns, programs, stories, articles…"
            className="text-body h-12 pl-11"
            autoComplete="off"
          />
        </div>
        <p className="text-caption text-muted-foreground mt-2">
          Searches campaigns, programs, stories, articles and events.
        </p>
      </div>

      {hasQuery ? (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            <TypeChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
              All ({allResults.length})
            </TypeChip>
            {(Object.keys(TYPE_LABELS) as SearchRecord['type'][]).map((type) => {
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
                <li key={result.id}>
                  <Link
                    href={result.href}
                    className="focus-visible:outline-ring group block py-5 focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    <Badge variant="neutral">{TYPE_LABELS[result.type]}</Badge>
                    <h2 className="text-h4 group-hover:text-primary mt-2 font-semibold">
                      {result.title}
                    </h2>
                    <p className="text-body-sm text-muted-foreground mt-1">{result.excerpt}</p>
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
