import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';

import { cn } from '@sailent/ui';

import { categoryTone } from '@/components/home/category-icon';
import { MediaFrame } from '@/components/media/media-frame';
import type { Story } from '@/lib/mock/types';

import { storyDate, StoryMeta } from './featured-story';
import { StoryCategoryIcon } from './story-category-icon';

/**
 * The badge over a card's photograph: a white pill with the category's icon
 * and name in its own ink. White rather than the category's wash, because
 * three of the inks (blue, amber, mint) fall under WCAG AA's 4.5:1 on their
 * own wash and all of them clear it on white. The owner's design draws
 * Healthcare blue (the site's tone for Healthcare is rose), so that one is
 * set here; every other category, including any added later, takes its own.
 */
function badgeInk(category: string): string {
  const key = category.toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'healthcare' || key === 'health') return 'text-wash-blue-ink';
  return categoryTone(category).ink;
}

/**
 * A story below the lead one, matched to the owner's design (2026-10-15): a
 * row — the photograph on the left (53% of the card, as tall as the card)
 * with the category's badge in its top corner; on the right the title, the
 * summary, where and when, and "Read Story" beside a pale-orange arrow.
 * Below `md` the photograph goes on top.
 *
 * THE WHOLE CARD IS ONE LINK. The title is the only anchor; its `::after`
 * stretches over the card, so a click anywhere opens the story while a screen
 * reader hears one link named by the title. "Read Story" and the arrow are
 * decoration. A keyboard focus ring is drawn round the whole card.
 */
export function StoryCard({
  story,
  className,
  variant = 'row',
}: {
  story: Story;
  className?: string;
  /**
   * `row`: the listing's card. `compact`: the story page's "More stories"
   * card — the photograph inset at the left, the title and summary beside it,
   * and the date and "Read Story" on a row beneath both.
   */
  variant?: 'row' | 'compact';
}) {
  const storyCategory = story.category ?? story.programName;
  const href = `/stories/${story.slug}`;

  if (variant === 'compact') {
    const date = story.publishedAt ? storyDate(story.publishedAt) : '';
    return (
      <article
        className={cn(
          'card-interactive group relative flex flex-col justify-between rounded-xl p-3 sm:p-3.5 dark:border-slate-800 dark:bg-slate-900',
          'has-[a:focus-visible]:outline-ring has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2',
          className,
        )}
      >
        <div className="flex gap-3.5">
          <div className="relative aspect-[4/3] w-[42%] shrink-0 overflow-hidden rounded-lg">
            <MediaFrame
              media={story.cover}
              rounded={false}
              className="absolute inset-0 aspect-auto size-full object-cover"
              sizes="(max-width: 768px) 42vw, 190px"
            />
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <h3 className="font-display dark:text-foreground line-clamp-2 text-sm font-bold leading-snug tracking-[-0.01em] text-[#102A43] sm:text-[0.9375rem]">
              <Link
                href={href}
                className="group-hover:text-primary transition-colors after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
              >
                {story.title}
              </Link>
            </h3>
            {story.summary ? (
              <p className="dark:text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                {story.summary}
              </p>
            ) : null}
          </div>
        </div>

        <div className="dark:border-border/60 mt-3.5 flex items-center justify-between border-t border-slate-100 px-0.5 pt-2.5">
          {date ? (
            <span className="dark:text-muted-foreground inline-flex items-center gap-1.5 text-xs text-slate-600">
              <CalendarDays className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <time dateTime={story.publishedAt}>{date}</time>
            </span>
          ) : (
            <span />
          )}
          <span
            aria-hidden="true"
            className="text-primary inline-flex items-center gap-1 text-xs font-semibold"
          >
            Read Story
            <ArrowRight
              className="size-3.5 transition-transform motion-safe:group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        // Half and half at 1280–1439px, where two cards share the row and the text needs the room.
        'card-interactive min-[90rem]:grid-cols-[53%_47%] group relative flex flex-col overflow-hidden rounded-2xl md:grid md:grid-cols-[53%_47%] xl:grid-cols-2 dark:border-slate-800 dark:bg-slate-900',
        'has-[a:focus-visible]:outline-ring has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2',
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full md:aspect-auto md:min-h-[13.5rem] xl:min-h-[15rem]">
        <MediaFrame
          media={story.cover}
          rounded={false}
          className="absolute inset-0 aspect-auto size-full"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 53vw, 360px"
        />

        {storyCategory ? (
          <span
            className={cn(
              'bg-surface absolute left-3.5 top-3.5 z-10 inline-flex h-[2.125rem] items-center gap-2 rounded-full px-3.5 text-[0.8125rem] font-bold shadow-[0_6px_14px_-8px_rgb(16_42_67/0.5)]',
              badgeInk(storyCategory),
            )}
          >
            <StoryCategoryIcon category={storyCategory} />
            <span>{storyCategory}</span>
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col p-5 sm:p-6 xl:py-5">
        <h3 className="font-display text-foreground line-clamp-2 text-lg font-bold leading-tight tracking-[-0.01em] sm:text-xl xl:text-[1.3125rem]">
          <Link
            href={href}
            className="group-hover:text-primary transition-colors after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
          >
            {story.title}
          </Link>
        </h3>

        {story.summary ? (
          <p className="text-muted-foreground mt-2.5 line-clamp-2 text-sm leading-normal sm:text-[0.9375rem]">
            {story.summary}
          </p>
        ) : null}

        <StoryMeta story={story} className="mt-4" />

        {/* At the foot of the column, so the arrow lines up across the cards in a row. */}
        <span
          aria-hidden="true"
          className="text-primary mt-auto inline-flex items-center gap-3 pt-5 text-[0.9375rem] font-bold"
        >
          Read Story
          <span className="bg-cta/12 text-cta-glow duration-(--duration-base) group-hover:bg-primary group-hover:text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full transition-colors">
            <ArrowRight
              className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5"
              strokeWidth={2.2}
            />
          </span>
        </span>
      </div>
    </article>
  );
}
