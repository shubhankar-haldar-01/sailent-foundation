import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Badge, Card, cn, formatDate } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { SailentEvent } from '@/lib/mock/types';

export function EventCard({ event, className }: { event: SailentEvent; className?: string }) {
  const isFull = event.capacity !== null && event.registeredCount >= event.capacity;
  const isPast = new Date(event.startsAt).getTime() < Date.now();

  return (
    <Card interactive className={cn('group relative flex flex-col overflow-hidden', className)}>
      <div className="relative">
        <MediaFrame media={event.cover} aspect="video" rounded={false} />

        {/* The torn-calendar date block from the design. It is presentational:
            the full, unambiguous date is in the <time> element below, which is
            what a screen reader and a search engine read. "15 MAR" alone omits
            the year and is read letter by letter. */}
        <p
          aria-hidden="true"
          className="bg-surface absolute left-3 top-3 rounded-lg px-2.5 py-1.5 text-center shadow-md"
        >
          <span
            data-numeric=""
            className="font-display text-h4 text-primary block font-bold tabular-nums leading-none"
          >
            {new Date(event.startsAt).toLocaleDateString('en-IN', { day: '2-digit' })}
          </span>
          <span className="text-caption text-muted-foreground block font-semibold uppercase">
            {new Date(event.startsAt).toLocaleDateString('en-IN', { month: 'short' })}
          </span>
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary flex items-center gap-1.5 uppercase">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time>
        </p>

        <h3 className="font-display text-h4 font-bold leading-snug">
          <Link
            href={`/events/${event.slug}`}
            className="hover:text-primary focus-visible:outline-ring line-clamp-2 rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {event.title}
          </Link>
        </h3>

        <p className="text-body-sm text-muted-foreground line-clamp-2">{event.summary}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <span className="text-caption text-muted-foreground flex items-center gap-1">
            <MapPin className="size-3" aria-hidden="true" />
            {event.isOnline ? 'Online' : (event.venueName ?? event.city ?? 'Venue to be confirmed')}
          </span>

          {/* Capacity is only worth showing where it constrains the decision. */}
          {!isPast && event.capacity !== null ? (
            <span className="text-caption text-muted-foreground flex items-center gap-1">
              <Users className="size-3" aria-hidden="true" />
              <span data-numeric="">
                {event.registeredCount}/{event.capacity}
              </span>
            </span>
          ) : null}

          {isPast ? (
            <Badge variant="neutral">Past event</Badge>
          ) : isFull ? (
            <Badge variant="warning">Waitlist only</Badge>
          ) : (
            <Badge variant="success">Registration open</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
