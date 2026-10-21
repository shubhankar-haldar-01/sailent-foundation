'use client';

import * as React from 'react';
import { MapPin } from 'lucide-react';

import { cn } from '@sailent/ui';
import { MediaFrame } from '@/components/media/media-frame';
import { RailPauseToggle } from '@/components/motion/rail-pause-toggle';
import { useAutoplayRail } from '@/components/motion/use-autoplay-rail';
import { PageShell } from '@/components/layout/page-shell';
import { testimonials } from '@/lib/mock/home';

/**
 * How long each testimonial is held before the row moves on. Longer than the
 * campaigns rail's five seconds: these are sentences to read, not cards to
 * glance at.
 */
const TESTIMONIAL_INTERVAL_MS = 4000;

/**
 * Testimonials.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SCROLLER THAT ADVANCES ON ITS OWN — MATCHING FEATURED CAMPAIGNS.
 *
 * The list is a real horizontally-scrolling list with snap points: it works by
 * swipe, by trackpad, by keyboard (the list itself is focusable), and with
 * JavaScript off. `useAutoplayRail` advances it one testimonial at a time on
 * top of that:
 *   • hover, or focus in the list, holds it still;
 *   • swiping, scrolling or arrowing through it yourself pauses it;
 *   • `prefers-reduced-motion` means it never starts;
 *   • it waits while the tab is hidden or the band is off screen;
 *   • a pause/play control for keyboard and screen-reader users, shown when
 *     tabbed to — WCAG 2.2.2 (Level A).
 * ══════════════════════════════════════════════════════════════════════════
 */
export function Testimonials() {
  const rail = useAutoplayRail(testimonials.length, { intervalMs: TESTIMONIAL_INTERVAL_MS });
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const el = rail.ref.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const second = first?.nextElementSibling as HTMLElement | null;
      const step =
        second && first
          ? second.getBoundingClientRect().left - first.getBoundingClientRect().left
          : (first?.clientWidth ?? 1);
      if (step <= 0) return;
      const idx = Math.round(el.scrollLeft / step);
      setActiveIndex(Math.min(Math.max(idx, 0), testimonials.length - 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [rail.ref]);

  if (testimonials.length === 0) return null;

  return (
    <section
      aria-labelledby="testimonials-title"
      className="border-border bg-surface-warm relative border-b"
    >
      <PageShell className="band-y">
        <div className="relative mx-auto mb-10 max-w-2xl text-center">
          <RailPauseToggle
            rail={rail}
            label="testimonials"
            className="focus-visible:left-0 focus-visible:top-0"
          />
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary font-bold uppercase">
            Real Stories, Real Impact
          </p>
          <h2
            id="testimonials-title"
            className="font-display text-h1 sm:text-display-sm text-accent-950 mt-1.5 font-bold tracking-tight dark:text-white"
          >
            Voices of <span className="text-primary">Hope and Change</span>
          </h2>
          <div className="bg-primary mx-auto mt-2.5 h-1 w-10 rounded-full" aria-hidden="true" />
          <p className="text-body-sm sm:text-body text-muted-foreground mt-3 leading-relaxed">
            Every story reminds us why compassion matters. Hear from the people and communities
            growing stronger with Sailent Foundation.
          </p>
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
           */
          tabIndex={0}
          aria-label="Testimonials, scrollable"
          className="focus-visible:outline-ring rail flex min-w-0 snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth py-3 focus-visible:outline-2 focus-visible:outline-offset-2 sm:-mx-2 sm:gap-6 sm:px-2"
        >
          {testimonials.map((testimonial, index) => (
            <li
              key={testimonial.id}
              className="rise-in flex shrink-0 basis-full snap-start sm:basis-[calc((100%-1.25rem)/2)] lg:basis-[calc((100%-2.5rem)/3)]"
              style={{ '--rise-delay': `${Math.min(index, 3) * 70}ms` } as React.CSSProperties}
            >
              <figure className="card-interactive border-border-card bg-surface shadow-card flex h-full w-full flex-col justify-between rounded-2xl border p-6 sm:p-7">
                <div>
                  <div className="mb-4 flex items-center justify-end">
                    <svg
                      className="text-primary/20 size-7 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                  </div>
                  <blockquote className="text-body-sm text-foreground/90 font-normal italic leading-relaxed">
                    “{testimonial.quote.replace(/^["“]|["”]$/g, '')}”
                  </blockquote>
                </div>

                <figcaption className="mt-6 flex items-center gap-3.5 pt-2">
                  <span className="ring-primary/15 size-12 shrink-0 overflow-hidden rounded-full ring-2">
                    <MediaFrame
                      media={{
                        seed: testimonial.photoSeed,
                        alt: testimonial.name,
                        ...(testimonial.photoUrl ? { url: testimonial.photoUrl } : {}),
                      }}
                      aspect="square"
                      rounded={false}
                      sizes="48px"
                    />
                  </span>
                  <div className="flex min-w-0 flex-col justify-center">
                    <span className="text-body-sm text-accent-950 block font-bold not-italic leading-tight dark:text-white">
                      {testimonial.name}
                    </span>
                    <span className="text-caption text-muted-foreground mt-0.5 block leading-tight">
                      {testimonial.role}
                    </span>
                    {testimonial.location && (
                      <span className="text-muted-foreground/85 mt-1 flex items-center gap-1 text-[12px] font-medium leading-tight">
                        <MapPin className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                        <span>{testimonial.location}</span>
                      </span>
                    )}
                  </div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <div className="relative mt-10 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="border-border w-full border-t" />
          </div>
          <div className="bg-background relative px-4">
            <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
              Stories from our community
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2" aria-label="Testimonial pagination">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const el = rail.ref.current;
                if (!el) return;
                const first = el.firstElementChild as HTMLElement | null;
                const second = first?.nextElementSibling as HTMLElement | null;
                const step =
                  second && first
                    ? second.offsetLeft - first.offsetLeft
                    : (first?.clientWidth ?? 1);
                el.scrollTo({ left: i * step, behavior: 'smooth' });
                rail.surrender();
              }}
              aria-label={`Slide ${i + 1}`}
              className={cn(
                'h-2.5 cursor-pointer rounded-full transition-all duration-500',
                i === activeIndex
                  ? 'bg-primary shadow-xs w-7'
                  : 'bg-primary/25 hover:bg-primary/50 dark:bg-primary/30 w-2.5',
              )}
            />
          ))}
        </div>
      </PageShell>
    </section>
  );
}
