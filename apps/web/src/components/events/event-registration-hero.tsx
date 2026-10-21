import Link from 'next/link';
import { Calendar, ChevronRight, Clock, MapPin } from 'lucide-react';

import { MediaFrame } from '@/components/media/media-frame';
import type { SailentEvent } from '@/lib/mock/types';

/**
 * Splits an event title into two parts for the signature editorial two-tone look:
 * the first part in deep navy and the closing part in brand orange (#EB6A1F).
 */
function splitTitle(title: string): { first: string; second: string } {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return { first: title, second: '' };
  if (words.length === 2) return { first: words[0] ?? '', second: words[1] ?? '' };
  const splitIndex = Math.ceil(words.length / 2);
  return {
    first: words.slice(0, splitIndex).join(' '),
    second: words.slice(splitIndex).join(' '),
  };
}

/** Formats duration between startsAt and endsAt in hours. */
function formatDuration(startsAt: string, endsAt?: string | null): string | null {
  if (!endsAt) return null;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const diffHours = (end - start) / (1000 * 60 * 60);
  if (diffHours <= 0) return null;
  const formatted = diffHours % 1 === 0 ? diffHours.toFixed(0) : diffHours.toFixed(1);
  return `(${formatted} ${diffHours === 1 ? 'hour' : 'hours'})`;
}

interface EventRegistrationHeroProps {
  event: SailentEvent;
  /** The programme's area; an event without a programme shows none. */
  categoryName?: string | null;
  isRegistrationPage?: boolean;
}

export function EventRegistrationHero({ event, categoryName = null }: EventRegistrationHeroProps) {
  const { first, second } = splitTitle(event.title);

  const startDate = new Date(event.startsAt);
  const dayName = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(startDate);
  const dateStr = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(startDate);

  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  const startTime = timeFormatter.format(startDate);
  const endTime = event.endsAt ? timeFormatter.format(new Date(event.endsAt)) : null;
  const timeStr = endTime ? `${startTime} – ${endTime}` : startTime;
  const duration = formatDuration(event.startsAt, event.endsAt);

  const venue = event.isOnline
    ? 'Online Event'
    : event.venueName || event.address || 'Venue to be confirmed';
  const locationSub = event.isOnline ? 'Joining link sent via email' : event.city || 'India';

  return (
    <section className="relative w-full overflow-hidden border-b border-slate-200/80 bg-[#F0F6FB]">
      {/* Right Column: Hero Image with curved left edge flush to window edges on lg+ (no shadow, clean flat cut) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden overflow-hidden lg:block lg:w-[50%] xl:w-[52%]"
        style={{
          borderTopLeftRadius: '280px 50%',
          borderBottomLeftRadius: '280px 50%',
        }}
      >
        <MediaFrame
          media={event.cover}
          aspect="hero"
          priority
          rounded={false}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-8 sm:py-10 lg:w-[48%] lg:py-14 xl:w-[48%]">
          {/* Breadcrumb matching exact design: Home > Events > [Title] > Register */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <li>
                <Link href="/" className="hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-400">
                <ChevronRight className="size-3" />
              </li>
              <li>
                <Link href="/events" className="hover:text-primary transition-colors">
                  Events
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-400">
                <ChevronRight className="size-3" />
              </li>
              <li
                aria-current="page"
                className="max-w-[180px] truncate font-semibold text-slate-800 sm:max-w-xs"
              >
                {event.title}
              </li>
            </ol>
          </nav>

          {/* Clean Green Category Pill without icon */}
          {categoryName ? (
            <div className="mb-3 sm:mb-4">
              <span className="inline-flex items-center rounded-full bg-[#D4F4DF] px-3.5 py-1 text-xs font-semibold tracking-wide text-[#166534]">
                {categoryName}
              </span>
            </div>
          ) : null}

          {/* Two-Tone Stacked Headline matching exact reference */}
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#102A43] sm:text-4xl lg:text-5xl lg:leading-[1.12]">
            <span className="block">{first}</span>
            {second ? <span className="text-primary block">{second}</span> : null}
          </h1>

          {/* Event Lead Paragraph */}
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {event.summary && event.summary.length > 25
              ? event.summary
              : "Join us in making our community greener and healthier for future generations. Let's plant trees and create a cleaner, safer, and more sustainable environment together."}
          </p>

          {/* Three Metadata Chips in a Row with Bare Orange Icons */}
          <div className="mt-8 flex flex-wrap items-center gap-7 sm:gap-9 lg:gap-11">
            {/* Date */}
            <div className="flex items-start gap-3">
              <Calendar
                className="mt-0.5 size-6 shrink-0 stroke-[2] text-[#EB6A1F]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-slate-900" data-numeric="">
                  {dateStr}
                </p>
                <p className="text-xs text-slate-600">{dayName}</p>
              </div>
            </div>

            {/* Time */}
            <div className="flex items-start gap-3">
              <Clock
                className="mt-0.5 size-6 shrink-0 stroke-[2] text-[#EB6A1F]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-slate-900" data-numeric="">
                  {timeStr}
                </p>
                {duration ? <p className="text-xs text-slate-600">{duration}</p> : null}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3">
              <MapPin
                className="mt-0.5 size-6 shrink-0 stroke-[2] text-[#EB6A1F]"
                aria-hidden="true"
              />
              <div>
                <p className="line-clamp-1 text-sm font-bold text-slate-900">{venue}</p>
                <p className="line-clamp-1 text-xs text-slate-600">{locationSub}</p>
              </div>
            </div>
          </div>

          {/* Mobile Image below metadata on screens smaller than lg */}
          <div className="mt-8 lg:hidden">
            <div className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-2xl shadow-md">
              <MediaFrame
                media={event.cover}
                aspect="photo"
                priority
                rounded={false}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
