import Link from 'next/link';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import { cn } from '@sailent/ui';

import { CategoryIcon, categoryTone } from '@/components/home/category-icon';
import { MediaFrame } from '@/components/media/media-frame';
import type { SailentEvent } from '@/lib/mock/types';
import { dateBadge, timeRange } from './events-query';

interface MoreEventsStripProps {
  events: SailentEvent[];
  programsBySlug?: Record<string, { name: string; category: string | null }>;
}

export function MoreEventsStrip({ events, programsBySlug = {} }: MoreEventsStripProps) {
  if (!events || events.length === 0) return null;

  return (
    <section
      aria-labelledby="more-events-heading"
      className="border-border/80 bg-background/50 w-full border-t py-12 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            id="more-events-heading"
            className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
          >
            More Events You Might Like
          </h2>
          <Link
            href="/events"
            className="text-primary hover:text-primary group flex items-center gap-1.5 text-sm font-semibold transition-colors"
          >
            <span>View all events</span>
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* 3 Cards Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.slice(0, 3).map((item) => {
            const badge = dateBadge(item.startsAt);
            const prog = item.programSlug ? programsBySlug[item.programSlug] : null;
            const category = prog?.category || prog?.name || 'Community Support';
            const tone = categoryTone(category);

            return (
              <article
                key={item.id || item.slug}
                className="card-interactive group flex flex-col overflow-hidden rounded-2xl"
              >
                {/* Image + Date Badge */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <MediaFrame
                    media={{ ...item.cover, alt: item.title }}
                    aspect="video"
                    rounded={false}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  {/* Date badge */}
                  <div
                    aria-hidden="true"
                    className="backdrop-blur-xs bg-surface/95 absolute left-3 top-3 flex min-w-11 flex-col items-center rounded-lg px-2 py-1 text-center shadow-md"
                  >
                    <span
                      data-numeric=""
                      className="font-display text-primary text-lg font-extrabold leading-none"
                    >
                      {badge.day}
                    </span>
                    <span className="text-foreground mt-0.5 text-[0.625rem] font-bold uppercase leading-none tracking-wide">
                      {badge.month}
                    </span>
                    <span
                      data-numeric=""
                      className="text-muted-foreground mt-0.5 text-[0.625rem] font-semibold leading-tight"
                    >
                      {badge.year}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  {/* Category Pill */}
                  <div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold',
                        tone.chip || 'bg-info-subtle text-info',
                      )}
                    >
                      <CategoryIcon category={category} className="size-3" />
                      {category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-foreground group-hover:text-primary mt-2.5 line-clamp-2 text-base font-bold leading-snug transition-colors">
                    <Link href={`/events/${item.slug}`}>{item.title}</Link>
                  </h3>

                  {/* Meta items */}
                  <div className="text-muted-foreground mt-4 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {item.venueName || item.city || 'Venue to be confirmed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span data-numeric="">{timeRange(item.startsAt, item.endsAt)}</span>
                    </div>
                  </div>

                  {/* View Details Link */}
                  <div className="border-border mt-5 flex items-center justify-between border-t pt-3">
                    <Link
                      href={`/events/${item.slug}`}
                      className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline hover:underline-offset-4"
                    >
                      <span>View Details</span>
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
