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
    <section className="border-border/80 from-muted via-muted to-muted relative w-full border-b bg-gradient-to-b py-8 sm:py-10 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-14">
          {/* Left Column: Event Information */}
          <div className="flex flex-col justify-center lg:col-span-7">
            {/* Breadcrumb Navigation: Home > Events > [Title] */}
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                <li>
                  <Link href="/" className="hover:text-primary transition-colors">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground">
                  <ChevronRight className="size-3" />
                </li>
                <li>
                  <Link href="/events" className="hover:text-primary transition-colors">
                    Events
                  </Link>
                </li>
                <li aria-hidden="true" className="text-muted-foreground">
                  <ChevronRight className="size-3" />
                </li>
                <li
                  aria-current="page"
                  className="text-foreground max-w-[180px] truncate font-semibold sm:max-w-xs"
                >
                  {event.title}
                </li>
              </ol>
            </nav>

            {/* Badge: Category */}
            {categoryName ? (
              <div className="mb-3 sm:mb-4">
                <span className="bg-success-subtle text-success inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold tracking-wide">
                  {categoryName}
                </span>
              </div>
            ) : null}

            {/* Two-Tone Headline in Same Line */}
            <h1 className="font-display text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[1.15]">
              <span>{first}</span>
              {second ? <span className="text-primary"> {second}</span> : null}
            </h1>

            {/* Event Summary / Lead Paragraph */}
            <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-relaxed sm:text-base">
              {event.summary && event.summary.length > 25
                ? event.summary
                : "Join us in making our community greener and healthier for future generations. Let's plant trees and create a cleaner, safer, and more sustainable environment together."}
            </p>

            {/* Mobile / Tablet Image: Shown directly below summary on mobile for natural reading flow */}
            <div className="mt-6 lg:hidden">
              <div className="bg-muted relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-2xl border-2 border-white shadow-md">
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
            <div className="shadow-xs backdrop-blur-xs border-border/90 bg-surface/95 mt-7 rounded-2xl border p-4 sm:p-5">
              <div className="divide-border grid grid-cols-1 gap-4 divide-y sm:grid-cols-3 sm:gap-6 sm:divide-x sm:divide-y-0">
                {/* Date */}
                <div className="flex items-start gap-3 sm:pr-4">
                  <div className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Calendar className="size-5 stroke-[2]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
                      Date
                    </p>
                    <p
                      className="text-foreground mt-0.5 truncate text-sm font-bold"
                      data-numeric=""
                    >
                      {dateStr}
                    </p>
                    <p className="text-muted-foreground text-xs">{dayName}</p>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-start gap-3 pt-3 sm:px-4 sm:pt-0">
                  <div className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Clock className="size-5 stroke-[2]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
                      Time
                    </p>
                    <p
                      className="text-foreground mt-0.5 truncate text-sm font-bold"
                      data-numeric=""
                    >
                      {timeStr}
                    </p>
                    {duration ? <p className="text-muted-foreground text-xs">{duration}</p> : null}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-3 pt-3 sm:pl-4 sm:pt-0">
                  <div className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <MapPin className="size-5 stroke-[2]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
                      Location
                    </p>
                    <p
                      className="text-foreground mt-0.5 line-clamp-1 text-sm font-bold"
                      title={venue}
                    >
                      {venue}
                    </p>
                    <p className="text-muted-foreground line-clamp-1 text-xs" title={locationSub}>
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
                className="from-primary/15 via-info/10 to-info/10 absolute -inset-2.5 -z-10 rounded-3xl bg-gradient-to-tr blur-xl"
                aria-hidden="true"
              />

              {/* Elevated Photo Frame without any awkward curved arc cutouts */}
              <div className="bg-muted ring-input/5 relative aspect-[4/3] w-full overflow-hidden rounded-3xl border-4 border-white shadow-xl shadow-slate-900/10 ring-1 transition-transform duration-300 hover:scale-[1.01]">
                <MediaFrame
                  media={event.cover}
                  aspect="photo"
                  priority
                  rounded={false}
                  className="size-full object-cover"
                />

                {/* Floating pill badge on the photo */}
                <div className="absolute bottom-3.5 left-3.5 flex items-center gap-2">
                  <span className="bg-surface/95 text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur-md">
                    <span className="bg-primary size-2 rounded-full" />
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
