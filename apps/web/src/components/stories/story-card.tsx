import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Card, cn, formatDate } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { Story } from '@/lib/mock/types';

export function StoryCard({
  story,
  featured = false,
  className,
}: {
  story: Story;
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
      <div className={cn(featured && 'lg:w-3/5 lg:shrink-0')}>
        <MediaFrame
          media={story.cover}
          aspect={featured ? 'photo' : 'photo'}
          rounded={false}
          className={cn(featured && 'lg:h-full')}
        />
      </div>

      <div
        className={cn('flex flex-1 flex-col gap-2 p-5', featured && 'lg:justify-center lg:p-10')}
      >
        {story.programName ? (
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
            {story.programName}
          </p>
        ) : null}

        <h3 className={cn('font-semibold leading-snug', featured ? 'text-h1' : 'text-h4')}>
          <Link
            href={`/stories/${story.slug}`}
            className={cn(
              'hover:text-primary focus-visible:outline-ring rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2',
              !featured && 'line-clamp-2',
            )}
          >
            {story.title}
          </Link>
        </h3>

        <p
          className={cn(
            'text-muted-foreground',
            featured ? 'text-body-lg' : 'text-body-sm line-clamp-3',
          )}
        >
          {story.summary}
        </p>

        <p className="text-caption text-muted-foreground mt-auto flex flex-wrap items-center gap-x-2 pt-3">
          {story.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {story.location}
            </span>
          ) : null}
          <span aria-hidden="true">·</span>
          <time dateTime={story.publishedAt}>{formatDate(story.publishedAt, 'short')}</time>
        </p>
      </div>
    </Card>
  );
}
