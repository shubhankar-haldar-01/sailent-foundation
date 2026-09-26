import type { Metadata } from 'next';
import { EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { EventCard } from '@/components/events/event-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { getEvents } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Events',
  description:
    'Field days, distribution drives, medical camps, volunteer orientations and our open annual review.',
  path: '/events',
});

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([getEvents('upcoming'), getEvents('past')]);

  return (
    <>
      <PageHero
        eyebrow="Events"
        title="Come and see the work"
        lead="Distribution days, medical camps, volunteer orientations, and an annual review that anyone can attend and ask questions at."
      />
      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Events', path: '/events' },
            ]}
          />

          <h2 className="text-h1 font-semibold">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState
              kind="no-content"
              title="No events scheduled just now"
              description="We publish field days and open sessions a few weeks ahead. Past events are listed below."
              className="mt-6"
            />
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => (
                <EventCard key={event.slug} event={event} />
              ))}
            </div>
          )}
        </PageShell>
      </Section>

      {past.length > 0 ? (
        <Section className="border-border bg-surface-sunken border-t">
          <PageShell>
            <h2 className="text-h1 font-semibold">Past events</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {past.map((event) => (
                <EventCard key={event.slug} event={event} />
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}
    </>
  );
}
