import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Users } from 'lucide-react';

import { Button, cn, formatDate } from '@sailent/ui';

import { CategoryIcon, categoryTone } from '@/components/home/category-icon';
import { MediaFrame } from '@/components/media/media-frame';
import type { SailentEvent } from '@/lib/mock/types';

import { cardAction, dateBadge, locationLabel, timeRange, type CardAction } from './events-query';

/** The programme an event belongs to, as the chip names it. */
export interface EventProgramme {
  name: string;
  /** The programme's area, for the chip's icon and colour; its name when it has none. */
  category: string | null;
}

/**
 * One upcoming event on /events, matched to the owner's design (2026-10-17).
 *
 * The photograph with its date block; the programme chip; the title, the
 * summary, where and when; and the one thing a visitor can do — "Register Now"
 * while there is a place, or why there is not — beside "View Details".
 *
 * The full card is clickable: hovering or clicking anywhere navigates to
 * the event's detail page.
 */
export function EventListingCard({
  event,
  programme,
  imagePriority = false,
  className,
}: {
  event: SailentEvent;
  programme?: EventProgramme | null;
  imagePriority?: boolean;
  className?: string;
}) {
  const action = cardAction(event);
  const badge = dateBadge(event.startsAt);
  const href = `/events/${event.slug}`;
  const tone = programme ? categoryTone(programme.category ?? programme.name) : null;

  return (
    <article
      className={cn(
        'card-interactive group/card relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl',
        className,
      )}
    >
      <div className="relative overflow-hidden">
        <MediaFrame
          media={{ ...event.cover, alt: '' }}
          aspect="video"
          rounded={false}
          {...(imagePriority ? { priority: true } : {})}
          className="duration-(--duration-slow) ease-(--ease-out-soft) aspect-[16/9] transition-transform motion-safe:group-hover/card:scale-[1.04]"
          sizes="(max-width: 47.99rem) 92vw, (max-width: 63.99rem) 46vw, 24rem"
        />

        <p
          aria-hidden="true"
          className="bg-surface absolute left-2.5 top-2.5 flex min-w-12 flex-col items-center rounded-lg px-2 py-1 text-center shadow-md"
        >
          <span
            data-numeric=""
            className="font-display text-cta-bright text-[1.375rem] font-extrabold tabular-nums leading-none"
          >
            {badge.day}
          </span>
          <span className="text-foreground mt-0.5 text-[0.625rem] font-bold uppercase leading-none tracking-wide">
            {badge.month}
          </span>
          <span
            data-numeric=""
            className="text-muted-foreground mt-0.5 text-[0.625rem] font-semibold tabular-nums leading-tight"
          >
            {badge.year}
          </span>
        </p>
      </div>

      <div className="sm:px-4.5 sm:pb-4.5 flex flex-1 flex-col px-4 pb-4 pt-3.5 sm:pt-3.5">
        {programme && tone ? (
          <p
            className={cn(
              'inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold leading-none',
              tone.chip,
            )}
          >
            <CategoryIcon category={programme.category ?? programme.name} className="size-3" />
            {programme.name}
          </p>
        ) : null}

        <h3
          className={cn(
            'font-display text-foreground text-base font-bold leading-snug tracking-[-0.01em] sm:text-[1.0625rem]',
            programme ? 'mt-2.5' : null,
          )}
        >
          <Link
            href={href}
            className="hover:text-primary-ink focus-visible:outline-ring line-clamp-2 rounded-sm transition-colors after:absolute after:inset-0 after:z-10 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {event.title}
          </Link>
        </h3>

        {event.summary ? (
          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed sm:text-[0.8125rem]">
            {event.summary}
          </p>
        ) : null}

        <dl className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-[0.78125rem]">
          <div className="sr-only">
            <dt>Date</dt>
            <dd>
              <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time>
            </dd>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <dt className="sr-only">Place</dt>
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <dd className="truncate">{locationLabel(event)}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="sr-only">Time</dt>
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <dd data-numeric="">{timeRange(event.startsAt, event.endsAt)}</dd>
          </div>
          {action.kind === 'register' && action.seatsLeft !== null ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Places</dt>
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              <dd data-numeric="">
                {action.seatsLeft === 1 ? '1 place left' : `${action.seatsLeft} places left`}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="relative z-20 mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3.5">
          <CardActionControl
            action={action}
            href={`/events/${event.slug}/register`}
            title={event.title}
          />
          <Link
            href={href}
            className="text-primary-ink group/details focus-visible:outline-ring inline-flex items-center gap-1 rounded-sm text-xs font-semibold hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-[0.8125rem]"
          >
            View Details
            <span className="sr-only"> of {event.title}</span>
            <ArrowRight
              className="duration-(--duration-base) size-3.5 transition-transform motion-safe:group-hover/details:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** A status the card states rather than offers — a clean centered pill, matching the reference design. */
const STATUS_PILL =
  'inline-flex h-9 items-center justify-center rounded-full px-4 text-xs sm:text-[0.8125rem] font-semibold leading-none';

/**
 * "Register Now" — or, when there is no place to be had, a quiet pill saying
 * why. Never an active button for an event the page and the API would refuse.
 *
 * The button goes to the event's registration page, which decides the rest:
 * whether this visitor already holds a place, and the sign-in it needs.
 */
function CardActionControl({
  action,
  href,
  title,
}: {
  action: CardAction;
  href: string;
  title: string;
}) {
  switch (action.kind) {
    case 'register':
      return (
        <Button
          asChild
          size="sm"
          className="group/register h-9 rounded-full px-4 text-xs font-bold sm:text-[0.8125rem]"
        >
          <Link href={href}>
            Register Now
            <span className="sr-only"> for {title}</span>
            <ArrowRight
              className="duration-(--duration-base) size-3.5 transition-transform motion-safe:group-hover/register:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </Button>
      );
    case 'full':
      return <p className={cn(STATUS_PILL, 'bg-wash-coral text-primary-ink')}>Fully booked</p>;
    case 'cancelled':
      return (
        <p className={cn(STATUS_PILL, 'bg-destructive-subtle text-destructive')}>Event cancelled</p>
      );
    default:
      return (
        <p className={cn(STATUS_PILL, 'bg-muted/80 text-muted-foreground')}>Registration closed</p>
      );
  }
}
