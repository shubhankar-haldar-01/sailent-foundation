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
    <article className="card-interactive group relative flex h-full w-full flex-col rounded-[22px] p-3.5 sm:p-4">
      {/* Photograph on top: rounded with card inset */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-[16px] bg-slate-100 dark:bg-slate-800">
        <MediaFrame
          media={story.cover}
          aspect="video"
          rounded={false}
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 260px"
          className="hover-zoom size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:scale-100"
        />
      </div>

      <div className="flex flex-1 flex-col pt-3.5">
        <h3 className="font-display text-base font-bold leading-snug tracking-tight text-[#0F172A] sm:text-[1.0625rem] dark:text-white">
          <Link
            href={`/stories/${story.slug}`}
            className="focus-visible:outline-ring hover:text-primary rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {story.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#64748B] sm:text-[13px] dark:text-slate-400">
          {story.summary}
        </p>
        <p className="text-primary mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-bold sm:text-[13px]">
          Read Story
          <ArrowRight
            className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </p>
      </div>
    </article>
  );
}

function EventRow({ event }: { event: SailentEvent }) {
  const date = new Date(event.startsAt);
  const day = date.toLocaleDateString('en-IN', { day: '2-digit' });
  const month = date.toLocaleDateString('en-IN', { month: 'short' });

  return (
    <li className="card-interactive group relative flex items-center justify-between gap-3.5 rounded-[20px] p-3.5 sm:p-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {/* Date badge on left */}
        <p
          aria-hidden="true"
          className="sm:size-15 flex size-14 shrink-0 flex-col items-center justify-center rounded-[16px] border border-[#FFEDD5] bg-[#FFF7ED] text-center dark:border-amber-900/40 dark:bg-amber-950/30"
        >
          <span
            data-numeric=""
            className="block text-lg font-black tabular-nums leading-none text-[#0F172A] sm:text-xl dark:text-white"
          >
            {day}
          </span>
          <span className="mt-1 block text-[10px] font-extrabold uppercase leading-none tracking-wider text-[#475569] sm:text-[11px] dark:text-amber-300">
            {month}
          </span>
        </p>

        {/* Event info */}
        <div className="min-w-0">
          <h3 className="font-display line-clamp-1 text-sm font-bold leading-snug tracking-tight text-[#0F172A] sm:text-[15px] dark:text-white">
            <Link
              href={`/events/${event.slug}`}
              className="hover:text-info-action focus-visible:outline-ring rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {event.title}
            </Link>
          </h3>
          <p className="mt-1 truncate text-xs text-[#64748B] sm:text-[13px] dark:text-slate-400">
            {event.isOnline
              ? 'Online Event'
              : (event.venueName ?? event.city ?? 'Venue to be confirmed')}
          </p>
          <time dateTime={event.startsAt} className="sr-only">
            {formatDate(event.startsAt)}
          </time>
        </div>
      </div>

      {/* Register link on right */}
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#2563EB] sm:text-sm dark:text-blue-400">
        Register
        <ArrowRight
          className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </span>
    </li>
  );
}

/**
 * Stories and events, side by side.
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
    <section className={cn('bg-background border-border border-b', className)}>
      <PageShell className="band-y">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          {stories.length > 0 ? (
            <div className="flex flex-col lg:col-span-8">
              <SectionHead
                id="stories-title"
                title="Stories of Change"
                viewAll={{ href: '/stories', label: 'View All Stories' }}
              />
              <ul className="mt-6 grid flex-1 gap-4 sm:grid-cols-3">
                {stories.map((story) => (
                  <li key={story.slug} className="flex h-full">
                    <StoryCard story={story} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {events.length > 0 ? (
            <div className="flex flex-col lg:col-span-4">
              <SectionHead
                id="events-title"
                title="Upcoming Events"
                viewAll={{ href: '/events', label: 'View All Events' }}
              />
              <ul className="mt-6 space-y-3.5">
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
