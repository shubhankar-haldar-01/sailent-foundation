import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

import { LeafSolid } from '@/components/home/focus-icons';

/**
 * "View More Campaigns" — the amber pill between two leaf-tipped rules.
 *
 * One component for both places it appears, so they cannot drift apart:
 *   • the campaigns page, where it loads the next page of cards BELOW the
 *     ones already there — so its arrow points down and the page does not
 *     scroll (`direction="down"`);
 *   • the homepage, where it goes to the full listing — so its arrow points
 *     onward and the new page opens at its top (`direction="right"`).
 *
 * A link either way, never a script: it works without JavaScript, can be
 * opened in a new tab, and the server renders whatever it leads to.
 */
export function ViewMoreLink({
  href,
  label = 'View More Campaigns',
  direction = 'down',
  className,
}: {
  href: string;
  label?: string;
  direction?: 'down' | 'right';
  className?: string;
}) {
  const Arrow = direction === 'down' ? ArrowDown : ArrowRight;

  return (
    <div className={cn('mt-10 flex items-center justify-center gap-4', className)}>
      <Flourish />
      <Link
        href={href}
        scroll={direction !== 'down'}
        className="bg-wash-amber text-foreground text-body-sm focus-visible:outline-ring duration-(--duration-base) ease-(--ease-out-soft) group/more inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-8 font-bold shadow-sm transition-[translate,scale,box-shadow,filter] hover:shadow-md hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]"
      >
        {label}
        {/*
          Moves while hovered, the way it is going: bounces down where more
          cards will land, leans right where a new page will open.
        */}
        <Arrow
          className={cn(
            'size-4',
            direction === 'down'
              ? 'motion-safe:group-hover/more:animate-bounce'
              : 'duration-(--duration-base) ease-(--ease-out-soft) transition-[translate] motion-safe:group-hover/more:translate-x-1',
          )}
          aria-hidden="true"
        />
      </Link>
      <Flourish flipped />
    </div>
  );
}

/** A rule with a leaf at its inner end, either side of the pill. Decorative. */
function Flourish({ flipped = false }: { flipped?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'hidden flex-1 items-center gap-2 sm:flex sm:max-w-40',
        flipped && 'flex-row-reverse',
      )}
    >
      <span className="bg-border h-px flex-1" />
      <LeafSolid className={cn('text-wash-mint-ink/45 size-5', flipped && '-scale-x-100')} />
    </span>
  );
}
