import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, MapPin, Video } from 'lucide-react';

import { Badge, Button, Card, formatDate } from '@sailent/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { CancelRegistrationButton } from '@/components/events/cancel-registration-button';
import { donorFetch, type Paginated } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your events',
  path: '/dashboard/events',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

interface MyEvent {
  id: string;
  registrationId: string;
  status: 'registered' | 'confirmed' | 'attended' | 'no_show' | 'cancelled' | 'waitlisted';
  attendeeCount: number;
  title: string;
  slug: string;
  summary: string | null;
  startDate: string;
  endDate: string | null;
  venueName: string | null;
  city: string | null;
  isOnline: boolean;
  lifecycle: 'open' | 'closed' | 'full' | 'cancelled' | 'completed';
}

/**
 * The label on one registration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE EVENT'S STATE OUTRANKS THE REGISTRATION'S.
 *
 * Somebody whose registration still says `registered` for an event that was
 * cancelled last week is not registered for anything, and showing them a green
 * "Registered" badge would be the single most misleading thing on this page.
 * So cancellation of the EVENT is checked first, then the person's own status.
 * ══════════════════════════════════════════════════════════════════════════
 */
function label(entry: MyEvent): {
  text: string;
  variant: 'success' | 'neutral' | 'warning' | 'destructive';
} {
  if (entry.lifecycle === 'cancelled') return { text: 'Event cancelled', variant: 'destructive' };
  if (entry.status === 'cancelled') return { text: 'You cancelled', variant: 'neutral' };
  if (entry.status === 'attended') return { text: 'You attended', variant: 'success' };
  if (entry.status === 'no_show') return { text: 'Marked absent', variant: 'warning' };
  return { text: 'Registered', variant: 'success' };
}

/**
 * Events this donor has registered for.
 *
 * Upcoming and past are two lists rather than one sorted run: what somebody
 * wants from this page is almost always "what am I going to", and burying it
 * under three camps from last year answers a question nobody asked.
 *
 * CANCELLED REGISTRATIONS ARE SHOWN, labelled. Removing them silently leaves
 * somebody wondering whether their cancellation went through — which is exactly
 * the doubt that produces a phone call.
 */
export default async function MyEventsPage() {
  /*
    ONE REQUEST, SPLIT HERE — not `?when=upcoming` and `?when=past`.

    The API supports both filters and this page used them, which meant two
    round trips to render one screen. Nobody has hundreds of registrations, so
    the whole list fits in a single page of results and the split is a
    comparison against `now` that this component can do itself.

    It is also what stopped the e2e suite tripping the rate limiter: four
    viewport projects all reach the API from one address, so every avoidable
    request on a page the suite visits repeatedly counts four times over.
  */
  const all = await donorFetch<Paginated<MyEvent>>('me/events', { query: { limit: 100 } });

  const now = Date.now();
  const upcoming = all.items.filter((entry) => new Date(entry.startDate).getTime() >= now);
  // Most recent first, which is the opposite of the ascending order the API
  // returns — "what did I go to last" is the question a past list answers.
  const past = all.items.filter((entry) => new Date(entry.startDate).getTime() < now).reverse();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-bold">Your events</h1>
        <p className="text-body text-muted-foreground mt-2">
          Everything you have registered for, and everything you have been to.
        </p>
      </header>

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="When you register for an event it will appear here, with the details you need on the day."
          action={{ label: 'See what is coming up', href: '/events' }}
        />
      ) : null}

      {upcoming.length > 0 ? (
        <section aria-labelledby="upcoming-events">
          <h2 id="upcoming-events" className="text-h3 font-semibold">
            Coming up
          </h2>
          <ul className="mt-4 space-y-4">
            {upcoming.map((entry) => (
              <EventRow key={entry.registrationId} entry={entry} cancellable />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section aria-labelledby="past-events">
          <h2 id="past-events" className="text-h3 font-semibold">
            Been to
          </h2>
          <ul className="mt-4 space-y-4">
            {past.map((entry) => (
              <EventRow key={entry.registrationId} entry={entry} cancellable={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EventRow({ entry, cancellable }: { entry: MyEvent; cancellable: boolean }) {
  const badge = label(entry);
  const holdsPlace = entry.status !== 'cancelled' && entry.lifecycle !== 'cancelled';

  return (
    <li>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-h4 font-semibold leading-tight">
              <Link
                href={`/events/${entry.slug}`}
                className="focus-visible:outline-ring rounded-sm hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {entry.title}
              </Link>
            </h3>
            <p className="text-body-sm text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                <time dateTime={entry.startDate}>{formatDate(entry.startDate)}</time>
              </span>
              <span className="flex items-center gap-1.5">
                {entry.isOnline ? (
                  <Video className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {entry.isOnline
                  ? 'Online'
                  : [entry.venueName, entry.city].filter(Boolean).join(', ') ||
                    'Venue to be confirmed'}
              </span>
              {entry.attendeeCount > 1 ? (
                <span data-numeric="">{entry.attendeeCount} places</span>
              ) : null}
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.text}</Badge>
        </div>

        {/*
          Cancelling is offered only for a place somebody still holds at an
          event that is still happening. A past event's registration is a record
          of what happened, and the API refuses to change it once attendance is
          marked — offering a button that will be refused is worse than
          offering none.
        */}
        {cancellable && holdsPlace ? (
          <div className="border-border mt-4 border-t pt-4">
            <CancelRegistrationButton eventId={entry.id} slug={entry.slug} />
          </div>
        ) : null}

        {entry.lifecycle === 'cancelled' ? (
          <p className="text-body-sm text-muted-foreground mt-3">
            This event will not take place. Nothing is needed from you.
          </p>
        ) : null}

        {!holdsPlace && entry.status === 'cancelled' && entry.lifecycle !== 'cancelled' ? (
          <div className="border-border mt-4 border-t pt-4">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/events/${entry.slug}`}>Register again</Link>
            </Button>
          </div>
        ) : null}
      </Card>
    </li>
  );
}
