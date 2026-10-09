import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Star } from 'lucide-react';
import { Button, cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { Story } from '@/lib/mock/types';
import { OutlineLeaves } from './stories-decor';

/**
 * The story that leads the listing (owner's page design, 2026-10-08): the
 * photograph on the left, a soft peach panel on the right with the category,
 * a "Featured Story" mark, the title, the summary, where and when, and one
 * action. The lead is the newest story in the current view (owner decision:
 * there is no "featured" setting for stories yet).
 */
export function FeaturedStory({ story }: { story: Story }) {
  const href = `/stories/${story.slug}`;
  return (
    <article className="border-border/60 bg-surface mt-5 grid overflow-hidden rounded-2xl border shadow-[0_10px_30px_-18px_rgb(15_23_42/0.25)] lg:grid-cols-[53%_1fr]">
      {/* The panel sets the height; the picture fills it. Absolute, so a
          placeholder drawing (no cover yet) cannot stretch the card. */}
      <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[16.125rem]">
        <MediaFrame
          media={story.cover}
          rounded={false}
          priority
          className="absolute inset-0 aspect-auto size-full"
          sizes="(max-width: 1024px) 100vw, 560px"
        />
      </div>

      <div className="bg-primary-soft relative flex flex-col justify-center overflow-hidden px-6 py-5 sm:px-8">
        <OutlineLeaves className="text-cta-glow/40 pointer-events-none absolute -bottom-3 right-1 h-[10.5rem] w-auto rotate-[15deg]" />

        <p className="bg-wash-coral text-primary absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold leading-none">
          <Star className="fill-cta-glow text-cta-glow size-3.5" aria-hidden="true" />
          Featured Story
        </p>

        {story.category ? (
          <p className="text-primary pr-32 text-[0.75rem] font-bold uppercase tracking-[0.04em]">
            {story.category}
          </p>
        ) : null}
        <h2 className="font-display mt-1.5 text-[1.625rem] font-bold leading-tight tracking-[-0.01em]">
          <Link
            href={href}
            className="hover:text-info-action focus-visible:outline-ring rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {story.title}
          </Link>
        </h2>
        {story.summary ? (
          <p className="text-muted-foreground mt-2.5 max-w-[24.5rem] text-[0.9375rem] leading-[1.5]">
            {story.summary}
          </p>
        ) : null}

        <StoryMeta story={story} className="mt-4" />

        <div className="mt-5">
          <Button asChild className="h-12 rounded-full px-7 text-[0.9375rem] font-bold">
            <Link href={href}>
              Read Full Story
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * "01 Oct 2026", as the design writes dates — day, three-letter month, year —
 * in India time like every date on the site. Built from parts because no
 * locale gives exactly this ("en-GB" writes "Sept").
 */
const DATE_PARTS = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});
function storyDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const part = (type: string) =>
    DATE_PARTS.formatToParts(date).find((p) => p.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}`;
}

/** Where and when, with their icons, separated by a hairline. */
export function StoryMeta({ story, className }: { story: Story; className?: string }) {
  return (
    <p
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]',
        className,
      )}
    >
      {story.location ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden="true" />
          {story.location}
        </span>
      ) : null}
      {story.location ? <span aria-hidden="true" className="bg-border h-3 w-px" /> : null}
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5" aria-hidden="true" />
        <time dateTime={story.publishedAt}>{storyDate(story.publishedAt)}</time>
      </span>
    </p>
  );
}
