'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Quote } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { SectionHeading } from '@/components/sections/section-heading';
import type { Story } from '@/lib/mock/types';

/**
 * Story-card columns by how many stories there are, keyed to the SECTION's
 * width (container queries), not the screen's: beside the donation rail at
 * 1024px the column is narrower than a tablet's full width. Written out in
 * full so Tailwind can see every class it needs to generate.
 */
const PICKER_COLUMNS: Record<number, string> = {
  2: '@xl:grid-cols-2',
  3: '@2xl:grid-cols-3',
  4: '@xl:grid-cols-2 @4xl:grid-cols-4',
};

/**
 * Stories from the ground — one story told large, and the others to pick from.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE CARD, THEN A ROW OF CHOICES.
 *
 * The featured story is a single card in the page's own card style — the
 * photograph on one side, the story on a white-to-soft-blue panel on the other
 * — so picture and words read as one thing. Under it, every story is a small
 * card with its thumbnail and title. Pressing one shows it above; the current
 * one is outlined in green, as chosen things are elsewhere on the page.
 *
 * THE PHOTOGRAPH IS A SCROLL CONTAINER, NOT A TRANSFORM. Slides sit in a
 * `scroll-snap` row, so swiping works before JavaScript arrives and the
 * browser does the animation. The arrows, the counter and the story cards all
 * move the same row, and the story shown is read back from its position — so
 * a swipe, an arrow and a card can never disagree about which story is open.
 *
 * NO AUTOPLAY. These are photographs of people; moving them under a reader is
 * what WCAG 2.2.2 exists to restrain, and nothing here moves unless asked.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * BORROWED STORIES SAY SO. A campaign page shows its own stories; when it has
 * none, the page may pass stories from the foundation's other work instead,
 * with `fromElsewhere` — and then the lead and each story's label say where
 * they come from, so nobody reads another campaign's result as this one's.
 */
export function StoriesStrip({
  stories,
  fromElsewhere = false,
}: {
  stories: Story[];
  fromElsewhere?: boolean;
}) {
  const railRef = React.useRef<HTMLUListElement>(null);
  const [active, setActive] = React.useState(0);

  const slides = stories.slice(0, 4);

  const onScroll = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const index = Math.round(rail.scrollLeft / Math.max(rail.clientWidth, 1));
    setActive(Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  const show = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: index * rail.clientWidth, behavior: 'smooth' });
    // Set at once as well, so the panel and the cards answer the press
    // immediately rather than at the end of the scroll animation.
    setActive(index);
  };

  if (slides.length === 0) return null;

  const story = slides[active] ?? slides[0]!;
  const hasMany = slides.length > 1;

  return (
    <section
      id="campaign-stories"
      aria-labelledby="stories-heading"
      className="@container mt-12 scroll-mt-32"
    >
      <SectionHeading
        id="stories-heading"
        size="md"
        title="Stories from the Ground"
        lead={
          fromElsewhere
            ? 'This campaign has not shared a story yet. These come from our other work.'
            : 'Real stories from the people and communities we are supporting.'
        }
        viewAll={{ href: '/stories', label: 'View All Stories' }}
      />

      {/* The featured story --------------------------------------------------- */}
      <article
        aria-labelledby="featured-story-title"
        className="border-border/70 bg-surface @2xl:grid @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] mt-4 overflow-hidden rounded-2xl border shadow-sm"
      >
        <div className="@lg:aspect-[2/1] @2xl:aspect-auto @2xl:min-h-72 relative aspect-[16/10]">
          <ul
            ref={railRef}
            onScroll={onScroll}
            // `rail` hides the scrollbar without disabling the scrolling.
            className="rail absolute inset-0 flex snap-x snap-mandatory overflow-x-auto"
          >
            {slides.map((item) => (
              <li key={item.slug} className="h-full w-full shrink-0 basis-full snap-start">
                {/*
                  `relative` IS LOAD-BEARING: the `sr-only` title is absolutely
                  positioned, and without a positioned ancestor inside the
                  scroll container it escapes it and widens the whole page.
                  The links stay focusable — axe requires a keyboard way into
                  any region that scrolls, and focusing one scrolls it in.
                */}
                <Link
                  href={`/stories/${item.slug}`}
                  className="focus-visible:outline-ring relative block h-full focus-visible:outline-2 focus-visible:-outline-offset-4"
                >
                  <MediaFrame
                    media={item.cover}
                    aspect="wide"
                    rounded={false}
                    className="aspect-auto h-full"
                    sizes="(max-width: 768px) 100vw, 600px"
                  />
                  <span className="sr-only">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* A soft shade under the controls, so they read on any photograph. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent"
          />

          {hasMany ? (
            <>
              {/* One arrow on each side of the photograph, halfway down. */}
              <Arrow
                side="left"
                label="Previous story"
                disabled={active === 0}
                onClick={() => show(active - 1)}
              />
              <Arrow
                side="right"
                label="Next story"
                disabled={active === slides.length - 1}
                onClick={() => show(active + 1)}
              />

              <span
                data-numeric=""
                className="text-caption absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-semibold text-white"
              >
                <span className="sr-only">Story </span>
                {active + 1} / {slides.length}
              </span>
            </>
          ) : null}
        </div>

        {/* The story itself */}
        <div className="from-surface to-surface-tint @2xl:p-8 flex flex-col justify-center bg-gradient-to-br p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {fromElsewhere ? (
              <span className="text-caption border-border text-muted-foreground-strong rounded-md border px-2.5 py-1 font-semibold">
                From another campaign
              </span>
            ) : null}
            {story.programName ? (
              <span className="text-caption bg-wash-mint text-wash-mint-ink-strong rounded-md px-2.5 py-1 font-semibold">
                {story.programName}
              </span>
            ) : null}
            {story.location ? (
              <span className="text-caption text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {story.location}
              </span>
            ) : null}
          </div>

          <h3 id="featured-story-title" className="text-h3 mt-3 font-bold leading-snug">
            {story.title}
          </h3>

          <div className="mt-3 flex gap-2.5">
            <Quote
              className="text-wash-gold-ink/70 mt-0.5 size-5 shrink-0 -scale-x-100"
              aria-hidden="true"
            />
            <p className="text-body text-muted-foreground-strong line-clamp-4 leading-relaxed">
              {story.summary}
            </p>
          </div>

          {story.subjectName ? (
            <p className="text-body-sm mt-2 pl-7 font-semibold">— {story.subjectName}</p>
          ) : null}

          <Link
            href={`/stories/${story.slug}`}
            className="border-border bg-surface text-body-sm hover:border-foreground/30 hover:bg-muted/60 focus-visible:outline-ring mt-5 inline-flex h-10 items-center gap-2 self-start rounded-lg border px-4 font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Read Full Story
            <span className="sr-only">: {story.title}</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </article>

      {/* Every story, to choose from ------------------------------------------ */}
      {hasMany ? (
        <ul
          aria-label="Choose a story"
          className={cn('mt-3 grid gap-3', PICKER_COLUMNS[slides.length])}
        >
          {slides.map((item, index) => {
            const isActive = index === active;
            return (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => show(index)}
                  aria-pressed={isActive}
                  className={cn(
                    'focus-visible:outline-ring flex w-full items-center gap-3 rounded-xl border p-2.5 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                    isActive
                      ? 'border-success bg-wash-mint/40 ring-success/15 ring-2'
                      : 'border-border/70 bg-surface hover:border-foreground/25',
                  )}
                >
                  <span className="size-14 shrink-0 overflow-hidden rounded-lg">
                    <MediaFrame
                      media={{ ...item.cover, alt: '' }}
                      aspect="square"
                      rounded={false}
                      sizes="56px"
                    />
                  </span>
                  <span className="min-w-0">
                    {item.programName ? (
                      <span className="text-caption text-muted-foreground block truncate">
                        {item.programName}
                      </span>
                    ) : null}
                    <span className="text-body-sm line-clamp-2 font-semibold leading-snug">
                      <span className="sr-only">Show story: </span>
                      {item.title}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function Arrow({
  side,
  label,
  disabled,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // 36px over a photograph — above the 24px WCAG 2.5.8 floor.
        'bg-surface/95 text-foreground focus-visible:outline-ring absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full shadow-md transition-opacity',
        'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2',
        // Dimmed at the ends, never removed, so the control never jumps.
        'disabled:pointer-events-none disabled:opacity-50',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
