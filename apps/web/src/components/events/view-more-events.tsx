'use client';

import Link, { useLinkStatus } from 'next/link';
import { ChevronDown, Loader2 } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * "View More Events" — the outlined orange pill centred under the grid, as
 * the owner's design (2026-10-17) draws it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A LINK TO THE NEXT PAGE OF THE SAME LISTING, NEVER A FETCH OF ITS OWN — the
 * campaigns and programs pattern. The server renders the longer list, so it
 * can be opened in a new tab, carries the search and the month in force,
 * and cannot repeat a card (page two is the first twelve of one ordering).
 * It does not scroll: the new cards land below the ones already read. The
 * page leaves it out once every match is showing.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * WHILE THE NEXT PAGE IS ON ITS WAY the label says so with a spinner, the
 * pill stops taking clicks (so a second press cannot queue a second
 * navigation), and the empty `data-pending` marker lets the page dim the
 * cards with CSS alone — the same signal the search and the date menu give.
 */
export function ViewMoreEvents({ href, className }: { href: string; className?: string }) {
  return (
    <div className={cn('mt-8 flex justify-center md:mt-10', className)}>
      <Link
        href={href}
        scroll={false}
        className={cn(
          'border-primary bg-surface text-primary-ink group/more shadow-xs inline-flex h-11 items-center gap-2 rounded-full border px-8 text-[0.9375rem] font-bold sm:h-12 sm:px-10',
          'duration-(--duration-base) ease-(--ease-out-soft) transition-[background-color,box-shadow,translate]',
          'hover:bg-primary-soft hover:shadow-sm motion-safe:active:translate-y-px',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          'has-[[data-pending]]:pointer-events-none has-[[data-pending]]:cursor-progress',
        )}
      >
        <Label />
      </Link>
    </div>
  );
}

/** Inside the link, because `useLinkStatus` reads the link it is rendered in. */
function Label() {
  const { pending } = useLinkStatus();

  return pending ? (
    <>
      <span data-pending="" hidden />
      <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
      Loading more events…
    </>
  ) : (
    <>
      View More Events
      <ChevronDown
        className="size-4.5 duration-(--duration-base) transition-transform motion-safe:group-hover/more:translate-y-0.5"
        aria-hidden="true"
      />
    </>
  );
}
