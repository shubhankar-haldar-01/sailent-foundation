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
 * 5 curated spotlight publication marks meticulously matching the approved reference design.
 */
const DEFAULT_PUBLICATIONS: SpotlightItem[] = [
  {
    id: 'community-post',
    name: 'The Community Post',
    renderMark: (
      <div className="flex select-none flex-col items-center justify-center text-center">
        <span className="font-sans text-[8px] font-semibold uppercase tracking-[0.25em] text-slate-800 sm:text-[9px] dark:text-slate-300">
          THE
        </span>
        <span className="mt-0.5 font-serif text-sm font-bold uppercase tracking-tight text-[#0F172A] sm:text-base lg:text-lg dark:text-white">
          COMMUNITY
        </span>
        <span className="-mt-0.5 font-sans text-[8px] font-semibold uppercase tracking-[0.28em] text-slate-800 sm:text-[9px] dark:text-slate-300">
          POST
        </span>
        <div className="mx-auto mt-1 h-[2px] w-6 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
      </div>
    ),
  },
  {
    id: 'impact-journal',
    name: 'Impact Journal',
    renderMark: (
      <div className="flex select-none flex-col items-start justify-center">
        <span className="font-serif text-xl font-bold leading-none tracking-tight text-[#0F172A] sm:text-2xl lg:text-[26px] dark:text-white">
          Impact
        </span>
        <div className="mt-0.5 flex w-full items-center">
          <div className="h-[2px] w-8 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
          <span className="-mt-0.5 ml-1 font-serif text-xs italic text-slate-600 sm:text-sm lg:text-base dark:text-slate-300">
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
        <span className="font-sans text-xl font-black uppercase leading-none tracking-tight text-[#EB6A1F] sm:text-2xl lg:text-3xl">
          TODAY
        </span>
        <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-600 sm:text-[10px] dark:text-slate-400">
          <span className="h-[1px] w-3.5 bg-slate-400" aria-hidden="true" />
          INDIA
          <span className="h-[1px] w-3.5 bg-slate-400" aria-hidden="true" />
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
          <span className="font-serif text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl lg:text-[28px] dark:text-white">
            Daily
          </span>
          {/* Radiating 3 small spark rays above the 'y' */}
          <div className="absolute -right-3 -top-2 flex items-end gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-0.5 rotate-[20deg] rounded-full bg-[#EB6A1F]" />
            <span className="h-2 w-0.5 rotate-[45deg] rounded-full bg-[#EB6A1F]" />
            <span className="h-1.5 w-0.5 rotate-[70deg] rounded-full bg-[#EB6A1F]" />
          </div>
        </div>
        <span className="-mt-0.5 font-serif text-xl font-bold leading-none tracking-tight text-[#0F172A] sm:text-2xl lg:text-[28px] dark:text-white">
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
        <span className="font-serif text-[10px] italic leading-none text-slate-500 sm:text-xs dark:text-slate-400">
          The
        </span>
        <span className="mt-0.5 font-serif text-sm font-bold leading-tight tracking-tight text-[#0F172A] sm:text-base lg:text-lg dark:text-white">
          Changemakers
        </span>
        <div className="mx-auto mt-1 h-[1.5px] w-14 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
      </div>
    ),
  },
];

const MARQUEE_DURATION_SECONDS = 32;

interface SpotlightSectionProps {
  /** Optional publications list for verified press coverage. */
  publications?: SpotlightItem[];
  className?: string;
}

/**
 * In The Spotlight — Media Recognition & Coverage Showcase.
 *
 * Continuous circular infinite marquee:
 * - Runs seamlessly and continuously like a circular loop with no pauses or breaks.
 * - Pauses smoothly on hover and keyboard focus.
 * - Respects prefers-reduced-motion (turns into clean accessible wrapping row).
 * - Hidden-until-focused keyboard pause/play control for WCAG 2.2.2 (Level A).
 */
export function SpotlightSection({
  publications = DEFAULT_PUBLICATIONS,
  className,
}: SpotlightSectionProps) {
  const [isPaused, setIsPaused] = React.useState(false);

  // Duplicate items in each track so track width always exceeds wide screens seamlessly
  const trackItems = React.useMemo(() => {
    return publications.length <= 5 ? [...publications, ...publications] : publications;
  }, [publications]);

  return (
    <section
      aria-labelledby="spotlight-title"
      className={cn(
        'bg-background border-border dark:bg-background relative overflow-hidden border-b py-5 sm:py-6 lg:py-7',
        className,
      )}
    >
      {/* Soft sky-blue glow in top-left */}
      <div
        className="pointer-events-none absolute -left-12 -top-12 h-80 w-80 rounded-full bg-gradient-to-br from-blue-100/50 via-sky-50/30 to-transparent blur-3xl dark:from-sky-950/20"
        aria-hidden="true"
      />

      {/* Soft peach glow in bottom-left */}
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-80 w-80 rounded-full bg-gradient-to-tr from-[#FEDECA]/50 via-[#FFF1E6]/30 to-transparent blur-3xl dark:from-orange-950/15"
        aria-hidden="true"
      />

      {/* Soft peach glow in mid-right */}
      <div
        className="pointer-events-none absolute -right-16 top-1/4 h-80 w-80 rounded-full bg-gradient-to-bl from-[#FEDECA]/45 via-[#FFF6ED]/25 to-transparent blur-3xl dark:from-orange-950/15"
        aria-hidden="true"
      />

      <PageShell>
        {/* ─────────────────────────────────────────────────────────────────
            SECTION HEADER
            ───────────────────────────────────────────────────────────────── */}
        <div className="relative text-center">
          {/* Eyebrow: 3 radiating orange sunburst rays */}
          <div className="mb-1 flex items-end justify-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-1 -rotate-[26deg] rounded-full bg-[#EB6A1F]" />
            <span className="h-3.5 w-1 rounded-full bg-[#EB6A1F]" />
            <span className="h-2.5 w-1 rotate-[26deg] rounded-full bg-[#EB6A1F]" />
          </div>

          {/* Heading */}
          <h2
            id="spotlight-title"
            className="font-display text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[34px] dark:text-slate-100"
          >
            <span>In The</span> <span className="text-[#EB6A1F]">Spotlight</span>
          </h2>

          {/* Centered horizontal accent bar under "Spotlight" */}
          <div className="mx-auto mt-1.5 h-1 w-9 rounded-full bg-[#EB6A1F]" aria-hidden="true" />

          {/* Supporting text in Inter */}
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl font-sans text-xs sm:text-sm md:text-[15px]">
            Our work and impact across the media
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            CONTINUOUS CIRCULAR MARQUEE (no pauses or breaks)
            ───────────────────────────────────────────────────────────────── */}
        <div className="relative mx-auto mt-5 w-full max-w-5xl px-2 sm:mt-6 sm:px-4 md:px-6">
          {/* Large White Rounded Container */}
          <div className="border-border bg-surface dark:border-border dark:bg-surface relative w-full overflow-hidden rounded-[22px] border p-2.5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] sm:rounded-[26px] sm:p-3 md:p-3.5 lg:rounded-[28px]">
            {/* Keyboard-accessible pause/play toggle (WCAG 2.2.2 Level A) */}
            <button
              type="button"
              onClick={() => setIsPaused((paused) => !paused)}
              aria-pressed={isPaused}
              className={cn(
                'pointer-events-none absolute right-3 top-3 z-10 opacity-0 sm:right-4 sm:top-4',
                'focus:pointer-events-auto focus:opacity-100',
                'grid size-8 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition-opacity dark:border-slate-700 dark:bg-slate-900',
                'hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#EB6A1F]',
                'motion-reduce:hidden',
              )}
            >
              {isPaused ? (
                <Play
                  className="size-3.5 fill-current text-[#0F172A] dark:text-white"
                  aria-hidden="true"
                />
              ) : (
                <Pause
                  className="size-3.5 fill-current text-[#0F172A] dark:text-white"
                  aria-hidden="true"
                />
              )}
              <span className="sr-only">
                {isPaused
                  ? 'Resume the scrolling list of spotlight publications'
                  : 'Pause the scrolling list of spotlight publications'}
              </span>
            </button>

            {/* Continuous Marquee Track */}
            <div
              data-paused={isPaused ? 'true' : undefined}
              style={
                {
                  '--marquee-gap': '1rem',
                  '--marquee-duration': `${MARQUEE_DURATION_SECONDS}s`,
                } as React.CSSProperties
              }
              className="marquee w-full"
            >
              {/* Primary list */}
              <ul
                aria-label="Media publications spotlight"
                className="m-0 flex shrink-0 list-none items-center justify-start gap-[var(--marquee-gap)] p-0 py-2"
              >
                {trackItems.map((item, index) => (
                  <li key={`${item.id}-${index}`} className="shrink-0">
                    <div className="card-interactive lg:h-30 dark:bg-slate-850 group flex h-24 w-40 cursor-pointer items-center justify-center rounded-xl p-2.5 hover:border-[#EB6A1F]/35 sm:h-28 sm:w-48 sm:rounded-2xl sm:p-3 lg:w-52 dark:border-slate-800 dark:hover:border-slate-700">
                      <div className="transition-transform duration-300 group-hover:scale-105 motion-reduce:scale-100">
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
                          <span className="font-serif text-base font-bold text-[#0F172A] dark:text-white">
                            {item.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Seam copy for seamless circular infinite scroll */}
              <ul
                aria-hidden="true"
                className="m-0 flex shrink-0 list-none items-center justify-start gap-[var(--marquee-gap)] p-0 py-2"
              >
                {trackItems.map((item, index) => (
                  <li key={`seam-${item.id}-${index}`} className="shrink-0" tabIndex={-1}>
                    <div className="card-interactive lg:h-30 dark:bg-slate-850 group flex h-24 w-40 cursor-pointer items-center justify-center rounded-xl p-2.5 hover:border-[#EB6A1F]/35 sm:h-28 sm:w-48 sm:rounded-2xl sm:p-3 lg:w-52 dark:border-slate-800 dark:hover:border-slate-700">
                      <div className="transition-transform duration-300 group-hover:scale-105 motion-reduce:scale-100">
                        {item.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.logoUrl}
                            alt=""
                            className="max-h-12 w-auto object-contain opacity-90 transition-opacity hover:opacity-100"
                          />
                        ) : item.renderMark ? (
                          item.renderMark
                        ) : (
                          <span className="font-serif text-base font-bold text-[#0F172A] dark:text-white">
                            {item.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
