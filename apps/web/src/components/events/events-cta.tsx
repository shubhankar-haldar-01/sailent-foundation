import Link from 'next/link';
import { ArrowRight, CalendarHeart } from 'lucide-react';

import { Button } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';

/**
 * "Want to get involved?" — the wide cream panel between the upcoming events
 * and the past ones, as the owner's design (2026-10-17) draws it: a calendar
 * mark on a peach disc, the line and its explanation, and the orange button.
 *
 * It goes to /volunteer, the existing volunteering page and its application
 * form — no new route and no second sign-up flow. No decoration beyond the
 * one mark.
 */
export function EventsCta() {
  return (
    <section aria-labelledby="events-involved-title" className="mt-12 md:mt-14">
      <PageShell>
        <div className="bg-surface-warm flex flex-col items-start gap-5 rounded-[1.25rem] px-6 py-7 sm:flex-row sm:items-center sm:gap-6 sm:px-8 lg:px-10 lg:py-8">
          <span
            aria-hidden="true"
            className="bg-wash-coral text-cta-glow grid size-16 shrink-0 place-items-center rounded-2xl"
          >
            <CalendarHeart className="size-8" strokeWidth={1.75} />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id="events-involved-title"
              className="font-display text-foreground text-[1.375rem] font-bold leading-tight tracking-[-0.01em] sm:text-2xl"
            >
              Want to get involved?
            </h2>
            <p className="text-muted-foreground mt-1.5 max-w-[36rem] text-[0.9375rem] leading-relaxed">
              Join our events, volunteer with us, and be part of meaningful activities in your
              community.
            </p>
          </div>

          <Button asChild size="lg" className="group/cta shrink-0">
            <Link href="/volunteer">
              Explore Volunteering
              <ArrowRight
                className="duration-(--duration-base) transition-transform motion-safe:group-hover/cta:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </Button>
        </div>
      </PageShell>
    </section>
  );
}
