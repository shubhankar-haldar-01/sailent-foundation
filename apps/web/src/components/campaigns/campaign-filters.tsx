'use client';

import * as React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@sailent/ui';

import { CampaignCard } from './campaign-card';
import { categoryKey } from '@/lib/categories';
import type { Campaign } from '@/lib/mock/types';

/**
 * Campaign listing with filters.
 *
 * Client-side in Phase 2 because there is no API to query. The filter STATE
 * shape mirrors what the Phase 4 endpoint will accept, so moving this to
 * server-side filtering with URL params is a swap of the data source rather
 * than a rewrite of the interface.
 *
 * Sorting defaults to "most urgent" by real end date. Campaigns without a
 * deadline sort last rather than being given an invented one.
 */

type SortKey = 'urgent' | 'newest' | 'closest' | 'furthest' | 'supporters';

const SORT_LABELS: Record<SortKey, string> = {
  urgent: 'Most urgent',
  newest: 'Newest first',
  closest: 'Closest to goal',
  furthest: 'Furthest from goal',
  supporters: 'Most supporters',
};

export function CampaignFilters({
  campaigns,
  programs,
  categories,
  locations,
  initialCategory,
}: {
  campaigns: Campaign[];
  programs: { slug: string; name: string }[];
  categories: string[];
  locations: string[];
  /**
   * A category SLUG from the URL — how the homepage's focus-area strip hands
   * its selection over. Resolved to the matching display name here, because
   * that is what the filter and the campaign rows are keyed on.
   */
  initialCategory?: string | null;
}) {
  const [program, setProgram] = React.useState('all');
  const [category, setCategory] = React.useState(() => {
    if (!initialCategory) return 'all';
    // An unknown slug falls back to "all" rather than filtering to nothing —
    // a hand-typed or stale URL should show the page, not an empty one.
    const key = categoryKey(initialCategory);
    return categories.find((name) => categoryKey(name) === key) ?? 'all';
  });
  const [location, setLocation] = React.useState('all');
  const [status, setStatus] = React.useState('active');
  const [sort, setSort] = React.useState<SortKey>('urgent');
  const [showFilters, setShowFilters] = React.useState(false);

  const activeFilters = [
    program !== 'all' && {
      key: 'program',
      label: programs.find((p) => p.slug === program)?.name ?? program,
      clear: () => setProgram('all'),
    },
    category !== 'all' && { key: 'category', label: category, clear: () => setCategory('all') },
    location !== 'all' && { key: 'location', label: location, clear: () => setLocation('all') },
    status !== 'active' && {
      key: 'status',
      label: status === 'all' ? 'All statuses' : 'Completed',
      clear: () => setStatus('active'),
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const clearAll = () => {
    setProgram('all');
    setCategory('all');
    setLocation('all');
    setStatus('active');
  };

  const filtered = React.useMemo(() => {
    const result = campaigns.filter((campaign) => {
      if (program !== 'all' && campaign.programSlug !== program) return false;
      if (category !== 'all' && campaign.category !== category) return false;
      if (location !== 'all' && campaign.location !== location) return false;
      if (status === 'active' && campaign.status !== 'active') return false;
      if (status === 'completed' && campaign.status !== 'completed') return false;
      return true;
    });

    const percent = (c: Campaign) => (c.goalAmount > 0 ? c.amountRaised / c.goalAmount : 0);

    return result.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
        case 'closest':
          return percent(b) - percent(a);
        case 'furthest':
          return percent(a) - percent(b);
        case 'supporters':
          return b.donorCount - a.donorCount;
        case 'urgent':
        default: {
          // Campaigns with no real deadline sort last rather than being given one.
          if (!a.endsAt && !b.endsAt) return 0;
          if (!a.endsAt) return 1;
          if (!b.endsAt) return -1;
          return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
        }
      }
    });
  }, [campaigns, program, category, location, status, sort]);

  return (
    <div>
      <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
          aria-controls="campaign-filter-panel"
          className="md:hidden"
        >
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {activeFilters.length > 0 ? <Badge variant="accent">{activeFilters.length}</Badge> : null}
        </Button>

        <div
          id="campaign-filter-panel"
          className={cn(
            'flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap',
            !showFilters && 'hidden md:flex',
          )}
        >
          <FilterSelect
            label="Program"
            value={program}
            onChange={setProgram}
            options={[
              { value: 'all', label: 'All programs' },
              ...programs.map((p) => ({ value: p.slug, label: p.name })),
            ]}
          />
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: 'All categories' },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
          <FilterSelect
            label="Location"
            value={location}
            onChange={setLocation}
            options={[
              { value: 'all', label: 'All locations' },
              ...locations.map((l) => ({ value: l, label: l })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>

        <div className="md:ml-auto md:shrink-0">
          <FilterSelect
            label="Sort by"
            value={sort}
            onChange={(value) => setSort(value as SortKey)}
            options={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
              value: key,
              label: SORT_LABELS[key],
            }))}
          />
        </div>
      </div>

      {activeFilters.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={filter.clear}
              className="border-border-strong text-caption hover:bg-muted focus-visible:outline-ring inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {filter.label}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">Remove this filter</span>
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      ) : null}

      <p aria-live="polite" className="text-body-sm text-muted-foreground mt-6">
        <span data-numeric="">{filtered.length}</span>{' '}
        {filtered.length === 1 ? 'campaign' : 'campaigns'}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          kind="no-results"
          title="No campaigns match these filters"
          description="Try removing one of the filters you have applied, or browse everything."
          onClearFilters={clearAll}
          className="mt-6"
        />
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.slug} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full sm:w-auto sm:min-w-44" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
