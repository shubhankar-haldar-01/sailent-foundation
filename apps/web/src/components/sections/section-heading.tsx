import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * The section header used throughout the homepage: a small uppercase eyebrow,
 * a large heading, an optional lead, and an optional link to the full listing.
 *
 * The eyebrow is presentational — it repeats the section's subject in smaller
 * type — so it is NOT a heading element. Nesting an `h3` above an `h2` to get
 * the look would corrupt the document outline that screen-reader users
 * navigate by.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  viewAll,
  className,
  as: Heading = 'h2',
  align = 'left',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  viewAll?: { href: string; label: string };
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  align?: 'left' | 'center';
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-3',
        align === 'center' && 'flex-col items-center text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow ? (
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Heading className="font-display text-h1 mt-2 text-balance font-bold tracking-tight">
          {title}
        </Heading>
        {lead ? (
          <p className="text-body text-muted-foreground mt-3 leading-relaxed">{lead}</p>
        ) : null}
      </div>

      {viewAll ? (
        <Link
          href={viewAll.href}
          className={cn(
            'text-body-sm group inline-flex items-center gap-1.5 font-medium',
            'text-foreground hover:text-primary underline-offset-4 hover:underline',
            'focus-visible:outline-ring rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
        >
          {viewAll.label}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
