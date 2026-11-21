import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';

import { cn } from '@sailent/ui';

import { CategoryIcon } from '@/components/home/category-icon';
import { categorySlug } from '@/lib/categories';

import { LinkPendingMark } from './link-pending-mark';
import { listingHref, type ListingQuery } from './listing-query';

interface CauseCardStyle {
  cardBg: string;
  badgeBg: string;
  iconColor: string;
  shadow: string;
  activeBorder: string;
  activeText: string;
}

/**
 * ONE STYLE FOR EVERY TILE (visual polish Phase 4, 2026-11-21): a neutral
 * bordered tile with a grey icon; the selected tile takes the brand border,
 * tint and ink. The tiles used to carry a pastel hue each (§11 item 1 keeps
 * the tiles and their layout; only their colours changed).
 */
const TILE_STYLE: CauseCardStyle = {
  cardBg: 'bg-surface',
  badgeBg: 'bg-muted',
  iconColor: 'text-muted-foreground',
  shadow: '',
  activeBorder: 'border-primary bg-accent',
  activeText: 'text-primary',
};

function getCauseStyle(_name: string | null): CauseCardStyle {
  return TILE_STYLE;
}

/**
 * The cause tiles — on the campaigns page, and on the homepage's campaigns band.
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
    { name: 'All causes', slug: null },
    ...categories.map((name) => ({ name, slug: categorySlug(name) })),
  ];

  const list = (
    <ul
      className={cn(
        'rail flex snap-x items-center gap-2.5 overflow-x-auto px-3 py-5 sm:gap-3 md:gap-3.5',
        // Bleed to screen edge on mobile so rail reads as scrollable.
        '-mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:flex-nowrap lg:justify-center lg:overflow-x-auto xl:overflow-visible',
        'scroll-px-4 md:scroll-px-6',
      )}
    >
      {tiles.map((tile) => {
        const isActive =
          tile.slug === null ? activeCategory === null : tile.name === activeCategory;
        const style = getCauseStyle(tile.slug === null ? null : tile.name);

        const className = cn(
          'group flex h-[6.5rem] w-[6.75rem] sm:h-[6.85rem] sm:w-[7.25rem] md:h-[7.2rem] md:w-[7.6rem] shrink-0 flex-col items-center justify-center rounded-xl border p-2.5 text-center',
          'duration-200 ease-out transition-[transform,box-shadow,border-color,background-color]',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          'active:scale-[0.98] motion-reduce:active:scale-100',
          style.cardBg,
          style.shadow,
          isActive ? style.activeBorder : 'border-border hover:border-border-strong',
        );

        const content = (
          <>
            <span
              className={cn(
                'sm:size-11.5 mb-2 grid size-11 shrink-0 place-items-center rounded-full',
                isActive ? 'bg-surface text-primary' : cn(style.badgeBg, style.iconColor),
              )}
            >
              {tile.slug === null ? (
                <LayoutGrid className="sm:size-5.5 size-5" aria-hidden="true" />
              ) : (
                <CategoryIcon category={tile.name} className="sm:size-5.5 size-5" />
              )}
            </span>
            <span
              className={cn(
                'inline-flex items-center justify-center gap-1 px-1 text-center text-xs leading-tight tracking-tight sm:text-[13px]',
                isActive ? cn('font-semibold', style.activeText) : 'text-foreground font-medium',
              )}
            >
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
                className={cn(
                  className,
                  // The tapped tile answers at once, while its results load (`LinkPendingMark`).
                  'has-[[data-pending]]:ring-primary/60 has-[[data-pending]]:-translate-y-1 has-[[data-pending]]:ring-2',
                )}
              >
                {content}
                <LinkPendingMark />
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
