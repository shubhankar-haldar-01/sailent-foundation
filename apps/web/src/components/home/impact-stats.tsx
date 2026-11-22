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
    wash: 'bg-accent text-primary',
    stroke: false,
  },
  communities: {
    icon: PinSolid,
    wash: 'bg-accent text-primary',
    stroke: false,
  },
  campaigns: {
    icon: Heart,
    wash: 'bg-accent text-primary',
    stroke: true,
  },
  years: {
    icon: Star,
    wash: 'bg-accent text-primary',
    stroke: true,
  },
} as const;

const FALLBACK = {
  icon: Star,
  wash: 'bg-accent text-primary',
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
                        className="font-display text-foreground block text-2xl font-bold tabular-nums leading-none tracking-tight lg:text-[28px]"
                      >
                        {formatNumber(metric.value)}
                        {metric.unit ? (
                          <span className="text-body-sm text-muted-foreground ml-1 font-semibold">
                            {metric.unit}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-body-sm text-muted-foreground mt-1 block font-medium leading-tight lg:whitespace-nowrap">
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
                <blockquote className="text-foreground text-xs font-medium leading-snug sm:text-[13px]">
                  &ldquo;Together, we can create a more compassionate, equal and sustainable
                  world.&rdquo;
                </blockquote>
                <figcaption className="text-caption text-muted-foreground mt-1">
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
