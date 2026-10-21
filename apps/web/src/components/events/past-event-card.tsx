import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';

import { cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { SailentEvent } from '@/lib/mock/types';

import { dayLabel } from './events-query';

/**
 * One event that has already happened, as the compact row the owner's design
 * (2026-10-17) draws under "Past events": the photograph on the left, then the
 * title, the date and a link to the event's page.
 *
 * The link reads "View Details", not the design's "View highlights": the
 * listing does not know whether an event has a gallery or a report, and a
 * promise of highlights over a page with none would be a broken one. The
 * event's own page shows its photographs when it has them.
 *
 * A cancelled event says so beside its date, as the event page does.
 */
export function PastEventCard({ event, className }: { event: SailentEvent; className?: string }) {
  const href = `/events/${event.slug}`;

  return (
    <article
      className={cn(
        'card-interactive group/past-card relative flex h-full cursor-pointer items-center gap-4 rounded-2xl p-3 sm:p-3.5',
        className,
      )}
    >
      <MediaFrame
        media={{ ...event.cover, alt: '' }}
        aspect="photo"
        rounded={false}
        className="w-[38%] max-w-[9.5rem] shrink-0 rounded-xl"
        sizes="(max-width: 47.99rem) 38vw, 9.5rem"
      />

      <div className="min-w-0 py-1">
        <h3 className="font-display text-foreground text-[0.9375rem] font-bold leading-snug">
          <Link
            href={href}
            className="hover:text-primary-ink focus-visible:outline-ring line-clamp-2 rounded-sm transition-colors after:absolute after:inset-0 after:z-10 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {event.title}
          </Link>
        </h3>

        <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.8125rem]">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          <time dateTime={event.startsAt}>{dayLabel(event.startsAt)}</time>
          {event.lifecycle === 'cancelled' ? (
            <span className="text-destructive font-semibold">· Cancelled</span>
          ) : null}
        </p>

        <Link
          href={href}
          className="text-primary-ink group/past focus-visible:outline-ring relative z-20 mt-2 inline-flex items-center gap-1 rounded-sm text-[0.8125rem] font-semibold hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          View Details
          <span className="sr-only"> of {event.title}</span>
          <ArrowRight
            className="duration-(--duration-base) size-3.5 transition-transform motion-safe:group-hover/past:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}
