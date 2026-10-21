import { Heart, Star } from 'lucide-react';

import { cn, formatNumber } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { PeopleSolid, PinSolid } from '@/components/home/focus-icons';
import { Reveal } from '@/components/motion/reveal';
import type { ImpactMetric } from '@/lib/content';

/**
 * Icon, wash and ink per figure, as the approved strip draws them.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MIX OF SOLID AND OUTLINE IS THE DESIGN, NOT AN INCONSISTENCY.
 *
 * The approved band uses solid marks for the two people groups and the pin,
 * and heavy outlines for the heart and the star. That is a deliberate contrast
 * — a filled heart at this size reads as a blob, and a hollow group of figures
 * reads as noise. Making all five one or the other is what the reference
 * avoids, so it is what this avoids.
 *
 * The solid ones are drawn in `focus-icons.tsx` because `lucide` is a STROKE
 * set: `fill="currentColor"` on a multi-element outline closes shapes that were
 * never meant to close and turns `Users` into a smear. The outlined two are
 * lucide at `strokeWidth={2.4}`, which is what gives them the weight the
 * reference has without leaving the icon set.
 * ══════════════════════════════════════════════════════════════════════════
 */
const ICONS = {
  beneficiaries: {
    icon: PeopleSolid,
    wash: 'bg-[#FFEDD5] text-[#C2410C] shadow-[0_4px_14px_rgba(194,65,12,0.22)]',
    stroke: false,
  },
  communities: {
    icon: PinSolid,
    wash: 'bg-[#DBEAFE] text-[#0284C7] shadow-[0_4px_14px_rgba(2,132,199,0.22)]',
    stroke: false,
  },
  campaigns: {
    icon: Heart,
    wash: 'bg-[#DCFCE7] text-[#15803D] shadow-[0_4px_14px_rgba(22,163,74,0.22)]',
    stroke: true,
  },
  volunteers: {
    icon: PeopleSolid,
    wash: 'bg-[#FFE4E6] text-[#BE123C] shadow-[0_4px_14px_rgba(190,18,60,0.22)]',
    stroke: false,
  },
  years: {
    icon: Star,
    wash: 'bg-[#FEF3C7] text-[#D97706] shadow-[0_4px_14px_rgba(217,119,6,0.22)]',
    stroke: true,
  },
} as const;

const FALLBACK = {
  icon: Star,
  wash: 'bg-[#DBEAFE] text-[#0284C7] shadow-[0_4px_14px_rgba(2,132,199,0.22)]',
  stroke: true,
} as const;

/**
 * The impact strip.
 *
 * Rendered as an elevated rounded pill card with ambient shadows, subtle warm
 * border, icon glow drop-shadows, and vertical dividers matching the approved design.
 */
export function ImpactStats({ metrics }: { metrics: ImpactMetric[] }) {
  if (metrics.length === 0) return null;

  return (
    <section
      aria-labelledby="impact-stats-title"
      className="border-border border-b py-6 sm:py-8 lg:py-9"
    >
      <PageShell>
        <h2 id="impact-stats-title" className="sr-only">
          Our impact so far
        </h2>

        {/* Elevated rounded card container with consistent card-elevated variant */}
        <div className="card-elevated lg:py-6.5 bg-surface dark:bg-surface rounded-[22px] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-8">
            <ul className="lg:divide-border dark:lg:divide-border grid flex-1 grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:flex lg:flex-nowrap lg:items-center lg:justify-between lg:gap-x-0 lg:divide-x">
              {metrics.map((metric, index) => {
                const meta = ICONS[metric.id as keyof typeof ICONS] ?? FALLBACK;
                const Icon = meta.icon;

                return (
                  <Reveal
                    as="li"
                    key={metric.id}
                    delay={index * 70}
                    className="flex items-center gap-3.5 lg:px-4 xl:px-6"
                  >
                    <span
                      className={cn(
                        'grid size-12 shrink-0 place-items-center rounded-full transition-transform lg:size-14',
                        meta.wash,
                      )}
                    >
                      <Icon
                        className="size-6 lg:size-7"
                        aria-hidden="true"
                        {...(meta.stroke ? { strokeWidth: 2.4 } : {})}
                      />
                    </span>

                    <span className="min-w-0">
                      <span
                        data-numeric=""
                        className="font-display block text-2xl font-bold tabular-nums leading-none tracking-tight text-[#0F172A] lg:text-[28px] dark:text-white"
                      >
                        {formatNumber(metric.value)}
                        {metric.unit ? (
                          <span className="text-body-sm text-muted-foreground ml-1 font-semibold">
                            {metric.unit}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-body-sm mt-1 block font-medium leading-tight text-[#64748B] lg:whitespace-nowrap dark:text-slate-400">
                        {metric.label}
                      </span>
                    </span>
                  </Reveal>
                );
              })}
            </ul>

            <figure className="border-border dark:border-border flex items-start gap-2.5 border-t pt-4 xl:w-64 xl:shrink-0 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 2xl:w-72">
              <span
                aria-hidden="true"
                className="font-display text-primary select-none text-2xl font-black leading-none sm:text-3xl"
              >
                &ldquo;
              </span>
              <div className="min-w-0">
                <blockquote className="text-xs font-medium leading-snug text-[#1E293B] sm:text-[13px] dark:text-slate-200">
                  &ldquo;Together, we can create a more compassionate, equal and sustainable
                  world.&rdquo;
                </blockquote>
                <figcaption className="text-caption mt-1 text-[#64748B] dark:text-slate-400">
                  — Sailent Foundation
                </figcaption>
              </div>
            </figure>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
