'use client';

import { MediaFrame } from '@/components/media/media-frame';
import { RailPauseToggle } from '@/components/motion/rail-pause-toggle';
import { useAutoplayRail } from '@/components/motion/use-autoplay-rail';
import { PageShell } from '@/components/layout/page-shell';
import { HeadingRule } from '@/components/home/section-head';
import { testimonials } from '@/lib/mock/home';

/**
 * How long each testimonial is held before the row moves on. Longer than the
 * campaigns rail's five seconds: these are sentences to read, not cards to
 * glance at.
 */
const TESTIMONIAL_INTERVAL_MS = 6500;

/**
 * Testimonials.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SCROLLER THAT ALSO MOVES ON ITS OWN — AT THE CLIENT'S REQUEST.
 *
 * The list is a real horizontally-scrolling list with snap points: it works by
 * swipe, by trackpad, by keyboard (the list itself is focusable), and with
 * JavaScript off. `useAutoplayRail` advances it one testimonial at a time on
 * top of that, and carries what content moving under a reader obliges:
 *   • hover, or focus in the list, holds it still — nothing slides away
 *     mid-sentence;
 *   • swiping, scrolling or arrowing through it yourself stops it for good;
 *   • `prefers-reduced-motion` means it never starts;
 *   • it waits while the tab is hidden or the band is off screen;
 *   • a pause/play control for keyboard and screen-reader users, shown when
 *     tabbed to — WCAG 2.2.2 (Level A). The visible previous/next arrows were
 *     taken off at the client's request.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The heading shares the row with the cards at `lg`, as approved, and stacks
 * above them below it.
 */
export function Testimonials() {
  const rail = useAutoplayRail(testimonials.length, { intervalMs: TESTIMONIAL_INTERVAL_MS });

  if (testimonials.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-title" className="bg-surface border-border border-b">
      <PageShell className="band-y">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
          {/* `relative` anchors the pause control, which appears under the heading when tabbed to. */}
          <div className="relative flex shrink-0 items-center gap-3">
            <h2
              id="testimonials-title"
              className="font-display text-section tracking-(--text-section--letter-spacing) font-bold"
            >
              What People Say
            </h2>
            <HeadingRule />
            <RailPauseToggle
              rail={rail}
              label="testimonials"
              className="focus-visible:left-0 focus-visible:top-full focus-visible:mt-2"
            />
          </div>

          <ul
            ref={rail.ref}
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
        </div>
      </PageShell>
    </section>
  );
}
