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

  const venue = event.venueName || event.address || 'Venue to be confirmed';
  const locationSub = event.city || 'India';

  return (
    <section className="relative w-full border-b border-slate-200/80 bg-gradient-to-b from-[#F0F6FB] via-[#F4F8FC] to-[#EDF4F9] py-8 sm:py-10 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-14">
          {/* Left Column: Event Information */}
          <div className="flex flex-col justify-center lg:col-span-7">
            {/* Breadcrumb Navigation: Home > Events > [Title] */}
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

            {/* Badge: Category */}
            {categoryName ? (
              <div className="mb-3 sm:mb-4">
                <span className="inline-flex items-center rounded-full bg-[#D4F4DF] px-3.5 py-1 text-xs font-semibold tracking-wide text-[#166534]">
                  {categoryName}
                </span>
              </div>
            ) : null}

            {/* Two-Tone Headline in Same Line */}
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#102A43] sm:text-4xl lg:text-[44px] lg:leading-[1.15]">
              <span>{first}</span>
              {second ? <span className="text-primary"> {second}</span> : null}
            </h1>

            {/* Event Summary / Lead Paragraph */}
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {event.summary && event.summary.length > 25
                ? event.summary
                : "Join us in making our community greener and healthier for future generations. Let's plant trees and create a cleaner, safer, and more sustainable environment together."}
            </p>

            {/* Mobile / Tablet Image: Shown directly below summary on mobile for natural reading flow */}
            <div className="mt-6 lg:hidden">
              <div className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-md">
                <MediaFrame
                  media={event.cover}
                  aspect="landscape"
                  priority
                  rounded={false}
                  className="size-full object-cover"
                />
              </div>
            </div>

            {/* Three Metadata Items in Structured Card */}
            <div className="shadow-xs backdrop-blur-xs mt-7 rounded-2xl border border-slate-200/90 bg-white/95 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 divide-y divide-slate-100 sm:grid-cols-3 sm:gap-6 sm:divide-x sm:divide-y-0">
                {/* Date */}
                <div className="flex items-start gap-3 sm:pr-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EB6A1F]">
                    <Calendar className="size-5 stroke-[2]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption font-medium uppercase tracking-wider text-slate-500">
                      Date
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900" data-numeric="">
                      {dateStr}
                    </p>
                    <p className="text-xs text-slate-600">{dayName}</p>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-start gap-3 pt-3 sm:px-4 sm:pt-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EB6A1F]">
                    <Clock className="size-5 stroke-[2]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption font-medium uppercase tracking-wider text-slate-500">
                      Time
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900" data-numeric="">
                      {timeStr}
                    </p>
                    {duration ? <p className="text-xs text-slate-600">{duration}</p> : null}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-3 pt-3 sm:pl-4 sm:pt-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EB6A1F]">
                    <MapPin className="size-5 stroke-[2]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption font-medium uppercase tracking-wider text-slate-500">
                      Location
                    </p>
                    <p
                      className="mt-0.5 line-clamp-1 text-sm font-bold text-slate-900"
                      title={venue}
                    >
                      {venue}
                    </p>
                    <p className="line-clamp-1 text-xs text-slate-600" title={locationSub}>
                      {locationSub}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Photograph (Desktop lg+ framed presentation with subtle glow) */}
          <div className="hidden lg:col-span-5 lg:block">
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              {/* Subtle ambient decorative glow behind card */}
              <div
                className="absolute -inset-2.5 -z-10 rounded-3xl bg-gradient-to-tr from-[#EB6A1F]/15 via-sky-400/10 to-indigo-500/10 blur-xl"
                aria-hidden="true"
              />

              {/* Elevated Photo Frame without any awkward curved arc cutouts */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border-4 border-white bg-slate-100 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 transition-transform duration-300 hover:scale-[1.01]">
                <MediaFrame
                  media={event.cover}
                  aspect="photo"
                  priority
                  rounded={false}
                  className="size-full object-cover"
                />

                {/* Floating pill badge on the photo */}
                <div className="absolute bottom-3.5 left-3.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-md">
                    <span className="size-2 rounded-full bg-[#EB6A1F]" />
                    <span>{event.city || event.venueName || 'Sailent Event'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
