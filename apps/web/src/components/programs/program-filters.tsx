import Link from 'next/link';

import { cn } from '@sailent/ui';

import { programsHref } from './programs-query';

/**
 * The area pills above the programs grid.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE AREAS ARE THE ONES PROGRAMMES ACTUALLY HAVE (`programAreas`), so a pill
 * never leads to an empty grid and a new area appears with its first
 * programme — nothing here is a fixed list.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Each pill is a LINK to its own listing URL, so it can be opened in a new
 * tab, shared, or used without scripting; `aria-current` marks the one in
 * force, and it is marked by more than colour — a filled pill and a heavier
 * label. A new area starts from its first page of cards.
 *
 * Below `lg` the row scrolls sideways rather than wrapping (only the row: the
 * page itself never scrolls sideways), bleeding to the screen edge so it reads
 * as scrollable.
 */
export function ProgramFilters({
  areas,
  activeArea,
}: {
  /** Area DISPLAY names, as the programmes carry them. */
  areas: string[];
  /** The resolved display name of the area in force, or null for all. */
  activeArea: string | null;
}) {
  const pills = [
    { label: 'All Programs', area: null },
    ...areas.map((area) => ({ label: area, area })),
  ];

  return (
    <nav aria-label="Filter programs by area">
      <ul
        className={cn(
          'rail flex snap-x gap-3 overflow-x-auto py-1',
          'min-[87.5rem]:gap-3 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:flex-wrap lg:gap-2.5 lg:overflow-visible lg:px-0',
          'scroll-px-4 md:scroll-px-6',
        )}
      >
        {pills.map((pill) => {
          const isActive = pill.area === activeArea;
          return (
            <li key={pill.label} className="shrink-0 snap-start">
              <Link
                href={programsHref({ category: pill.area })}
                scroll={false}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'min-[87.5rem]:px-5 inline-flex h-11 items-center whitespace-nowrap rounded-full border px-5 text-[0.9375rem] transition-colors lg:px-4',
                  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  isActive
                    ? 'bg-primary border-primary text-primary-foreground font-semibold shadow-[0_8px_18px_-10px_rgb(235_106_31/0.7)]'
                    : 'bg-surface border-border text-foreground hover:border-primary/50 hover:text-primary font-medium',
                )}
              >
                {pill.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
