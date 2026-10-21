import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * "View More Campaigns" — the mint pill with a soft green glow, the same
 * design as the homepage's "View All Campaigns" (owner, 2026-10-15; it was an
 * amber pill between two leaf-tipped rules).
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
    <div className={cn('mt-10 flex items-center justify-center', className)}>
      <Link
        href={href}
        scroll={direction !== 'down'}
        className="bg-wash-mint text-wash-mint-ink-strong focus-visible:outline-ring duration-(--duration-base) ease-(--ease-out-soft) group/more inline-flex shrink-0 items-center gap-2 rounded-full px-7 py-3 text-sm font-bold shadow-[0_12px_28px_-6px_rgba(34,197,94,0.32)] transition-[translate,scale,box-shadow,filter] hover:shadow-[0_14px_30px_-5px_rgba(34,197,94,0.42)] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98] sm:text-base"
      >
        {label}
        {/*
          Moves while hovered, the way it is going: bounces down where more
          cards will land, leans right where a new page will open.
        */}
        <Arrow
          className={cn(
            'size-4.5',
            direction === 'down'
              ? 'motion-safe:group-hover/more:animate-bounce'
              : 'duration-(--duration-base) ease-(--ease-out-soft) transition-[translate] motion-safe:group-hover/more:translate-x-1',
          )}
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
