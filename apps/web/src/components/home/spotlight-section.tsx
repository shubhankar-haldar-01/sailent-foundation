'use client';

import * as React from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';

export interface SpotlightItem {
  id: string;
  name: string;
  logoUrl?: string;
  renderMark?: React.ReactNode;
}

/**
 * 5 curated spotlight publication marks meticulously matching the reference design.
 */
export const DEFAULT_PUBLICATIONS: SpotlightItem[] = [
  {
    id: 'community-post',
    name: 'The Community Post',
    renderMark: (
      <div className="flex select-none flex-col items-center justify-center text-center">
        <span className="text-foreground font-sans text-[8px] font-semibold uppercase tracking-[0.25em] sm:text-[9px]">
          THE
        </span>
        <span className="text-foreground mt-0.5 font-serif text-sm font-bold uppercase tracking-tight sm:text-base lg:text-lg">
          COMMUNITY
        </span>
        <span className="text-foreground -mt-0.5 font-sans text-[8px] font-semibold uppercase tracking-[0.28em] sm:text-[9px]">
          POST
        </span>
      </div>
    ),
  },
  {
    id: 'impact-journal',
    name: 'Impact Journal',
    renderMark: (
      <div className="flex select-none flex-col items-start justify-center">
        <span className="text-foreground font-serif text-xl font-bold leading-none tracking-tight sm:text-2xl lg:text-[26px]">
          Impact
        </span>
        <div className="mt-0.5 flex w-full items-center">
          <span className="text-muted-foreground -mt-0.5 ml-1 font-serif text-xs italic sm:text-sm lg:text-base">
            Journal
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'today-india',
    name: 'Today India',
    renderMark: (
      <div className="flex select-none flex-col items-center justify-center text-center">
        <span className="text-primary font-sans text-xl font-black uppercase leading-none tracking-tight sm:text-2xl lg:text-3xl">
          TODAY
        </span>
        <div className="text-muted-foreground mt-0.5 flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] sm:text-[10px]">
          <span className="bg-muted-foreground h-[1px] w-3.5" aria-hidden="true" />
          INDIA
          <span className="bg-muted-foreground h-[1px] w-3.5" aria-hidden="true" />
        </div>
      </div>
    ),
  },
  {
    id: 'daily-voice',
    name: 'Daily Voice',
    renderMark: (
      <div className="flex select-none flex-col items-center justify-center text-center">
        <div className="relative inline-block leading-none">
          <span className="text-foreground font-serif text-xl font-bold tracking-tight sm:text-2xl lg:text-[28px]">
            Daily
          </span>
          {/* Radiating 3 small spark rays above the 'y' */}
          <div className="absolute -right-3 -top-2 flex items-end gap-0.5" aria-hidden="true">
            <span className="bg-primary h-1.5 w-0.5 rotate-[20deg] rounded-full" />
            <span className="bg-primary h-2 w-0.5 rotate-[45deg] rounded-full" />
            <span className="bg-primary h-1.5 w-0.5 rotate-[70deg] rounded-full" />
          </div>
        </div>
        <span className="text-foreground -mt-0.5 font-serif text-xl font-bold leading-none tracking-tight sm:text-2xl lg:text-[28px]">
          Voice
        </span>
      </div>
    ),
  },
  {
    id: 'changemakers',
    name: 'The Changemakers',
    renderMark: (
      <div className="flex select-none flex-col items-center justify-center text-center">
        <span className="text-muted-foreground font-serif text-[10px] italic leading-none sm:text-xs">
          The
        </span>
        <span className="text-foreground mt-0.5 font-serif text-sm font-bold leading-tight tracking-tight sm:text-base lg:text-lg">
          Changemakers
        </span>
      </div>
    ),
  },
];

interface SpotlightSectionProps {
  /** Optional publications list for verified press coverage. */
  publications?: SpotlightItem[];
  className?: string;
}

/**
 * In The Spotlight — Media Recognition & Coverage Showcase.
 *
 * Clean, modern layout:
 * - Festive top eyebrow with 3 radiating orange sunburst rays.
 * - Prominent "In The Spotlight" title with brand-orange "Spotlight" and accent underline.
 * - White rounded container card with subtle elevation.
 * - Continuous running marquee animation with seamless circular loop.
 * - 5 publication cards with bespoke typography and marks.
 */
export function SpotlightSection({
  publications = DEFAULT_PUBLICATIONS,
  className,
}: SpotlightSectionProps) {
  const [isPaused, setIsPaused] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // Ensure there are at least 5 items in the track for a seamless loop across large viewports
  const displayPublications = React.useMemo(() => {
    if (publications.length === 0) return [];
    let list = [...publications];
    while (list.length < 5) {
      list = [...list, ...publications];
    }
    return list;
  }, [publications]);

  const animationDuration = Math.max(20, displayPublications.length * 5);

  const renderCard = (item: SpotlightItem, key: string, isDuplicate = false) => (
    <div
      key={key}
      tabIndex={isDuplicate ? -1 : undefined}
      aria-hidden={isDuplicate ? 'true' : undefined}
      className="card-interactive group/card border-border/90 bg-surface hover:border-primary/35 flex h-24 w-52 shrink-0 select-none items-center justify-center rounded-2xl border p-3 shadow-sm transition-all hover:shadow-md sm:h-28 sm:w-60 md:w-64 lg:h-28"
    >
      <div className="transition-transform duration-300 group-hover/card:scale-105 motion-reduce:scale-100">
        {item.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.logoUrl}
            alt={item.name}
            className="max-h-12 w-auto object-contain opacity-90 transition-opacity hover:opacity-100"
          />
        ) : item.renderMark ? (
          item.renderMark
        ) : (
          <span className="text-foreground font-serif text-base font-bold">{item.name}</span>
        )}
      </div>
    </div>
  );

  return (
    <section
      aria-labelledby="spotlight-title"
      className={cn(
        'bg-background border-border dark:bg-background relative overflow-hidden border-b py-10 sm:py-12 lg:py-14',
        className,
      )}
    >
      {/* Dynamic Keyframes for smooth hardware-accelerated continuous gliding */}
      <style>{`
        @keyframes spotlight-glide {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-100%, 0, 0);
          }
        }
        .spotlight-marquee-container:hover .spotlight-continuous-track,
        .spotlight-marquee-container:focus-within .spotlight-continuous-track {
          animation-play-state: paused !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .spotlight-continuous-track {
            animation: none !important;
          }
        }
      `}</style>

      {/* Soft sky-blue ambient glow in top-left */}
      <div
        className="from-info-subtle/40 via-info-subtle/20 pointer-events-none absolute -left-16 -top-16 h-80 w-80 rounded-full bg-gradient-to-br to-transparent blur-3xl"
        aria-hidden="true"
      />

      {/* Soft peach ambient glow in bottom-left */}
      <div
        className="from-muted/40 via-muted/25 pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-gradient-to-tr to-transparent blur-3xl"
        aria-hidden="true"
      />

      {/* Soft peach ambient glow in mid-right */}
      <div
        className="from-muted/35 via-muted/20 pointer-events-none absolute -right-20 top-1/4 h-80 w-80 rounded-full bg-gradient-to-bl to-transparent blur-3xl"
        aria-hidden="true"
      />

      <PageShell>
        {/* ─────────────────────────────────────────────────────────────────
            SECTION HEADER
            ───────────────────────────────────────────────────────────────── */}
        <div className="relative text-center">
          {/* Eyebrow: 3 radiating orange sunburst rays */}
          <div className="mb-1 flex items-end justify-center gap-1.5" aria-hidden="true">
            <span className="bg-primary h-2.5 w-1 -rotate-[26deg] rounded-full" />
            <span className="bg-primary h-3.5 w-1 rounded-full" />
            <span className="bg-primary h-2.5 w-1 rotate-[26deg] rounded-full" />
          </div>

          {/* Heading */}
          <h2
            id="spotlight-title"
            className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]"
          >
            <span>In the</span> <span>spotlight</span>
          </h2>

          {/* Centered horizontal accent bar under "Spotlight" */}
          <div className="bg-primary mx-auto mt-1.5 h-1 w-10 rounded-full" aria-hidden="true" />

          {/* Supporting text */}
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl font-sans text-xs sm:text-sm md:text-[15px]">
            Our work and impact across the media
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            CAROUSEL CONTAINER
            ───────────────────────────────────────────────────────────────── */}
        <div className="relative mx-auto mt-6 w-full max-w-5xl px-3 sm:mt-8 sm:px-6">
          {/* Large White Rounded Container */}
          <div className="border-border bg-surface dark:border-border dark:bg-surface shadow-elevated relative w-full overflow-hidden rounded-[24px] border p-2.5 sm:rounded-[28px] sm:p-3.5 md:p-4 lg:rounded-[32px]">
            {/* Soft inner edge fades for seamless ingress/egress */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white via-white/80 to-transparent sm:w-10"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-white via-white/80 to-transparent sm:w-10"
              aria-hidden="true"
            />

            {/* Continuous Running Animation Marquee Container */}
            <div
              className="spotlight-marquee-container flex w-full overflow-hidden py-1"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onTouchStart={() => setIsHovered(true)}
              onTouchEnd={() => setIsHovered(false)}
            >
              {/* Primary Track */}
              <div
                className="spotlight-continuous-track flex shrink-0 items-center gap-3.5 pr-3.5 sm:gap-4 sm:pr-4 md:gap-5 md:pr-5"
                style={{
                  animation: `spotlight-glide ${animationDuration}s linear infinite`,
                  animationPlayState: isPaused || isHovered ? 'paused' : 'running',
                }}
              >
                {displayPublications.map((item, idx) =>
                  renderCard(item, `primary-${item.id}-${idx}`),
                )}
              </div>

              {/* Duplicate Track (for seamless infinite loop) */}
              <div
                aria-hidden="true"
                className="spotlight-continuous-track flex shrink-0 items-center gap-3.5 pr-3.5 sm:gap-4 sm:pr-4 md:gap-5 md:pr-5"
                style={{
                  animation: `spotlight-glide ${animationDuration}s linear infinite`,
                  animationPlayState: isPaused || isHovered ? 'paused' : 'running',
                }}
              >
                {displayPublications.map((item, idx) =>
                  renderCard(item, `duplicate-${item.id}-${idx}`, true),
                )}
              </div>
            </div>
          </div>

          {/* Accessible pause/play toggle */}
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            aria-pressed={isPaused}
            className={cn(
              'pointer-events-none absolute -bottom-10 right-0 z-20 opacity-0',
              'focus:pointer-events-auto focus:opacity-100',
              'border-border bg-surface grid size-8 place-items-center rounded-full border shadow-sm transition-opacity',
              'hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
              'motion-reduce:hidden',
            )}
          >
            {isPaused ? (
              <Play className="size-3.5" aria-hidden="true" />
            ) : (
              <Pause className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {isPaused
                ? 'Resume publication showcase animation'
                : 'Pause publication showcase animation'}
            </span>
          </button>
        </div>
      </PageShell>
    </section>
  );
}
