import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, MapPin } from 'lucide-react';

import { Button, formatDate } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { SailentEvent } from '@/lib/mock/types';

import { cardAction, dateBadge, locationLabel, timeRange } from './events-query';

/**
 * The next event, told large — the Events page's lead instead of a banner.
 *
 * The hero of the page is the most useful thing on it: when and where the
 * next gathering is, and how to join it. The action follows the same rule as
 * every event card (`cardAction`, `AGENTS.md` §11 item 14): "Register" only
 * while registration is actually open; otherwise the event's page, which says
 * why not.
 */
export function NextEventFeature({ event }: { event: SailentEvent }) {
  const action = cardAction(event);
  const badge = dateBadge(event.startsAt);
  const href = `/events/${event.slug}`;

  return (
    <article
      aria-labelledby="next-event-title"
      className="border-border bg-surface shadow-xs grid overflow-hidden rounded-3xl border lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <div className="relative">
        <MediaFrame
          media={{ ...event.cover, alt: '' }}
          aspect="video"
          rounded={false}
          priority
          className="aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[20rem]"
          sizes="(max-width: 1024px) 100vw, 640px"
        />
        <p
          aria-hidden="true"
          className="bg-surface absolute left-4 top-4 flex min-w-14 flex-col items-center rounded-xl px-2.5 py-1.5 text-center shadow-md"
        >
          <span
            data-numeric=""
            className="font-display text-primary text-2xl font-extrabold tabular-nums leading-none"
          >
            {badge.day}
          </span>
          <span className="text-foreground mt-1 text-[0.6875rem] font-bold uppercase leading-none tracking-wide">
            {badge.month}
          </span>
        </p>
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
        <p className="bg-accent text-primary inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          Next event
        </p>
        <h2
          id="next-event-title"
          className="font-display text-h2 text-foreground mt-3 text-balance font-semibold leading-tight"
        >
          {event.title}
        </h2>

        <dl className="text-muted-foreground-strong mt-4 grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Date</dt>
            <CalendarDays aria-hidden="true" className="text-primary size-4 shrink-0" />
            <dd>
              <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Time</dt>
            <Clock aria-hidden="true" className="text-primary size-4 shrink-0" />
            <dd>{timeRange(event.startsAt, event.endsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Place</dt>
            <MapPin aria-hidden="true" className="text-primary size-4 shrink-0" />
            <dd>{event.isOnline ? 'Online' : locationLabel(event)}</dd>
          </div>
        </dl>

        {event.summary ? (
          <p className="text-body-sm text-muted-foreground mt-4 line-clamp-3 leading-relaxed">
            {event.summary}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {action.kind === 'register' ? (
            <Button asChild>
              <Link href={`${href}/register`}>
                Register
                <span className="sr-only">: {event.title}</span>
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={href}>
              View details
              <span className="sr-only">: {event.title}</span>
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
          {action.kind === 'register' && action.seatsLeft !== null ? (
            <span className="text-muted-foreground text-sm">
              {action.seatsLeft === 1 ? '1 place left' : `${action.seatsLeft} places left`}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
