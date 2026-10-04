'use client';

import * as React from 'react';

import { cn } from '@sailent/ui';

import { donationRail } from '@/components/donations/donation-layout';

/** `lg:top-24`, where the rail pins when it fits the window. */
const PINNED_TOP = 96;
/** Space kept under the rail when it pins by its bottom edge. */
const BOTTOM_GAP = 16;

/**
 * The campaign page's side column: the donation card and the cards under it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT PINS BY WHICHEVER EDGE KEEPS IT ALL REACHABLE — WITHOUT A SCROLLBAR.
 *
 * When the column fits the window it pins at the top, under the header. When
 * it is taller — the donation card and the 80G / secure / trusted card
 * together are, on a laptop — `top` goes negative by the difference, so the
 * column first scrolls with the page and then pins by its BOTTOM edge. On
 * arrival the donation card is whole; a little way down, the cards under it
 * come into view and stay there, with the total and the Donate button above
 * them. A plain `top-24` would leave everything below the fold hidden until the
 * very end of the page.
 *
 * Measured with a ResizeObserver, not a scroll listener: `top` only changes
 * when the column or the window changes size — a basket growing, a phone
 * rotating — never on scroll. Below `lg` the column is not sticky and `top`
 * has no effect.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function StickyRail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [top, setTop] = React.useState<number | null>(null);

  React.useEffect(() => {
    const rail = ref.current;
    if (!rail || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const height = rail.offsetHeight;
      const fits = height + PINNED_TOP + BOTTOM_GAP <= window.innerHeight;
      setTop(fits ? null : window.innerHeight - height - BOTTOM_GAP);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(donationRail, className)}
      style={top === null ? undefined : { top }}
    >
      {children}
    </div>
  );
}
