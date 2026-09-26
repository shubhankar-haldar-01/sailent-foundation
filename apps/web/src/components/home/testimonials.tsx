'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { HeadingRule } from '@/components/home/section-head';
import { testimonials } from '@/lib/mock/home';

/**
 * Testimonials.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SCROLLER, NOT AN AUTOPLAYING CAROUSEL.
 *
 * The list is a real horizontally-scrolling list with snap points: it works by
 * swipe, by trackpad, by keyboard tabbing (the browser scrolls focus into
 * view on its own), and with JavaScript off. The arrow buttons nudge
 * `scrollBy` — they are an addition to native scrolling, not a replacement
 * for it.
 *
 * Nothing moves on its own. Content that slides away while somebody is
 * reading it is the most reliably disliked pattern on the web, and it is
 * actively hostile to anyone who reads slowly.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The heading shares the row with the cards at `lg`, as approved, and stacks
 * above them below it.
 */
export function Testimonials() {
  const scroller = React.useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const sync = React.useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    setAtStart(element.scrollLeft <= 4);
    setAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    sync();
    const element = scroller.current;
    if (!element) return;
    element.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      element.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  function nudge(direction: -1 | 1) {
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.min(element.clientWidth * 0.8, 420),
      // Honours the OS setting: `smooth` becomes an instant jump for anyone
      // who has asked for reduced motion.
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  if (testimonials.length === 0) return null;

  const arrow = (direction: -1 | 1, label: string, Icon: typeof ChevronLeft, disabled: boolean) => (
    <button
      type="button"
      onClick={() => nudge(direction)}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'border-border bg-surface hidden size-8 shrink-0 place-items-center rounded-full border shadow-sm transition-colors lg:grid',
        'hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        // Dimmed and inert, not hidden: `display:none` collapses the slot
        // and the whole row jumps 32px sideways the moment you reach an end.
        'disabled:pointer-events-none disabled:opacity-35',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );

  return (
    <section aria-labelledby="testimonials-title" className="bg-surface border-border border-b">
      <PageShell className="band-y">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex shrink-0 items-center gap-3">
            <h2
              id="testimonials-title"
              className="font-display text-section tracking-(--text-section--letter-spacing) font-bold"
            >
              What People Say
            </h2>
            <HeadingRule />
          </div>

          <ul
            ref={scroller}
            /*
             * Focusable and named.
             *
             * A horizontally scrolling region whose contents hold no focusable
             * element cannot be scrolled by keyboard at all — there is nothing
             * to tab to, so the arrow keys never reach it. Making the
             * container itself focusable is the fix, and the label means a
             * screen reader announces what is being scrolled.
             *
             * NO `role` override: putting `role="group"` on the <ul> strips
             * its list semantics and orphans every <li> inside it, which axe
             * reports straight back. A labelled list is already the right
             * role.
             */
            tabIndex={0}
            aria-label="Testimonials, scrollable"
            className="focus-visible:outline-ring rail -mx-1 flex min-w-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto rounded-lg px-1 pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 lg:pb-0"
          >
            {testimonials.map((testimonial) => (
              <li
                key={testimonial.id}
                className="w-[min(82vw,20rem)] shrink-0 snap-start lg:w-[calc((100%-1.5rem)/3)]"
              >
                <figure className="border-border bg-surface hover-lift flex h-full gap-3 rounded-xl border p-3 shadow-sm hover:shadow-md">
                  <span className="size-9 shrink-0 overflow-hidden rounded-full">
                    <MediaFrame
                      media={{
                        seed: testimonial.photoSeed,
                        alt: '',
                        ...(testimonial.photoUrl ? { url: testimonial.photoUrl } : {}),
                      }}
                      aspect="square"
                      rounded={false}
                      sizes="40px"
                    />
                  </span>
                  <div className="min-w-0">
                    <blockquote className="text-caption italic leading-snug">
                      {testimonial.quote}
                    </blockquote>
                    <figcaption className="mt-1.5">
                      <span className="text-caption block font-bold not-italic">
                        {testimonial.name}
                      </span>
                      <span className="text-caption text-muted-foreground block leading-tight">
                        {testimonial.role}
                      </span>
                    </figcaption>
                  </div>
                </figure>
              </li>
            ))}
          </ul>

          {/*
            BOTH ARROWS TOGETHER, AT THE END OF THE ROW.

            "Previous" used to sit between the heading and the rail, which put
            the two halves of one control a full rail apart — about a thousand
            pixels on a wide screen — and crowded the heading besides. A pair
            of controls that act on the same thing has to read as a pair.

            They follow the rail in the DOM as well as on screen, which is the
            order they are announced in: the region first, then the controls
            that move it.
          */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {arrow(-1, 'Previous testimonials', ChevronLeft, atStart)}
            {arrow(1, 'Next testimonials', ChevronRight, atEnd)}
          </div>
        </div>
      </PageShell>
    </section>
  );
}
