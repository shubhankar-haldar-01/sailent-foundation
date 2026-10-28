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
      src="/images/sailent-logo.png"
      alt="Sailent Foundation"
      width={2048}
      height={746}
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
        width={2048}
        height={746}
        priority={priority}
        className="h-10 w-auto object-contain sm:h-11 md:h-12"
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
