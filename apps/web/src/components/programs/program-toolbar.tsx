import { cn } from '@sailent/ui';

import { categoryKey } from '@/lib/categories';

import { ProgramSearch } from './program-search';
import { ProgramsMenu } from './programs-menu';
import {
  programsHref,
  type ProgramArea,
  type ProgramsQuery,
  type ProgramsView,
} from './programs-query';

/**
 * The toolbar above the programs grid, as the owner's design (2026-10-14,
 * third version) draws it: the "All categories" menu, the search box and the
 * count of matching programmes — one white panel. (The area chips, "More
 * filters", "Sort by" and "Clear filters" of the earlier versions were
 * removed at the owner's request the same day.)
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE AREAS ARE THE ONES PROGRAMMES ACTUALLY HAVE (`programAreaOptions`), so
 * a menu entry never leads to an empty grid and a new area appears with its
 * first programme — nothing here is a fixed list.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Both controls lead to listing URLs and keep each other: picking an area
 * keeps the search, and searching keeps the area. The way back is in the
 * controls themselves — "All categories" in the menu, and an emptied box.
 *
 * On one row from `sm`. On a phone the menu and the count share the first
 * row and the search takes the second.
 */
export function ProgramToolbar({
  areas,
  query,
  view,
}: {
  areas: ProgramArea[];
  query: ProgramsQuery;
  view: ProgramsView;
}) {
  const { activeArea } = view;
  const total = view.matching.length;

  const areaHref = (area: string | null) => programsHref({ category: area, q: query.q });
  const isCurrent = (area: string) =>
    activeArea !== null && categoryKey(area) === categoryKey(activeArea);

  return (
    <div
      className={cn(
        'bg-surface border-accent-100 dark:border-border mt-6 flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:gap-4 lg:px-5',
        'shadow-[0_1px_2px_rgb(16_42_67/0.04),0_8px_20px_-12px_rgb(16_42_67/0.14)]',
      )}
    >
      {/* One area or none is nothing to choose between. */}
      {areas.length > 1 ? (
        <ProgramsMenu
          label={activeArea ?? 'All categories'}
          items={[
            {
              label: 'All categories',
              href: areaHref(null),
              current: activeArea === null,
              accent: 'all',
            },
            ...areas.map((area) => ({
              label: area.name,
              href: areaHref(area.name),
              current: isCurrent(area.name),
              accent: area.accent,
            })),
          ]}
        />
      ) : null}

      <ProgramSearch
        query={query}
        className="min-w-[12rem] flex-1 max-sm:order-last max-sm:basis-full"
      />

      {/* What is on screen, in words — announced when a control changes it. */}
      <p
        role="status"
        className="text-muted-foreground ml-auto whitespace-nowrap pr-1 text-[0.9375rem] lg:pr-2"
      >
        <span data-numeric="">{total}</span> {total === 1 ? 'program' : 'programs'}
        <span className="sr-only">{detail(view, query)}</span>
      </p>
    </div>
  );
}

/** The rest of the status, for a screen reader: scope, search and how many of the matches are showing. */
function detail(view: ProgramsView, query: ProgramsQuery): string {
  const parts: string[] = [];
  if (view.activeArea) parts.push(` in ${view.activeArea}`);
  if (query.q) parts.push(` matching “${query.q}”`);
  if (view.visible.length < view.matching.length) {
    parts.push(`, showing ${view.visible.length}`);
  }
  return parts.length ? `${parts.join('')}.` : '.';
}
