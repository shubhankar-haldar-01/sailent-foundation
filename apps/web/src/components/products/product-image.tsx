'use client';

import * as React from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';

import { cn } from '@sailent/ui';

export const KNOWN_PRODUCT_IMAGES: Record<string, string> = {
  'medicine-kit': '/images/product-medicine-kit.webp',
  'school-kit': '/images/product-school-kit.webp',
  'shelter-repair-grant': '/images/product-shelter-repair-grant.webp',
  'clinic-day': '/images/product-clinic-day.webp',
  'family-relief-kit': '/images/product-family-relief-kit.webp',
  'sponsor-a-trainee': '/images/product-sponsor-a-trainee.webp',
  'textbook-set': '/images/product-textbook-set.webp',
  'winter-blanket': '/images/product-blankets.webp',
  blankets: '/images/product-blankets.webp',
  'reading-corner': '/images/product-reading-corner.webp',
  'sewing-machine': '/images/product-sewing-machine.webp',
  maternal: '/images/product-maternal.webp',
  textbooks: '/images/product-textbooks.webp',
};

export function resolveProductImage(product: {
  image?: string | null;
  slug?: string;
}): string | null {
  if (product.image) return product.image;
  if (product.slug && KNOWN_PRODUCT_IMAGES[product.slug]) {
    return KNOWN_PRODUCT_IMAGES[product.slug] ?? null;
  }
  return null;
}

export function ProductImage({
  image,
  slug,
  name: _name,
  className,
  size = 56,
}: {
  image?: string | null;
  slug?: string;
  name?: string;
  className?: string;
  size?: number;
}) {
  const [hasError, setHasError] = React.useState(false);
  const src = resolveProductImage({ image, slug });

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'border-border/60 bg-muted/40 text-muted-foreground/60 flex shrink-0 items-center justify-center rounded-lg border',
          className,
        )}
        aria-hidden="true"
      >
        <Package className="size-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border/60 bg-surface relative shrink-0 overflow-hidden rounded-lg border',
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
