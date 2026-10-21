import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { AlertCircle, ArrowRight, SearchX } from 'lucide-react';

import { Button, EmptyState } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { EventListingCard, type EventProgramme } from '@/components/events/event-listing-card';
import { EventToolbar } from '@/components/events/event-toolbar';
import { EventsCta } from '@/components/events/events-cta';
import { EventsHero } from '@/components/events/events-hero';
import {
  eventMonthOptions,
  eventsHref,
  eventsView,
  monthLabel,
  parseEventsQuery,
  type EventsQuery,
  type EventsView,
} from '@/components/events/events-query';
import { UpcomingEventsSkeleton } from '@/components/events/events-skeletons';
import { PastEventCard } from '@/components/events/past-event-card';
import { ViewMoreEvents } from '@/components/events/view-more-events';
import { buildMetadata } from '@/lib/seo/metadata';
import { getEvents, getPrograms } from '@/lib/content';
import type { Program, SailentEvent } from '@/lib/mock/types';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** How many past events show before "View all past events" — the design's one row of three. */
const PAST_PREVIEW = 3;

const DESCRIPTION =
  'Field days, distribution drives, medical camps, volunteer orientations and our open annual review.';

/**
 * One canonical URL for every filtered view, so a month or a page count is
 * never indexed as a page of its own; a free-text SEARCH is kept out of the
 * index altogether — it is whatever somebody typed, not a page anybody wrote.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = parseEventsQuery(await searchParams);
  return buildMetadata({
    title: 'Events',
    description: DESCRIPTION,
    path: '/events',
    noIndex: q !== null,
  });
}

/**
 * The events page (the owner's design, 2026-10-17, with the panoramic banner):
 * "Upcoming events" with its search, date menu, cards and "View More Events",
 * the "Want to get involved?" panel, and the latest past events.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERYTHING ON IT IS LIVE DATA. The events, their dates, places, places left
 * and registration states come from the API; the date menu's months are the
 * months those events fall in; a card's chip is the programme the event is
 * filed under. Nothing is invented to fill the design's slots — an event with
 * no programme has no chip, and the page with no past events has no past
 * section.
 *
 * The search, the month, the page count and the past-events toggle live in
 * the URL (`events-query.ts`), so every state is server-rendered, shareable
 * and back-button-safe.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The banner and the headings render at once. The cards wait on the API
 * inside Suspense boundaries, shown as a skeleton on the first arrival only;
 * after that a new search, month or page keeps the cards on screen, dimmed,
 * until the new ones replace them.
 */
export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseEventsQuery(await searchParams);

  return (
    <div className="pb-14 md:pb-20">
      <EventsHero />

      <section aria-labelledby="upcoming-events-title" className="pt-10 md:pt-12 lg:pt-14">
        <PageShell>
          <h2 id="upcoming-events-title" className="font-display text-foreground text-h1 font-bold">
            Upcoming events
          </h2>
          <p className="text-muted-foreground mt-2 text-[0.9375rem] sm:text-base">
            Explore our upcoming events and find the ones that interest you.
          </p>

          {/*
            NOT keyed on the query: a search, a month or "View More" is a
            navigation in a transition, and an unkeyed boundary that is already
            showing keeps its content until the new results arrive.
          */}
          <Suspense fallback={<UpcomingEventsSkeleton />}>
            <UpcomingEvents query={query} />
          </Suspense>
        </PageShell>
      </section>

      <EventsCta />

      <Suspense fallback={null}>
        <PastEvents query={query} />
      </Suspense>
    </div>
  );
}

/**
 * Catch a failed read and return `fallback` — but let Next.js's own control
 * flow (dynamic rendering bail-outs, redirects, not-found) through untouched.
 */
function failSoft<T>(fallback: T) {
  return (error: unknown): T => {
    unstable_rethrow(error);
    console.error('[events] listing failed to load:', error);
    return fallback;
  };
}

/** The programme each event is filed under, for the cards' chips and the search. */
function programmeLookup(programmes: Program[]) {
  const bySlug = new Map<string, EventProgramme>(
    programmes.map((programme) => [
      programme.slug,
      { name: programme.name, category: programme.category ?? null },
    ]),
  );
  return (event: SailentEvent): EventProgramme | null =>
    event.programSlug ? (bySlug.get(event.programSlug) ?? null) : null;
}

async function UpcomingEvents({ query }: { query: EventsQuery }) {
  const [upcoming, programmes] = await Promise.all([
    getEvents('upcoming').catch(failSoft<SailentEvent[] | null>(null)),
    // Without the programmes the cards simply have no chips.
    getPrograms().catch(failSoft<Program[]>([])),
  ]);

  if (upcoming === null) return <LoadError retryHref={eventsHref(query)} />;

  if (upcoming.length === 0) {
    return (
      <EmptyState
        kind="no-content"
        title="No events scheduled just now"
        description="We publish field days and open sessions a few weeks ahead."
        className="mt-6"
      />
    );
  }

  const programmeOf = programmeLookup(programmes);
  const view = eventsView(upcoming, query, (event) => programmeOf(event)?.name ?? null);
  const clearHref = eventsHref({ allPast: query.allPast });

  return (
    // `group/events`: while the toolbar's or "View More"'s navigation is pending, the cards dim.
    <div className="group/events">
      <EventToolbar
        query={query}
        activeDate={view.activeDate}
        months={eventMonthOptions(upcoming)}
        className="mt-6"
      />

      <div className="duration-(--duration-base) transition-opacity group-has-[[data-pending]]/events:opacity-50">
        {/*
          What is on screen, said in words. Visible only once somebody has
          narrowed the list, but always in the DOM for assistive technology.
        */}
        <p
          role="status"
          className={view.filtered ? 'text-muted-foreground mt-5 text-sm' : 'sr-only'}
        >
          {resultSummary(view, query)}
          {view.filtered ? (
            <>
              {' '}
              <Link
                href={clearHref}
                scroll={false}
                className="text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Clear filters
              </Link>
            </>
          ) : null}
        </p>

        {view.visible.length === 0 ? (
          <NoMatches clearHref={clearHref} />
        ) : (
          <ul
            aria-label="Upcoming events"
            className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {view.visible.map((event, index) => (
              <li key={event.slug} className="flex">
                <EventListingCard
                  event={event}
                  programme={programmeOf(event)}
                  imagePriority={index === 0}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        )}

        {view.hasMore ? (
          <ViewMoreEvents
            href={eventsHref({
              q: query.q,
              date: view.activeDate,
              page: view.page + 1,
              allPast: query.allPast,
            })}
          />
        ) : null}
      </div>
    </div>
  );
}

function resultSummary(view: EventsView, query: EventsQuery): string {
  const shown = view.visible.length;
  const total = view.matching.length;
  const noun = total === 1 ? 'upcoming event' : 'upcoming events';
  const scope = [
    query.q ? ` matching “${query.q}”` : '',
    view.activeDate ? ` in ${monthLabel(view.activeDate)}` : '',
  ].join('');

  return shown < total
    ? `Showing ${shown} of ${total} ${noun}${scope}.`
    : `${total} ${noun}${scope}.`;
}

/** The search and the month in force match nothing — which says so, and offers the way back. */
function NoMatches({ clearHref }: { clearHref: string }) {
  return (
    <div className="border-border bg-surface mt-6 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="bg-wash-coral text-cta-glow grid size-12 place-items-center rounded-full">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <p className="font-display text-h4 mt-4 font-bold">No events match your search</p>
      <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
        Try another word or another date, or clear the filters to see every upcoming event.
      </p>
      <Button asChild variant="secondary" className="mt-5 font-bold">
        <Link href={clearHref} scroll={false}>
          View all upcoming events
        </Link>
      </Button>
    </div>
  );
}

/**
 * The API could not be reached. Inline, under a banner that still reads, and
 * the retry is a plain link that reloads this same listing.
 */
function LoadError({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive-subtle mt-6 flex flex-col items-center rounded-2xl border px-6 py-14 text-center"
    >
      <AlertCircle className="text-destructive size-8" aria-hidden="true" />
      <p className="font-display text-h4 mt-3 font-bold">Unable to load events</p>
      <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
        We couldn&apos;t load the events right now. Please try again.
      </p>
      <Button asChild variant="secondary" className="mt-5 font-bold">
        <a href={retryHref}>Try again</a>
      </Button>
    </div>
  );
}

/**
 * The latest past events: one row of three, and every one of them a click
 * away — "View all past events" lists them all here, in the same section,
 * without leaving the page or losing the upcoming filters.
 *
 * Left out when there are none, or when they cannot be loaded: an empty
 * "Past events" heading is an apology the page does not need to make.
 */
async function PastEvents({ query }: { query: EventsQuery }) {
  const past = await getEvents('past').catch(failSoft<SailentEvent[]>([]));
  if (past.length === 0) return null;

  const shown = query.allPast ? past : past.slice(0, PAST_PREVIEW);
  const hasMore = past.length > PAST_PREVIEW;

  return (
    <section
      id="past-events"
      aria-labelledby="past-events-title"
      className="mt-12 scroll-mt-24 md:mt-14"
    >
      <PageShell>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2
              id="past-events-title"
              className="font-display text-foreground text-2xl font-bold tracking-[-0.01em] sm:text-[1.75rem]"
            >
              Past events
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Take a look at some of our recent events.
            </p>
          </div>

          {hasMore ? (
            <Link
              href={eventsHref({ ...query, allPast: !query.allPast })}
              scroll={false}
              className="text-primary-ink group/all focus-visible:outline-ring inline-flex items-center gap-1 rounded-sm text-sm font-semibold hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {query.allPast ? 'Show fewer past events' : 'View all past events'}
              <ArrowRight
                className="duration-(--duration-base) size-4 transition-transform motion-safe:group-hover/all:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ) : null}
        </div>

        <ul
          aria-label="Past events"
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {shown.map((event) => (
            <li key={event.slug} className="flex">
              <PastEventCard event={event} className="w-full" />
            </li>
          ))}
        </ul>
      </PageShell>
    </section>
  );
}
