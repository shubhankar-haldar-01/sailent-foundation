import { Award, CalendarRange, HeartHandshake, MapPin, Megaphone, Users } from 'lucide-react';

import { formatNumber } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { ScriptAccent } from '@/components/sections/script-accent';
import type { ImpactMetric } from '@/lib/content';

const ICONS = {
  beneficiaries: HeartHandshake,
  programmes: MapPin,
  campaigns: Megaphone,
  donors: Users,
  volunteers: Users,
  'volunteer-hours': CalendarRange,
} as const;

/**
 * The impact band: circular stat medallions beside a photograph.
 *
 * Every figure here is a live database aggregate (decision A14). The component
 * renders NOTHING when there are no figures to show — an impact section on an
 * NGO site that displays zeroes, or worse a plausible invented number, is the
 * single most damaging thing this page could do. A section that is absent
 * because the work has not been recorded yet is honest; one that is present
 * and wrong is not recoverable.
 */
export function ImpactBand({ metrics }: { metrics: ImpactMetric[] }) {
  if (metrics.length === 0) return null;

  return (
    <section className="bg-accent/40 border-border border-y">
      <PageShell>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-14">
          <div>
            <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
              Our impact
            </p>
            <h2 className="font-display text-h1 mt-2 text-balance font-bold tracking-tight">
              Real People. Real Change.
            </h2>
            <p className="text-body text-muted-foreground mt-3 max-w-xl leading-relaxed">
              Our work is more than numbers — it is about brighter futures, stronger communities and
              lasting impact.
            </p>

            <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-7">
              {metrics.map((metric) => {
                const Icon = ICONS[metric.id as keyof typeof ICONS] ?? Award;

                return (
                  <li key={metric.id} className="w-24 text-center">
                    <span className="bg-surface text-primary mx-auto grid size-14 place-items-center rounded-full shadow-sm">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <p data-numeric="" className="font-display text-h3 mt-3 font-bold tabular-nums">
                      {formatNumber(metric.value)}
                      {metric.unit ? (
                        <span className="text-body-sm text-muted-foreground ml-0.5 font-medium">
                          {metric.unit}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-caption text-muted-foreground mt-0.5 text-balance">
                      {metric.label}
                    </p>
                  </li>
                );
              })}
            </ul>

            {/* Says where the numbers come from, in the same breath as the
                numbers. The claim and its basis should not be separated by a
                scroll — that is what makes a statistic checkable. */}
            <p className="text-caption text-muted-foreground mt-8 max-w-xl">
              Every figure above is counted from our program and donation records, and updates as
              those records do. Where we have not yet recorded something, we do not show a number
              for it.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-xs">
            <MediaFrame
              media={{
                seed: 'impact-portrait',
                alt: 'A boy in a school uniform holding an exercise book',
              }}
              aspect="portrait"
              className="shadow-lg"
            />
            {/* Above the frame rather than over it — there is room here, and
                the green reads cleanly against the page background. */}
            <ScriptAccent
              size="md"
              className="text-primary absolute -top-9 right-0 max-w-[9rem] text-right"
            >
              A Brighter Future for All
            </ScriptAccent>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
