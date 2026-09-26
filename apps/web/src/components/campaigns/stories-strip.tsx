'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { Story } from '@/lib/mock/types';

/**
 * Stories from the ground — a photograph carousel over three story cards.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE CAROUSEL IS A SCROLL CONTAINER, NOT A TRANSFORM.
 *
 * Slides sit in a `scroll-snap` row, so the arrows only call `scrollTo` and the
 * browser does the animation, the momentum and the inertia on a touchscreen.
 * The alternative — translating a track by a computed offset — reimplements all
 * of that badly and breaks the moment a slide is a different width.
 *
 * It also means this WORKS WITHOUT JAVASCRIPT. The row is scrollable by touch
 * and by trackpad before React arrives; the arrows and dots are the enhancement.
 *
 * NO AUTOPLAY. The featured-campaign rail on the homepage advances on its own
 * because it is a list of things to choose between. This is three photographs
 * of people, and moving them under a reader is the behaviour WCAG 2.2.2 exists
 * to restrain. Nothing moves unless somebody asks it to, so there is no pause
 * control to provide either.
 * ══════════════════════════════════════════════════════════════════════════
 */
const CARD_TONES = [
  { bar: 'bg-wash-violet-ink', heading: 'text-wash-violet-ink' },
  { bar: 'bg-wash-blue-ink', heading: 'text-wash-blue-ink' },
  { bar: 'bg-wash-amber-ink', heading: 'text-wash-amber-ink' },
] as const;

export function StoriesStrip({ stories }: { stories: Story[] }) {
  const railRef = React.useRef<HTMLUListElement>(null);
  const [active, setActive] = React.useState(0);

  const slides = stories.slice(0, 3);
  const cards = stories.slice(0, 3);

  /**
   * Which slide is showing, read from the scroll position.
   *
   * Derived rather than tracked: the row can be scrolled by touch, trackpad or
   * keyboard without the arrows being involved at all, and a counter the
   * buttons incremented would drift out of step the first time somebody swiped.
   */
  const onScroll = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const index = Math.round(rail.scrollLeft / Math.max(rail.clientWidth, 1));
    setActive(Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  const scrollTo = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: index * rail.clientWidth, behavior: 'smooth' });
  };

  if (slides.length === 0) return null;

  return (
    <section aria-labelledby="stories-heading" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="stories-heading" className="text-h1 font-bold">
            Stories from the Ground
          </h2>
          <p className="text-body-sm text-muted-foreground mt-1">
            Real stories from the communities we are supporting.
          </p>
        </div>

        <Link
          href="/stories"
          className="text-body-sm text-info-action focus-visible:outline-ring inline-flex items-center gap-1.5 rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          View All Stories
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Carousel ---------------------------------------------------------- */}
      <div className="relative mt-5">
        <ul
          ref={railRef}
          onScroll={onScroll}
          // `rail` hides the scrollbar without disabling the scrolling.
          className="rail flex snap-x snap-mandatory overflow-x-auto rounded-xl"
        >
          {slides.map((story) => (
            <li key={story.slug} className="w-full shrink-0 snap-start">
              {/*
                `relative` IS LOAD-BEARING.

                The `sr-only` label below is absolutely positioned. Without a
                positioned ancestor inside the scroll container it resolves
                against the wrapper OUTSIDE it, lands at the third slide's
                static offset, escapes the container's clipping and drags the
                whole document to twice the viewport width — a horizontal
                scrollbar on every page view, caused by a one-pixel span nobody
                can see.
              */}
              <Link
                href={`/stories/${story.slug}`}
                className="focus-visible:outline-ring relative block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {/*
                  A BAND, not a portrait. At the content width an 8:5 crop is
                  750px tall and pushes everything below it off the first
                  screen; the approved design runs these as a wide strip. It
                  steps down to 21:9 on a phone, where 15:4 would be a letterbox
                  a face cannot survive.
                */}
                <MediaFrame
                  media={story.cover}
                  aspect="wide"
                  rounded={false}
                  className="md:aspect-[15/4]"
                  sizes="(max-width: 1024px) 100vw, 1200px"
                />
                <span className="sr-only">{story.title}</span>
              </Link>
            </li>
          ))}
        </ul>

        {slides.length > 1 ? (
          <>
            <Arrow
              side="left"
              label="Previous story"
              disabled={active === 0}
              onClick={() => scrollTo(active - 1)}
            />
            <Arrow
              side="right"
              label="Next story"
              disabled={active === slides.length - 1}
              onClick={() => scrollTo(active + 1)}
            />

            {/*
              Dots are BUTTONS, not decoration — each jumps to its slide, and
              each carries the slide's name so the control is usable when the
              shape on screen means nothing.
            */}
            <ul className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {slides.map((story, index) => (
                <li key={story.slug}>
                  <button
                    type="button"
                    onClick={() => scrollTo(index)}
                    aria-current={index === active}
                    className="focus-visible:outline-ring grid size-6 place-items-center rounded-full focus-visible:outline-2"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'block h-1.5 rounded-full transition-all',
                        index === active ? 'bg-success w-5' : 'w-1.5 bg-white/70',
                      )}
                    />
                    <span className="sr-only">Show {story.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {/* The three cards --------------------------------------------------- */}
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {cards.map((story, index) => {
          const tone = CARD_TONES[index % CARD_TONES.length]!;

          return (
            <li key={story.slug} className="relative">
              <article className="border-border bg-surface h-full overflow-hidden rounded-lg border pl-4">
                {/* The coloured spine. Decorative — the heading carries the
                    same hue, and neither is the only signal. */}
                <span
                  aria-hidden="true"
                  className={cn('absolute inset-y-0 left-0 w-1', tone.bar)}
                />

                <div className="p-4 pl-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className={cn('text-body-sm font-bold', tone.heading)}>
                      <Link
                        href={`/stories/${story.slug}`}
                        className="focus-visible:outline-ring rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {story.title}
                      </Link>
                    </h3>
                    <Sparkles
                      className="text-wash-gold-ink mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="text-body-sm text-muted-foreground mt-2 leading-relaxed">
                    {story.summary}
                  </p>

                  {story.subjectName ? (
                    <p className="text-body-sm mt-3 font-semibold">— {story.subjectName}</p>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
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
        // 44px, the WCAG 2.5.8 enhanced target — these sit over a photograph
        // and are pressed on a phone.
        'bg-surface/90 text-foreground focus-visible:outline-ring absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-md backdrop-blur transition-opacity',
        'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2',
        // Dimmed at the ends, never removed — an arrow that vanishes makes the
        // control jump around and leaves the reader unsure it was ever there.
        'disabled:pointer-events-none disabled:opacity-40',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
