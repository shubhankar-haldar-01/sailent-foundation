import { CalendarDays } from 'lucide-react';

import { EVENTS_LEAD, EVENTS_TITLE } from '@/components/events/events-copy';
import { PageShell } from '@/components/layout/page-shell';
import { UpcomingEventsSkeleton } from '@/components/events/events-skeletons';
import { HeroStatSkeleton, InteriorHero } from '@/components/sections/interior-hero';

/**
 * The page as it will look, with the cards still to come: the header and the
 * section heading are static, so they are the real ones, and only the area
 * that waits on the API is drawn as a skeleton — nothing jumps when the page
 * arrives.
 */
export default function Loading() {
  return (
    <div className="pb-14 md:pb-20">
      <InteriorHero
        variant="compact"
        id="events-title"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Events', path: '/events' },
        ]}
        eyebrow="Events"
        eyebrowIcon={CalendarDays}
        title={EVENTS_TITLE}
        lead={EVENTS_LEAD}
        aside={<HeroStatSkeleton />}
      />
      <section className="pt-10 md:pt-12 lg:pt-14">
        <PageShell>
          <p className="font-display text-foreground text-h1 font-bold">Upcoming events</p>
          <p className="text-muted-foreground mt-2 text-[0.9375rem] sm:text-base">
            Explore our upcoming events and find the ones that interest you.
          </p>
          <UpcomingEventsSkeleton />
        </PageShell>
      </section>
    </div>
  );
}
