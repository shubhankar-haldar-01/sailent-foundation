import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';

import { cn } from '@sailent/ui';

import { CategoryIcon } from '@/components/home/category-icon';
import { categorySlug } from '@/lib/categories';

import { LinkPendingMark } from './link-pending-mark';
import { listingHref, type ListingQuery } from './listing-query';

function normaliseCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '')
    .replace(/and/g, '');
}

interface CauseCardStyle {
  cardBg: string;
  badgeBg: string;
  iconColor: string;
  shadow: string;
  activeBorder: string;
  activeText: string;
}

const CAUSE_STYLES: Record<string, CauseCardStyle> = {
  all: {
    cardBg: 'bg-wash-mint/50',
    badgeBg: 'bg-wash-mint',
    iconColor: 'text-wash-mint-ink-strong',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-mint-ink-strong',
    activeText: 'text-wash-mint-ink-strong',
  },
  animalwelfare: {
    cardBg: 'bg-wash-amber/50',
    badgeBg: 'bg-wash-amber',
    iconColor: 'text-wash-amber-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-amber-ink',
    activeText: 'text-wash-amber-ink',
  },
  childwelfare: {
    cardBg: 'bg-wash-violet/50',
    badgeBg: 'bg-wash-violet',
    iconColor: 'text-wash-violet-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-violet-ink',
    activeText: 'text-wash-violet-ink',
  },
  disasterrelief: {
    cardBg: 'bg-wash-blue/50',
    badgeBg: 'bg-wash-blue',
    iconColor: 'text-wash-blue-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-blue-ink',
    activeText: 'text-wash-blue-ink',
  },
  education: {
    cardBg: 'bg-wash-blue/50',
    badgeBg: 'bg-wash-blue',
    iconColor: 'text-wash-blue-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-blue-ink',
    activeText: 'text-wash-blue-ink',
  },
  environment: {
    cardBg: 'bg-wash-mint/50',
    badgeBg: 'bg-wash-mint',
    iconColor: 'text-wash-mint-ink-strong',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-mint-ink-strong',
    activeText: 'text-wash-mint-ink-strong',
  },
  healthcare: {
    cardBg: 'bg-wash-rose/50',
    badgeBg: 'bg-wash-rose',
    iconColor: 'text-wash-rose-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-rose-ink',
    activeText: 'text-wash-rose-ink',
  },
  health: {
    cardBg: 'bg-wash-rose/50',
    badgeBg: 'bg-wash-rose',
    iconColor: 'text-wash-rose-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-rose-ink',
    activeText: 'text-wash-rose-ink',
  },
  livelihood: {
    cardBg: 'bg-wash-coral/50',
    badgeBg: 'bg-wash-coral',
    iconColor: 'text-wash-coral-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-coral-ink',
    activeText: 'text-wash-coral-ink',
  },
  womenempowerment: {
    cardBg: 'bg-wash-pink/50',
    badgeBg: 'bg-wash-pink',
    iconColor: 'text-wash-pink-ink',
    shadow: 'shadow-elevated',
    activeBorder: 'border-2 border-wash-pink-ink',
    activeText: 'text-wash-pink-ink',
  },
};

const DEFAULT_STYLE: CauseCardStyle = {
  cardBg: 'bg-surface',
  badgeBg: 'bg-muted',
  iconColor: 'text-foreground',
  shadow: 'shadow-elevated',
  activeBorder: 'border-2 border-wash-mint-ink-strong',
  activeText: 'text-wash-mint-ink-strong',
};

function getCauseStyle(name: string | null): CauseCardStyle {
  if (!name || name === 'All Causes') return CAUSE_STYLES.all ?? DEFAULT_STYLE;
  return CAUSE_STYLES[normaliseCategory(name)] ?? DEFAULT_STYLE;
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
    { name: 'All Causes', slug: null },
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
          'group flex h-[6.5rem] w-[6.75rem] sm:h-[6.85rem] sm:w-[7.25rem] md:h-[7.2rem] md:w-[7.6rem] shrink-0 flex-col items-center justify-center rounded-[20px] p-2.5 text-center',
          'duration-200 ease-out transition-[transform,box-shadow,border-color,background-color]',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          'motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.97]',
          style.cardBg,
          style.shadow,
          isActive
            ? cn(style.activeBorder, 'shadow-lg')
            : 'border border-white/80 hover:border-black/5',
        );

        const content = (
          <>
            <span
              className={cn(
                'sm:size-11.5 mb-2 grid size-11 shrink-0 place-items-center rounded-full transition-transform duration-200 motion-safe:group-hover:scale-105',
                style.badgeBg,
                style.iconColor,
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
                isActive ? cn('font-bold', style.activeText) : 'text-foreground font-semibold',
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
