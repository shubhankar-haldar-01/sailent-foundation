import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * A section header: an optional small uppercase eyebrow, the heading, an
 * optional lead, and on the right either a link to the full listing or a
 * control of the section's own (a sort toggle, say).
 *
 * ONE HEADER FOR EVERY SECTION, so a page's sections share a rhythm: the same
 * weight, the same space under the title, the same place for "View all". The
 * heading is extra-bold with tight tracking — the page's strongest type after
 * its title — and the lead is set at body size, readable rather than a grey
 * footnote.
 *
 * The eyebrow is presentational — it repeats the section's subject in smaller
 * type — so it is NOT a heading element. Nesting an `h3` above an `h2` to get
 * the look would corrupt the document outline that screen-reader users
 * navigate by.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  viewAll,
  action,
  className,
  as: Heading = 'h2',
  size = 'lg',
  align = 'left',
}: {
  /** For `aria-labelledby` on the section this heads. */
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  viewAll?: { href: string; label: string };
  /** A control of the section's own, in the place a "View all" link would go. */
  action?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  /** `lg` for a homepage band, `md` for a section inside a page. */
  size?: 'lg' | 'md';
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
        <Heading
          id={id}
          className={cn(
            'font-display text-balance font-extrabold tracking-tight',
            size === 'lg' ? 'text-h1' : 'text-h2 leading-tight',
            eyebrow ? 'mt-2' : null,
          )}
        >
          {title}
        </Heading>
        {lead ? (
          <p
            className={cn(
              'text-body text-muted-foreground leading-relaxed',
              size === 'lg' ? 'mt-3' : 'mt-1.5',
            )}
          >
            {lead}
          </p>
        ) : null}
      </div>

      {action ??
        (viewAll ? (
          <Link
            href={viewAll.href}
            className={cn(
              'text-body-sm text-info-action group inline-flex items-center gap-1.5 font-semibold',
              'underline-offset-4 hover:underline',
              'focus-visible:outline-ring rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            {viewAll.label}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </Link>
        ) : null)}
    </div>
  );
}
