import Link from 'next/link';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { BlogPostSummary } from '@/lib/content/blog';

/** Formats a date into "15 Feb 2026" notation matching the design reference. */
export function formatArticleDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export interface PostCardProps {
  post: BlogPostSummary & { readingTime?: string | null };
  featured?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * An individual blog article card.
 *
 * In 'horizontal' layout (the default for the blog index):
 * - Large landscape thumbnail on the left (rounded-xl)
 * - Article info on the right: date, reading time if available, Manrope title, excerpt, "Read More →"
 * - The sunken grey surface when `featured={true}`
 * - The card surface when `featured={false}`
 *
 * In 'vertical' layout:
 * - Stacked layout for multi-column grids (such as "More from the blog" on article detail)
 */
export function PostCard({
  post,
  featured = false,
  layout = 'horizontal',
  className,
}: PostCardProps) {
  const isHorizontal = layout === 'horizontal';

  return (
    <article
      className={cn(
        'card-interactive group relative overflow-hidden rounded-2xl',
        featured ? 'border-border bg-muted' : 'bg-surface',
        isHorizontal ? 'flex flex-col gap-5 p-4 sm:flex-row sm:p-5 lg:gap-6' : 'flex flex-col p-4',
        className,
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'bg-muted relative shrink-0 overflow-hidden rounded-xl',
          isHorizontal
            ? 'aspect-[16/11] w-full sm:aspect-[4/3] sm:w-[42%] lg:w-[40%]'
            : 'aspect-[16/10] w-full',
        )}
      >
        <MediaFrame
          media={{
            seed: `blog-${post.slug}`,
            alt: post.featuredImageAlt ?? post.title,
            ...(post.featuredImageUrl ? { url: post.featuredImageUrl } : {}),
          }}
          aspect={isHorizontal ? 'photo' : 'video'}
          rounded={false}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Information */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          isHorizontal ? 'justify-between py-0.5' : 'pt-3.5',
        )}
      >
        <div>
          {/* Metadata: Date and Reading Time */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {post.publishedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                <time dateTime={post.publishedAt}>{formatArticleDate(post.publishedAt)}</time>
              </span>
            ) : null}

            {/* Reading time only if available metadata exists */}
            {post.readingTime ? (
              <>
                <span aria-hidden="true" className="text-muted-foreground mx-1">
                  |
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  <span>{post.readingTime}</span>
                </span>
              </>
            ) : null}
          </div>

          {/* Heading */}
          <h2 className="font-display group-hover:text-primary text-foreground mt-2 line-clamp-2 text-lg font-bold leading-snug transition-colors sm:text-xl">
            <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
              {post.title}
            </Link>
          </h2>

          {/* Excerpt */}
          {post.excerpt ? (
            <p className="text-muted-foreground mt-2.5 line-clamp-3 text-xs leading-relaxed sm:text-sm">
              {post.excerpt}
            </p>
          ) : null}
        </div>

        {/* Read More Link */}
        <div className="mt-4 pt-3 sm:mt-auto">
          <span className="text-primary group-hover:text-primary inline-flex items-center gap-1.5 text-xs font-semibold transition-colors sm:text-sm">
            Read More
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </article>
  );
}
