import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn, formatDate } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHead } from '@/components/home/section-head';
import type { SailentEvent, Story } from '@/lib/mock/types';

/**
 * A story card: a tall crop on the left, the story on the right.
 *
 * The crop stays a narrow upright strip at every width rather than becoming a
 * banner on a phone — a face reads at 64px wide, and the horizontal form is
 * what lets three of these share a row without the band running to a full
 * screen.
 */
function StoryCard({ story }: { story: Story }) {
  return (
    <article className="border-border bg-surface hover-lift group relative flex gap-3 overflow-hidden rounded-xl border p-2.5 shadow-sm hover:shadow-md">
      {/*
        `self-stretch` + `aspect-auto`: the crop fills the card's height rather
        than setting it, so three cards in a row stay level however many lines
        each title takes.

        WIDER than it looks like it needs to be. The frame is upright and the
        supplied photographs are landscape, so `object-cover` keeps only a
        vertical slice of each one — at 104px that was half the width and cut
        into the faces. Every 16px here is another 8% of the picture kept.
      */}
      <div className="w-[7.5rem] shrink-0 self-stretch overflow-hidden rounded-lg">
        <MediaFrame
          media={story.cover}
          aspect="portrait"
          rounded={false}
          // A narrow upright crop beside the text, never a third of the page.
          sizes="(max-width: 640px) 34vw, 128px"
          className="hover-zoom aspect-auto size-full group-hover:scale-[1.04] motion-reduce:scale-100"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-caption text-balance font-bold leading-snug">
          <Link
            href={`/stories/${story.slug}`}
            className="hover:text-info-action focus-visible:outline-ring rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {story.title}
          </Link>
        </h3>
        <p className="text-caption text-muted-foreground mt-1 line-clamp-5 leading-snug">
          {story.summary}
        </p>
        <p className="text-caption text-primary mt-auto inline-flex items-center gap-1 pt-2 font-semibold">
          Read Story
          <ArrowRight className="size-3" aria-hidden="true" />
        </p>
      </div>
    </article>
  );
}

function EventRow({ event }: { event: SailentEvent }) {
  const date = new Date(event.startsAt);

  return (
    <li className="border-border bg-surface hover-lift relative flex items-center gap-3 rounded-xl border p-2 shadow-sm hover:shadow-md">
      {/* Presentational: the full, unambiguous date is in the <time> below. */}
      <p
        aria-hidden="true"
        className="bg-wash-amber text-foreground grid size-10 shrink-0 place-content-center rounded-lg text-center"
      >
        <span data-numeric="" className="text-body block font-extrabold tabular-nums leading-none">
          {date.toLocaleDateString('en-IN', { day: '2-digit' })}
        </span>
        <span className="text-caption mt-0.5 block font-bold uppercase leading-none">
          {date.toLocaleDateString('en-IN', { month: 'short' })}
        </span>
      </p>

      <div className="min-w-0 flex-1">
        <h3 className="text-body-sm font-bold leading-snug">
          <Link
            href={`/events/${event.slug}`}
            className="hover:text-info-action focus-visible:outline-ring rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {event.title}
          </Link>
        </h3>
        <p className="text-caption text-muted-foreground mt-0.5 truncate">
          {event.isOnline
            ? 'Online Event'
            : (event.venueName ?? event.city ?? 'Venue to be confirmed')}
        </p>
        <time dateTime={event.startsAt} className="sr-only">
          {formatDate(event.startsAt)}
        </time>
      </div>

      <span className="text-caption text-info-action hidden shrink-0 items-center gap-1 font-semibold sm:inline-flex">
        Register
        <ArrowRight className="size-3" aria-hidden="true" />
      </span>
    </li>
  );
}

/**
 * Stories and events, side by side.
 *
 * They share a row because they answer the same question from two angles —
 * "what has this changed" and "what can I turn up to" — and because neither
 * justifies a full band of its own. Stacked below `lg`, stories first: a
 * first-time visitor is more likely to be moved by a person than by a date.
 */
export function StoriesAndEvents({
  stories,
  events,
  className,
}: {
  stories: Story[];
  events: SailentEvent[];
  className?: string;
}) {
  if (stories.length === 0 && events.length === 0) return null;

  return (
    <section className={cn('bg-surface border-border border-b', className)}>
      <PageShell className="band-y">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-8">
          {stories.length > 0 ? (
            <div className="flex flex-col lg:col-span-8">
              <SectionHead
                id="stories-title"
                title="Stories of Change"
                viewAll={{ href: '/stories', label: 'View All Stories' }}
              />
              {/*
                Three across from `sm` up — the cards are horizontal, so they
                stay legible at a third of the column in a way a vertical card
                would not.
              */}
              <ul className="mt-5 grid flex-1 gap-3 sm:grid-cols-3">
                {stories.map((story) => (
                  <li key={story.slug} className="flex h-full">
                    <StoryCard story={story} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {events.length > 0 ? (
            <div className="lg:col-span-4">
              <SectionHead
                id="events-title"
                title="Upcoming Events"
                viewAll={{ href: '/events', label: 'View All Events' }}
              />
              <ul className="mt-5 space-y-2">
                {events.map((event) => (
                  <EventRow key={event.slug} event={event} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </PageShell>
    </section>
  );
}
