import Link from 'next/link';
import { Check, LayoutGrid } from 'lucide-react';

import { cn } from '@sailent/ui';

import { CategoryIcon, categoryTone } from '@/components/home/category-icon';
import { categorySlug } from '@/lib/categories';

import { listingHref, type ListingQuery } from './listing-query';

/** The tile's mark tips and grows a touch when the tile is hovered. */
const TILE_ICON =
  'size-6 duration-(--duration-slow) ease-(--ease-out-soft) transition-[scale,rotate] motion-safe:group-hover:scale-115 motion-safe:group-hover:-rotate-6';

/** "All Causes" takes the mint the approved strip gives it. */
const ALL_TONE = {
  chip: 'bg-wash-mint/60 text-wash-mint-ink-strong',
  wash: 'bg-wash-mint',
};

/**
 * The cause tiles — on the campaigns page, and on the homepage's campaigns band.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE CAUSES ARE THE CATEGORIES CAMPAIGNS ACTUALLY HAVE.
 *
 * The list is derived from the live campaigns, so a tile can never lead to a
 * cause with nothing in it and a new category appears here the day its first
 * campaign is published — no second edit.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * TWO MODES, ONE LOOK:
 *   • `query` — LINKS. On the campaigns page each tile is a different listing
 *     with its own URL, so it can be opened in a new tab, shared, or reached
 *     without scripting. The search and status travel with it; the page count
 *     does not, because a new cause starts from its own first page.
 *     `aria-current` marks the one in force.
 *   • `onSelect` — BUTTONS. On the homepage they narrow the cards beneath
 *     without leaving the page, so they are toggles: `aria-pressed`, and
 *     pressing the chosen cause again goes back to all of them.
 *
 * The selected tile is marked THREE ways — a firmer wash, a ring in the
 * cause's own colour, and a tick beside the name. Colour is never the only
 * signal.
 *
 * Below `lg` the row scrolls sideways rather than wrapping: a block of tiles
 * stacked two-across is a screen of chrome on a phone before the first card.
 */
export function CauseFilters({
  categories,
  activeCategory,
  query,
  onSelect,
}: {
  /** Category DISPLAY names, as the campaigns carry them. */
  categories: string[];
  /** The resolved display name of the cause in force, or null for all. */
  activeCategory: string | null;
} & (
  | { query: ListingQuery; onSelect?: never }
  | { onSelect: (category: string | null) => void; query?: never }
)) {
  const tiles = [
    { name: 'All Causes', slug: null, tone: ALL_TONE },
    ...categories.map((name) => ({ name, slug: categorySlug(name), tone: categoryTone(name) })),
  ];

  const list = (
    <ul
      className={cn(
        'rail flex snap-x gap-3 overflow-x-auto py-1',
        // Bleed to the screen edge on a phone so the row reads as scrollable.
        '-mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:flex-wrap lg:justify-center lg:overflow-visible lg:px-0',
        // …and snap to inside that gutter, not to the bare screen edge.
        'scroll-px-4 md:scroll-px-6',
      )}
    >
      {tiles.map((tile) => {
        const isActive =
          tile.slug === null ? activeCategory === null : tile.name === activeCategory;
        const className = cn(
          'text-foreground group flex h-[4.75rem] w-[8.25rem] flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-center',
          'duration-(--duration-base) ease-(--ease-out-soft) transition-[translate,scale,box-shadow,background-color]',
          'focus-visible:outline-ring hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2',
          // Rises a little under the pointer and presses in when tapped.
          'motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97]',
          // `chip` sets the wash and the ink; the ink colours the icon,
          // and the label is set back to the heading navy below.
          isActive
            ? cn(tile.tone.chip, tile.tone.wash, 'shadow-sm ring-2 ring-inset ring-current')
            : tile.tone.chip,
        );
        const content = (
          <>
            {tile.slug === null ? (
              <LayoutGrid className={TILE_ICON} aria-hidden="true" />
            ) : (
              <CategoryIcon category={tile.name} className={TILE_ICON} />
            )}
            <span
              className={cn(
                'text-caption text-foreground inline-flex items-center gap-1 text-balance leading-tight',
                isActive ? 'font-bold' : 'font-medium',
              )}
            >
              {isActive ? <Check className="size-3 shrink-0" aria-hidden="true" /> : null}
              {tile.name}
            </span>
          </>
        );

        return (
          <li key={tile.name} className="shrink-0 snap-start">
            {onSelect ? (
              <button
                type="button"
                aria-pressed={isActive}
                // The chosen cause again means "all of them" — a toggle needs a way back.
                onClick={() => onSelect(tile.slug === null || isActive ? null : tile.name)}
                className={cn(className, 'cursor-pointer')}
              >
                {content}
              </button>
            ) : (
              <Link
                href={listingHref({ q: query.q, status: query.status, category: tile.slug })}
                scroll={false}
                aria-current={isActive ? 'true' : undefined}
                className={className}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );

  return onSelect ? (
    <div role="group" aria-label="Filter campaigns by cause">
      {list}
    </div>
  ) : (
    <nav aria-label="Filter campaigns by cause">{list}</nav>
  );
}
