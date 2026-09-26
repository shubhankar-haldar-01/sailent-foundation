import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * The short orange rule that marks a heading in the approved design.
 *
 * INLINE, to the right of the title and vertically centred on it — not a
 * underline beneath it. Decorative, so it is hidden from assistive tech.
 */
export function HeadingRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('bg-accent-rule block h-[3px] w-8 shrink-0 rounded-full', className)}
    />
  );
}

/**
 * A homepage band heading: title, the orange rule beside it, and an optional
 * link to the full listing on the far right.
 *
 * The heading is a real `h2` so the document outline a screen-reader user
 * navigates by stays intact, and `actions` renders after the link so a
 * carousel's arrows sit where the design puts them.
 */
export function SectionHead({
  id,
  title,
  lead,
  viewAll,
  actions,
  className,
}: {
  id: string;
  title: string;
  lead?: string;
  viewAll?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-2', className)}>
      <div className="flex items-center gap-3">
        <h2
          id={id}
          className="font-display text-section tracking-(--text-section--letter-spacing) font-bold"
        >
          {title}
        </h2>
        <HeadingRule />
      </div>

      {viewAll || actions ? (
        <div className="flex items-center gap-3">
          {viewAll ? (
            <Link
              href={viewAll.href}
              className="text-body-sm text-info-action focus-visible:outline-ring group inline-flex items-center gap-1.5 rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {viewAll.label}
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Link>
          ) : null}
          {actions}
        </div>
      ) : null}

      {lead ? <p className="text-body-sm text-muted-foreground w-full max-w-xl">{lead}</p> : null}
    </div>
  );
}
