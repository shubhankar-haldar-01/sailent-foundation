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
  beneficiaries: { icon: PeopleSolid, wash: 'bg-wash-amber text-wash-amber-ink', stroke: false },
  communities: { icon: PinSolid, wash: 'bg-wash-blue text-wash-blue-ink', stroke: false },
  campaigns: { icon: Heart, wash: 'bg-wash-mint text-wash-mint-ink', stroke: true },
  volunteers: { icon: PeopleSolid, wash: 'bg-wash-rose text-wash-rose-ink', stroke: false },
  years: { icon: Star, wash: 'bg-wash-amber text-wash-gold-ink', stroke: true },
} as const;

const FALLBACK = { icon: Star, wash: 'bg-wash-blue text-wash-blue-ink', stroke: true } as const;

/**
 * The impact strip.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Every figure is a LIVE DATABASE AGGREGATE (decision A14). The reference
 * shows "50,000+ Lives Impacted · 120+ Communities · 15+ Years of Service";
 * none of those is typed in here, and none of them will be. The layout, the
 * icons, the weights and the rules below are matched to it exactly — the
 * numbers are counted.
 *
 * A metric with nothing behind it does not render, so the strip shrinks rather
 * than inventing a number. If the whole set is empty the section disappears.
 *
 * An unverifiable statistic on a donation page is the first thing a journalist
 * checks, and the only version of this that is safe is the one counted from
 * records.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * How the figures are counted is stated once on /impact rather than in a
 * footnote here — the approved strip is a single compact row, and a paragraph
 * of methodology under it doubles the height of the band.
 */
export function ImpactStats({ metrics }: { metrics: ImpactMetric[] }) {
  if (metrics.length === 0) return null;

  return (
    <section
      aria-labelledby="impact-stats-title"
      className="bg-surface-warm border-border border-b"
    >
      <PageShell className="py-6 lg:py-7">
        <h2 id="impact-stats-title" className="sr-only">
          Our impact so far
        </h2>

        {/*
          The quote moves BESIDE the figures at `xl`, not at `lg`.

          At 1024 the five figures need about 950px on one line and the quote
          wants 224 of the 984 available. Something has to give, and when it
          was the figures three labels wrapped and "Years of Service" went to
          three lines. Stacking the quote costs one row of height at one
          breakpoint and keeps the strip reading as a strip.
        */}
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:gap-7">
          {/*
            The hairline rules between figures are the reference's, and they
            are drawn with `divide-x` on the ROW rather than a border on each
            item — a per-item border needs a "not the first one" rule that has
            to be re-derived at every breakpoint where the wrapping changes.

            The cells size to their CONTENT and the row spreads them, which is
            why the rules do not land at even intervals. That is the reference:
            look at it and the gap after "Volunteers" is visibly tighter than
            the one after "Lives Impacted". Equal-width columns would even the
            rules out and force the longest label to wrap so that the shortest
            could keep space it does not need.

            They appear only at `lg`, where this is genuinely one row. In the
            two- and three-column grid above that, a vertical rule would land
            between items that are not adjacent on screen.
          */}
          <ul
            className={cn(
              'grid flex-1 grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3',
              'lg:divide-border lg:flex lg:flex-nowrap lg:justify-between lg:gap-x-0 lg:divide-x',
            )}
          >
            {metrics.map((metric, index) => {
              const meta = ICONS[metric.id as keyof typeof ICONS] ?? FALLBACK;
              const Icon = meta.icon;

              return (
                <Reveal
                  as="li"
                  key={metric.id}
                  delay={index * 70}
                  className="flex items-center gap-3 lg:gap-3.5 lg:px-2 xl:px-3"
                >
                  <span
                    className={cn(
                      'grid size-12 shrink-0 place-items-center rounded-full lg:size-14',
                      meta.wash,
                    )}
                  >
                    <Icon
                      className="size-6 lg:size-7"
                      aria-hidden="true"
                      // Only meaningful on the two lucide marks; the solid ones
                      // ignore it because they have no stroke to weight.
                      {...(meta.stroke ? { strokeWidth: 2.4 } : {})}
                    />
                  </span>

                  <span className="min-w-0">
                    <span
                      data-numeric=""
                      className="font-display text-h4 lg:text-h3 block font-bold tabular-nums leading-none"
                    >
                      {formatNumber(metric.value)}
                      {metric.unit ? (
                        <span className="text-body-sm text-muted-foreground ml-1 font-semibold">
                          {metric.unit}
                        </span>
                      ) : null}
                    </span>
                    {/*
                      One line from `lg`, which is where the figures become a
                      single row with the full width to themselves. Below that it
                      wraps rather than overflowing — "Active Campaigns" on two
                      lines is untidy; "Active Campaig…" is broken.
                    */}
                    <span className="text-body-sm text-muted-foreground mt-1 block leading-tight lg:whitespace-nowrap">
                      {metric.label}
                    </span>
                  </span>
                </Reveal>
              );
            })}
          </ul>

          <figure className="border-border flex gap-3 border-t pt-4 xl:w-60 xl:shrink-0 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 2xl:w-72">
            {/*
              A typographic quote mark, not the lucide icon.

              The reference's mark is a large, soft, grey double-quote sitting
              above the first line — a piece of TYPE. The icon version is two
              small filled commas on the baseline, which is a different shape at
              a different weight, and no amount of sizing turns one into the
              other.

              `aria-hidden`, because the blockquote below already says this is a
              quotation and a screen reader announcing a stray quotation mark
              before it is noise.
            */}
            <span
              aria-hidden="true"
              className="font-display text-muted-foreground/45 select-none text-[2.75rem] font-bold leading-[0.8]"
            >
              &ldquo;
            </span>
            <div className="min-w-0">
              <blockquote className="text-body-sm text-balance leading-snug">
                &ldquo;Together, we can create a more compassionate, equal and sustainable
                world.&rdquo;
              </blockquote>
              <figcaption className="text-caption text-muted-foreground mt-1.5">
                — Sailent Foundation
              </figcaption>
            </div>
          </figure>
        </div>
      </PageShell>
    </section>
  );
}
