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
      className="w-full border-t border-slate-200/80 bg-slate-50/50 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            id="more-events-heading"
            className="font-display text-2xl font-bold tracking-tight text-[#102A43] sm:text-3xl"
          >
            More Events You Might Like
          </h2>
          <Link
            href="/events"
            className="group flex items-center gap-1.5 text-sm font-semibold text-[#EB6A1F] transition-colors hover:text-[#D45914]"
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
                className="shadow-xs group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 hover:shadow-md"
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
                    className="backdrop-blur-xs absolute left-3 top-3 flex min-w-11 flex-col items-center rounded-lg bg-white/95 px-2 py-1 text-center shadow-md"
                  >
                    <span
                      data-numeric=""
                      className="font-display text-lg font-extrabold leading-none text-[#EB6A1F]"
                    >
                      {badge.day}
                    </span>
                    <span className="mt-0.5 text-[0.625rem] font-bold uppercase leading-none tracking-wide text-slate-800">
                      {badge.month}
                    </span>
                    <span
                      data-numeric=""
                      className="mt-0.5 text-[0.625rem] font-semibold leading-tight text-slate-500"
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
                        tone.chip || 'bg-blue-50 text-blue-700',
                      )}
                    >
                      <CategoryIcon category={category} className="size-3" />
                      {category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display mt-2.5 line-clamp-2 text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-[#EB6A1F]">
                    <Link href={`/events/${item.slug}`}>{item.title}</Link>
                  </h3>

                  {/* Meta items */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">
                        {item.isOnline
                          ? 'Online'
                          : item.venueName || item.city || 'Venue to be confirmed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span data-numeric="">{timeRange(item.startsAt, item.endsAt)}</span>
                    </div>
                  </div>

                  {/* View Details Link */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                    <Link
                      href={`/events/${item.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#EB6A1F] hover:underline hover:underline-offset-4"
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
