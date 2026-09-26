import Link from 'next/link';

import { cn } from '@sailent/ui';

import { siteConfig } from '@/lib/site-config';

/**
 * The brand lockup: mark, wordmark, tagline.
 *
 * One component for the header and the footer so the two can never drift. The
 * mark is inline SVG rather than an image file: it is three paths, it inherits
 * `currentColor` so it works on both the light header and the dark footer
 * without a second asset, and it costs no request.
 */

export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-full', className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* A leaf growing from an open hand — the two ideas the programs sit
          between. Drawn, not illustrated: at 28px anything more is mud. */}
      <path
        d="M16 27c-5.5 0-10-4-10-9 0-6.5 5-12 10-15 5 3 10 8.5 10 15 0 5-4.5 9-10 9Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path d="M16 26V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path
        d="M16 17c0-3.2 2.4-5.9 5.6-6.4C21.3 14 19 16.6 16 17Zm0 0c0-3.2-2.4-5.9-5.6-6.4C10.7 14 13 16.6 16 17Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BrandLockup({
  className,
  tone = 'default',
  href = '/',
}: {
  className?: string;
  /** `inverse` for the dark footer, where the mark sits on green. */
  tone?: 'default' | 'inverse';
  /** Omit the link when the lockup is already inside one. */
  href?: string | null;
}) {
  const content = (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          tone === 'inverse' ? 'bg-white/12' : 'bg-accent',
        )}
      >
        <BrandGlyph className="size-5" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'font-display text-body sm:text-h4 block truncate font-bold leading-tight tracking-tight',
            tone === 'inverse' ? 'text-white' : 'text-foreground',
          )}
        >
          {siteConfig.name}
        </span>
        {/* Hidden below `sm`: at 320px the tagline and the action cluster
            together overflow, and a wordmark that cannot shrink forces the
            whole page to scroll sideways. */}
        <span
          className={cn(
            'hidden truncate text-[0.6875rem] leading-tight sm:block',
            tone === 'inverse' ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          {siteConfig.tagline}
        </span>
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      // `py-1.5` brings the hit area to 44px. The lockup is a standalone
      // target, not an inline link in a paragraph, so the exception that
      // covers the "View all" links does not apply to it.
      className="focus-visible:outline-ring -my-1.5 flex min-w-0 items-center rounded-sm py-1.5 focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {content}
    </Link>
  );
}
