import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { Badge, Button, Card } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFrame, MediaFigure } from '@/components/media/media-frame';
import { EventRegistrationPanel } from '@/components/events/event-registration-panel';
import { buildMetadata } from '@/lib/seo/metadata';
import { jsonLd } from '@/lib/seo/structured-data';
import { getCampaign, getEvent, getEvents, getProgram } from '@/lib/content';

export async function generateStaticParams() {
  const events = [...(await getEvents('upcoming')), ...(await getEvents('past'))];
  return events.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const event = await getEvent((await params).slug);
  if (!event) return buildMetadata({ title: 'Event not found', path: '/events', noIndex: true });
  return buildMetadata({
    title: event.title,
    description: event.summary,
    path: `/events/${event.slug}`,
  });
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEvent((await params).slug);
  if (!event) notFound();

  const [program, campaign] = await Promise.all([
    event.programSlug ? getProgram(event.programSlug) : Promise.resolve(null),
    event.campaignSlug ? getCampaign(event.campaignSlug) : Promise.resolve(null),
  ]);

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeZone: 'Asia/Kolkata',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  /**
   * Event structured data. `eventAttendanceMode` and `location` reflect what is
   * actually true; no `offers` block is emitted because attendance is free and
   * claiming a price would be misleading markup.
   */
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.summary,
    startDate: event.startsAt,
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    eventStatus: `https://schema.org/Event${event.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}`,
    eventAttendanceMode: event.isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: event.isOnline
      ? { '@type': 'VirtualLocation', url: 'https://sailentfoundation.org/events' }
      : {
          '@type': 'Place',
          name: event.venueName ?? 'Venue to be confirmed',
          address: event.address ?? event.city ?? 'India',
        },
    organizer: { '@type': 'NGO', name: 'Sailent Foundation' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(eventSchema)} />

      <PageShell className="pt-8">
        <Breadcrumbs
          entries={[
            { name: 'Home', path: '/' },
            { name: 'Events', path: '/events' },
            { name: event.title, path: `/events/${event.slug}` },
          ]}
        />
      </PageShell>

      <PageShell>
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div className="min-w-0">
            <MediaFrame media={event.cover} aspect="hero" priority />

            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2">
                {/*
                  Driven by `event.status`, which the content loader already
                  derives from the lifecycle and the date together.

                  It used to read "Waitlist only" when an event was full. There
                  is no waitlist — Phase 9 implements none — so the badge was
                  promising a queue that does not exist to precisely the people
                  who could not get a place.
                */}
                {event.status === 'cancelled' ? (
                  <Badge variant="destructive">Cancelled</Badge>
                ) : event.status === 'completed' ? (
                  <Badge variant="neutral">Past event</Badge>
                ) : event.status === 'registration_open' ? (
                  <Badge variant="success">Registration open</Badge>
                ) : (
                  <Badge variant="warning">Registration closed</Badge>
                )}
                {program ? (
                  <Link
                    href={`/programs/${program.slug}`}
                    className="text-overline tracking-(--text-overline--letter-spacing) text-primary focus-visible:outline-ring rounded-sm uppercase underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {program.name}
                  </Link>
                ) : null}
              </div>

              <h1 className="text-display mt-3 text-balance font-semibold">{event.title}</h1>
              <p className="text-body-lg text-muted-foreground mt-4 max-w-prose">{event.summary}</p>
            </div>

            <div className="prose-measure mt-8 space-y-4">
              {event.description.map((paragraph, index) => (
                <p key={index} className="text-body text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {event.schedule.length > 0 ? (
              <section className="mt-10">
                <h2 className="text-h2 font-semibold">Schedule</h2>
                <ol className="prose-measure divide-border border-border mt-4 divide-y border-y">
                  {event.schedule.map((item) => (
                    <li key={item.time} className="flex gap-4 py-3">
                      <span
                        data-numeric=""
                        className="text-body-sm w-24 shrink-0 font-medium tabular-nums"
                      >
                        {item.time}
                      </span>
                      <span className="text-body-sm text-muted-foreground">{item.activity}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {event.gallery.length > 0 ? (
              <section className="mt-10">
                <h2 className="text-h2 font-semibold">From this event</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {event.gallery.map((media) => (
                    <MediaFigure key={media.seed} media={media} aspect="photo" />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-6 lg:sticky lg:top-24">
            <Card className="p-5">
              <h2 className="text-h4 font-semibold">Details</h2>
              <dl className="text-body-sm mt-4 space-y-3">
                <div className="flex gap-3">
                  <dt className="sr-only">Date</dt>
                  <CalendarDays
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <dd>
                    <time dateTime={event.startsAt}>
                      {dateFormatter.format(new Date(event.startsAt))}
                    </time>
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="sr-only">Time</dt>
                  <Clock
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <dd data-numeric="">
                    {timeFormatter.format(new Date(event.startsAt))}
                    {event.endsAt ? ` – ${timeFormatter.format(new Date(event.endsAt))}` : ''}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="sr-only">Location</dt>
                  <MapPin
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <dd>
                    {event.isOnline
                      ? 'Online — joining link sent to registrants'
                      : (event.address ?? 'Venue to be confirmed')}
                  </dd>
                </div>
                {event.capacity !== null ? (
                  <div className="flex gap-3">
                    <dt className="sr-only">Capacity</dt>
                    <Users
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <dd data-numeric="">
                      {event.registeredCount} of {event.capacity} places taken
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Card>

            {/*
              One component decides all of it — past, cancelled, full, closed,
              signed out, already registered — because those states are mutually
              exclusive and deciding them in one place is what stops a page
              showing "register" over a cancelled event.
            */}
            <EventRegistrationPanel event={event} />

            {campaign ? (
              <Card className="p-5">
                <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
                  Related campaign
                </p>
                <h2 className="text-body mt-2 font-semibold">{campaign.title}</h2>
                <Button asChild variant="secondary" fullWidth className="mt-3">
                  <Link href={`/campaigns/${campaign.slug}`}>View campaign</Link>
                </Button>
              </Card>
            ) : null}
          </div>
        </div>
      </PageShell>
    </>
  );
}
