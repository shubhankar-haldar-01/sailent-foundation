import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@sailent/ui';

import { CategoryIcon, categoryTone } from '@/components/home/category-icon';
import { MediaFrame } from '@/components/media/media-frame';
import type { Story } from '@/lib/mock/types';
import { StoryMeta } from './featured-story';

/**
 * Where the Stories design colours a category differently from the campaign
 * palette (`categoryTone`): Healthcare is blue and Disaster Relief orange on
 * these cards. Both pairs are the palette's own, already measured on white.
 */
const STORY_CHIP: Record<string, string> = {
  healthcare: 'bg-wash-blue/60 text-wash-blue-ink',
  health: 'bg-wash-blue/60 text-wash-blue-ink',
  disasterrelief: 'bg-wash-amber/60 text-wash-amber-ink',
};

/** Marks drawn solid, as the design does — except the book, which fills to a plain block. */
const OUTLINED = new Set(['education']);

const chipKey = (category: string) => category.toLowerCase().replace(/[^a-z]/g, '');

function storyChip(category: string): string {
  return STORY_CHIP[chipKey(category)] ?? categoryTone(category).chip;
}

/**
 * A story in a grid (owner's page design, 2026-10-08): the photograph with
 * the category on it, the title, two lines of summary, where and when, and an
 * arrow. The whole card links to the story; the arrow is decoration that
 * repeats what the card already does.
 */
export function StoryCard({ story, className }: { story: Story; className?: string }) {
  return (
    <article
      className={cn(
        'border-border/60 bg-surface @container group relative flex flex-col overflow-hidden rounded-2xl border shadow-[0_8px_24px_-16px_rgb(15_23_42/0.25)]',
        'duration-(--duration-base) transition-[translate,box-shadow] hover:shadow-lg motion-safe:hover:-translate-y-1',
        'focus-within:shadow-lg motion-safe:focus-within:-translate-y-1',
        className,
      )}
    >
      <div className="relative">
        <MediaFrame
          media={story.cover}
          rounded={false}
          className="aspect-[332/152]"
          sizes="(max-width: 767px) 92vw, (max-width: 1023px) 46vw, 340px"
        />
        {story.category ? (
          // On a white backing, so the tint is a known colour whatever the photograph does.
          <span className="bg-surface absolute left-3 top-2 rounded-full shadow-sm">
            <span
              className={cn(
                'inline-flex h-9 items-center gap-3 rounded-full pl-3.5 pr-4 text-[0.6875rem] font-bold leading-none',
                storyChip(story.category),
              )}
            >
              <CategoryIcon
                category={story.category}
                className={cn(
                  'size-[1.0625rem]',
                  !OUTLINED.has(chipKey(story.category)) && 'fill-current',
                )}
              />
              {story.category}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col pb-2 pl-5 pr-3 pt-3">
        <h3 className="font-display text-[0.9625rem] font-bold leading-snug">
          <Link
            href={`/stories/${story.slug}`}
            className="hover:text-info-action focus-visible:outline-ring line-clamp-2 rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {story.title}
          </Link>
        </h3>
        {story.summary ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 max-w-[14.75rem] text-[0.84375rem] leading-[1.48]">
            {story.summary}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <StoryMeta story={story} />
          <span
            aria-hidden="true"
            className="bg-wash-coral text-cta-glow @max-[19rem]:hidden grid size-8 shrink-0 place-items-center rounded-full transition-transform motion-safe:group-hover:translate-x-0.5"
          >
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}
