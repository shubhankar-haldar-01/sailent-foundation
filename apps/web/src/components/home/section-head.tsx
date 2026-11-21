import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * A homepage band heading: the title, and an optional link to the full
 * listing on the far right. (The orange rule beside the title was retired
 * with the other heading flourishes, visual polish Phase 3, 2026-11-21.)
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
      <h2
        id={id}
        className="font-display text-section tracking-(--text-section--letter-spacing) font-semibold"
      >
        {title}
      </h2>

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
