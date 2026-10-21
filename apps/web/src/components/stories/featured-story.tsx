import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Star } from 'lucide-react';

import { Button, cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { Story } from '@/lib/mock/types';

import { OutlineLeaves } from './stories-decor';
import { StoryCategoryIcon } from './story-category-icon';

/**
 * The lead story at the head of the Stories listing, matched to the owner's
 * design (2026-10-15): one rounded card, the photograph on the left (53% of
 * the card) with the category on an orange pill at its foot, and on the right
 * a warm cream panel — the "Featured Story" badge, the title, the summary,
 * where and when, and "Read Full Story".
 *
 * The panel's peach disc and outline leaves are the Stories page's own
 * decorations (`stories-decor.tsx`), drawn from `xl` only, where the panel is
 * wide enough that they sit clear of the text.
 *
 * On a phone and a tablet the photograph goes on top and the panel below it.
 */
export function FeaturedStory({ story }: { story: Story }) {
  const href = `/stories/${story.slug}`;
  const storyCategory = story.category ?? story.programName;

  return (
    <article className="bg-surface border-accent-100 dark:border-border relative flex flex-col overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(16_42_67/0.04),0_10px_24px_-14px_rgb(16_42_67/0.16)] lg:grid lg:grid-cols-[53%_47%]">
      {/* The photograph: 16:10 on top below `lg`; from `lg`, as tall as the panel beside it. */}
      <div className="relative aspect-[16/10] w-full sm:aspect-[2/1] lg:aspect-auto lg:min-h-[19.25rem]">
        <MediaFrame
          media={story.cover}
          rounded={false}
          priority
          className="absolute inset-0 aspect-auto size-full"
          sizes="(max-width: 1024px) 100vw, 53vw"
        />

        {storyCategory ? (
          <span className="bg-primary text-primary-foreground absolute bottom-4 left-4 z-10 inline-flex h-9 items-center gap-2 rounded-full px-4 text-[0.8125rem] font-bold shadow-[0_6px_14px_-8px_rgb(16_42_67/0.6)] sm:bottom-5 sm:left-5 sm:h-[2.375rem] sm:px-5">
            <StoryCategoryIcon category={storyCategory} className="size-[1.125rem] text-white" />
            <span>{storyCategory}</span>
          </span>
        ) : null}
      </div>

      <div className="bg-surface-warm relative flex flex-col items-start justify-center overflow-hidden px-6 py-7 sm:px-9 sm:py-9 lg:px-11 lg:py-6">
        {/*
          The panel's peach disc and leaf spray, behind the text. From 1408px only:
          narrower, the summary's first line would run into the leaves.
        */}
        <span
          aria-hidden="true"
          className="bg-cta/10 min-[88rem]:block absolute right-[5%] top-[19%] hidden size-[4.5rem] rounded-full"
        />
        <OutlineLeaves className="text-cta-glow/30 min-[88rem]:block absolute -bottom-[6%] right-0 hidden h-[64%] w-auto" />

        <p className="bg-cta/8 text-primary relative inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[0.8125rem] font-semibold">
          <Star className="fill-cta text-cta size-4" aria-hidden="true" />
          Featured Story
        </p>

        <h2 className="font-display text-foreground relative mt-3.5 text-[1.625rem] font-bold leading-tight tracking-[-0.015em] sm:text-[1.75rem] xl:text-[1.875rem]">
          <Link
            href={href}
            className="hover:text-primary focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {story.title}
          </Link>
        </h2>

        {story.summary ? (
          <p className="text-muted-foreground relative mt-2.5 max-w-[30rem] text-[0.9375rem] leading-relaxed">
            {story.summary}
          </p>
        ) : null}

        <StoryMeta story={story} size="md" className="relative mt-5" />

        <Button
          asChild
          className="relative mt-6 h-12 rounded-full px-8 text-base font-bold sm:h-[3.375rem] sm:px-10 sm:text-[1.0625rem]"
        >
          <Link href={href}>
            Read Full Story
            <ArrowRight className="size-[1.125rem]" aria-hidden="true" />
          </Link>
        </Button>
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

/** "30 September 2026" — the story page's own, fuller form of the same date. */
const DATE_LONG = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export function storyDateLong(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_LONG.format(date);
}

export function storyDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const part = (type: string) =>
    DATE_PARTS.formatToParts(date).find((p) => p.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}`;
}

/**
 * Where and when, with their icons, separated by a hairline — only what the
 * story actually has. `md` is the lead story's larger row; `sm` the cards'.
 *
 * THE HAIRLINE NEVER DANGLES. Each item draws its own on its left, and the
 * row is pulled left by one spacing inside a clipping box, so the first item
 * on every line has its hairline cut off. When a narrow card puts the date
 * under the place, neither line starts or ends with a stray divider.
 */
export function StoryMeta({
  story,
  size = 'sm',
  className,
}: {
  story: Story;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const formattedDate = story.publishedAt ? storyDate(story.publishedAt) : '';
  if (!story.location && !formattedDate) return null;

  const md = size === 'md';
  const icon = md ? 'size-[1.125rem]' : 'size-4';
  const item = cn(
    'relative inline-flex items-center',
    'before:bg-border before:absolute before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2',
    md ? 'gap-2 pl-[2.0625rem] before:left-4' : 'gap-1.5 pl-[1.3125rem] before:left-2.5',
  );

  return (
    <div className={cn('overflow-hidden', className)}>
      <div
        className={cn(
          'text-muted-foreground flex flex-wrap items-center gap-y-1 font-medium',
          md ? '-ml-[2.0625rem] text-sm' : '-ml-[1.3125rem] text-xs',
        )}
      >
        {story.location ? (
          <span className={item}>
            <MapPin className={cn('shrink-0', icon)} strokeWidth={1.8} aria-hidden="true" />
            <span>{story.location}</span>
          </span>
        ) : null}
        {formattedDate ? (
          <span className={item}>
            <CalendarDays className={cn('shrink-0', icon)} strokeWidth={1.8} aria-hidden="true" />
            <time dateTime={story.publishedAt}>{formattedDate}</time>
          </span>
        ) : null}
      </div>
    </div>
  );
}
