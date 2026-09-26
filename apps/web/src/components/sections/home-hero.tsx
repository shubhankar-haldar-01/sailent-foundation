import Link from 'next/link';
import { ArrowRight, HeartHandshake, MapPin, Megaphone, Users } from 'lucide-react';

import { Button, formatNumber } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { ScriptAccent } from '@/components/sections/script-accent';
import type { ImpactMetric } from '@/lib/content';

const ICONS = {
  beneficiaries: Users,
  programmes: MapPin,
  campaigns: Megaphone,
  donors: HeartHandshake,
  volunteers: Users,
  'volunteer-hours': HeartHandshake,
} as const;

/**
 * Homepage hero.
 *
 * ONE primary action above the fold. Donate is filled; everything else is
 * outlined or a link. Two competing primary actions halve the effect of both,
 * and on a donation site the cost of that is measurable.
 *
 * The statistics band is fed from the live database aggregates, not from
 * constants (decision A14). A figure that has no record behind it does not
 * render at all, so the band shrinks rather than inventing a number — which is
 * why the layout is a wrapping flex row and not a fixed four-column grid.
 */
export function HomeHero({ metrics }: { metrics: ImpactMetric[] }) {
  const band = metrics.slice(0, 4);

  return (
    <section className="bg-surface-sunken border-border relative border-b">
      <PageShell className="pb-0">
        <div className="grid items-center gap-10 pt-10 lg:grid-cols-2 lg:gap-14 lg:pt-14">
          <div className="lg:pb-24">
            <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
              Stronger people. Brighter tomorrows
            </p>

            <h1 className="font-display text-display mt-4 text-balance font-bold tracking-tight">
              Together, We Create{' '}
              {/* A colour change, not a meaning change — the sentence reads the
                  same without it, which is the test for decorative emphasis. */}
              <span className="text-accent-emphasis">Real Change</span>
            </h1>

            <p className="text-body-lg text-muted-foreground mt-5 max-w-xl leading-relaxed">
              Supporting communities through education, healthcare, food, disaster relief,
              livelihood, animal welfare and more.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/donate">Donate Now</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="group rounded-full">
                <Link href="/programs">
                  Explore Our Work
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </div>
          </div>

          <div className="lg:pb-24">
            {/* The positioning context is this wrapper, which hugs the image —
                NOT the column, which carries bottom padding for the stat band
                and would place `bottom-6` in that padding, below the photo. */}
            <div className="relative">
              <MediaFrame
                media={{
                  seed: 'home-hero',
                  alt: 'A student outside her school, holding her books',
                }}
                aspect="photo"
                priority
                className="shadow-lg"
              />
              {/* Inside the frame, not over its edge. `text-white` with a soft
                shadow rather than the brand green: the accent sits on
                photography whose brightness we do not control, and green on an
                unknown background is a contrast gamble. Decorative text is
                exempt from the contrast rule, but illegible ornament is still
                just mess. */}
              <ScriptAccent
                size="lg"
                className="absolute bottom-4 right-4 max-w-[10rem] text-right text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.55)] sm:bottom-6 sm:right-6 sm:max-w-[13rem]"
              >
                Education Empowers Communities
              </ScriptAccent>
            </div>
          </div>
        </div>
      </PageShell>

      {band.length > 0 ? (
        <PageShell className="pb-10 pt-0 lg:pb-0">
          {/* Pulled up over the section edge on large screens, as in the
              reference; stacked normally below that, where overlapping a
              narrow column just creates a cramped, clipped row. */}
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:-mt-16 lg:grid-cols-4 lg:pb-10">
            {band.map((metric) => {
              const Icon = ICONS[metric.id as keyof typeof ICONS] ?? Users;

              return (
                <li
                  key={metric.id}
                  className="border-border bg-surface rounded-xl border p-4 shadow-sm sm:p-5"
                >
                  <span className="bg-accent text-primary grid size-9 place-items-center rounded-lg">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <p data-numeric="" className="font-display text-h2 mt-3 font-bold tabular-nums">
                    {formatNumber(metric.value)}
                    {metric.unit ? (
                      <span className="text-body-sm text-muted-foreground ml-1 font-medium">
                        {metric.unit}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-0.5">{metric.label}</p>
                </li>
              );
            })}
          </ul>
        </PageShell>
      ) : null}
    </section>
  );
}
