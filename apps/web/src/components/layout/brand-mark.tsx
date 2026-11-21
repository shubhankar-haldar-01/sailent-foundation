import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@sailent/ui';

/**
 * The brand mark and logo components.
 * Uses the official Sailent Foundation logo (`/images/sailent-logo.png`).
 */

export function BrandGlyph({ className }: { className?: string }) {
  return (
    <Image
      src="/images/sailent-icon.png"
      alt="Sailent Foundation"
      width={500}
      height={500}
      className={cn('size-full object-contain', className)}
    />
  );
}

export function BrandLockup({
  className,
  href = '/',
  priority = true,
}: {
  className?: string;
  tone?: 'default' | 'inverse';
  href?: string | null;
  tagline?: 'responsive' | 'always';
  variant?: 'default' | 'header';
  priority?: boolean;
}) {
  const content = (
    <span className={cn('inline-flex items-center', className)}>
      <Image
        src="/images/sailent-logo.png"
        alt="Sailent Foundation"
        width={1743}
        height={453}
        // Shown at most ~220px wide: without `sizes` the browser fetched the
        // 3840px rendition (44 KB) of the 1743px PNG (visual polish Phase 5).
        sizes="220px"
        // Eager but not high priority: the page's own hero image is the
        // largest paint, and a high-priority logo competed with it.
        loading={priority ? 'eager' : undefined}
        className="h-9 w-auto object-contain sm:h-[39.6px] md:h-[43.2px]"
      />
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="focus-visible:outline-ring -my-1.5 flex min-w-0 items-center rounded-sm py-1.5 focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {content}
    </Link>
  );
}
