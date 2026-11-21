import { cn } from '@sailent/ui';

import { ProgramSearch } from './program-search';
import { type ProgramArea, type ProgramsQuery, type ProgramsView } from './programs-query';

/**
 * The toolbar above the programs grid: the search box and the count of
 * matching programmes.
 */
export function ProgramToolbar({
  query,
  view,
}: {
  areas?: ProgramArea[];
  query: ProgramsQuery;
  view: ProgramsView;
}) {
  const total = view.matching.length;

  return (
    <div
      className={cn(
        'bg-surface border-border dark:border-border mt-6 flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:gap-4 lg:px-5',
        'shadow-sm',
      )}
    >
      <ProgramSearch query={query} className="min-w-[12rem] flex-1" />

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
