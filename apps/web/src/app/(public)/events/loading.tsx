import { PageShell } from '@/components/layout/page-shell';
import { EventsHero } from '@/components/events/events-hero';
import { UpcomingEventsSkeleton } from '@/components/events/events-skeletons';

/**
 * The page as it will look, with the cards still to come: the banner and the
 * section heading are static, so they are the real ones, and only the area
 * that waits on the API is drawn as a skeleton — nothing jumps when the page
 * arrives.
 */
export default function Loading() {
  return (
    <div className="pb-14 md:pb-20">
      <EventsHero />
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
