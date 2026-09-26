import Link from 'next/link';
import { Card, cn, formatDate } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { BlogPostSummary } from '@/lib/content/blog';

/**
 * One article, on a listing.
 *
 * Takes a `BlogPostSummary` — a real record from the API. It used to take a
 * `BlogPost` from `@/lib/mock`, which described eight invented articles; that
 * file is gone, and with it the reason `/blog` carried a `noIndex`.
 *
 * `MediaFrame` handles a missing image by falling back to a seeded
 * placeholder, so a post whose featured image was never set still lays out
 * correctly rather than collapsing the card.
 */
export function PostCard({
  post,
  featured = false,
  className,
}: {
  post: BlogPostSummary;
  featured?: boolean;
  className?: string;
}) {
  return (
    <Card
      interactive
      className={cn(
        'group relative flex overflow-hidden',
        featured ? 'flex-col lg:flex-row' : 'flex-col',
        className,
      )}
    >
      <div className={cn(featured && 'lg:w-1/2 lg:shrink-0')}>
        <MediaFrame
          media={{
            seed: `blog-${post.slug}`,
            alt: post.featuredImageAlt ?? post.title,
            ...(post.featuredImageUrl ? { url: post.featuredImageUrl } : {}),
          }}
          aspect="video"
          rounded={false}
          className={cn(featured && 'lg:h-full')}
        />
      </div>

      <div
        className={cn('flex flex-1 flex-col gap-2 p-5', featured && 'lg:justify-center lg:p-10')}
      >
        {post.categoryName ? (
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
            {post.categoryName}
          </p>
        ) : null}

        <h2 className={cn('font-semibold', featured ? 'text-h2' : 'text-h4')}>
          {/*
            The whole card is clickable through this stretched link, so there is
            exactly one link in the accessibility tree rather than one per
            element — a card with three links to the same place is three stops
            for somebody tabbing through.
          */}
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>

        {post.excerpt ? (
          <p
            className={cn(
              'text-muted-foreground',
              featured ? 'text-body' : 'text-body-sm line-clamp-3',
            )}
          >
            {post.excerpt}
          </p>
        ) : null}

        <p className="text-caption text-muted-foreground mt-auto pt-2">
          {post.authorName ? `${post.authorName} · ` : ''}
          {post.publishedAt ? formatDate(post.publishedAt) : null}
        </p>
      </div>
    </Card>
  );
}
