import 'server-only';

import type { SailentEvent } from '@/lib/mock/types';
import { events as eventFixtures } from '@/lib/mock/events';

import { isNotFound } from './programs';
import { loadContent, publicCache, toMedia, type Paginated } from './source';

interface ApiEventSummary {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImage: string | null;
  startDate: string;
  endDate: string | null;
  venueName: string | null;
  city: string | null;
  isOnline: boolean;
  capacity: number | null;
  registeredCount: number;
  /*
    The real vocabulary of `events.registration_status`. It was written here as
    `'open' | 'closed' | 'full' | 'waitlist'` — but `waitlist` is not one of the
    enum's values and `cancelled` and `completed` are, so a cancelled event used
    to fall through `toEventStatus` and render as "registration closed".
  */
  registrationStatus: 'open' | 'closed' | 'full' | 'cancelled' | 'completed';
  registrationDeadline?: string | null;
  organizer?: string | null;
}

interface ApiEventDetail extends ApiEventSummary {
  description: string | null;
  address: string | null;
  schedule: { time: string; activity: string }[] | null;
  gallery: { seed?: string; alt?: string; caption?: string }[] | null;
  requiresVolunteers: boolean;
  programSlug?: string | null;
  campaignSlug?: string | null;
}

function paragraphs(body: string | null): string[] {
  if (!body) return [];
  return body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Translate the registration state into the card's status.
 *
 * The database records WHY registration is shut (full, waitlisted, closed by
 * hand); the card only needs to know that it is, plus whether the event has
 * already happened. Collapsing here keeps that judgement in one place instead
 * of in every component that renders a badge.
 */
function toEventStatus(
  registration: ApiEventSummary['registrationStatus'],
  startsAt: string,
): SailentEvent['status'] {
  // A cancelled event is not a past one and not a closed one, and it keeps that
  // status whatever its date says — somebody arriving on the day needs to read
  // "cancelled", not "this has finished".
  if (registration === 'cancelled') return 'cancelled';
  if (registration === 'completed') return 'completed';
  if (new Date(startsAt).getTime() < Date.now()) return 'completed';
  return registration === 'open' ? 'registration_open' : 'registration_closed';
}

function toEvent(row: ApiEventSummary | ApiEventDetail): SailentEvent {
  const detail = row as Partial<ApiEventDetail>;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? '',
    startsAt: row.startDate,
    endsAt: row.endDate,
    venueName: row.venueName,
    city: row.city,
    isOnline: row.isOnline,
    capacity: row.capacity,
    registeredCount: row.registeredCount,
    status: toEventStatus(row.registrationStatus, row.startDate),
    lifecycle: row.registrationStatus,
    registrationDeadline: row.registrationDeadline ?? null,
    organizer: row.organizer ?? null,
    cover: toMedia(row.coverImage, `event-${row.slug}`, row.title),

    description: paragraphs(detail.description ?? null),
    schedule: detail.schedule ?? [],
    address: detail.address ?? null,
    programSlug: detail.programSlug ?? null,
    campaignSlug: detail.campaignSlug ?? null,
    requiresVolunteers: detail.requiresVolunteers ?? false,
    gallery: (detail.gallery ?? []).map((item, index) => ({
      seed: item.seed ?? `event-${row.slug}-${index}`,
      alt: item.alt ?? `${row.title} photograph`,
      caption: item.caption,
    })),
  };
}

export async function getEvents(when: 'upcoming' | 'past' = 'upcoming'): Promise<SailentEvent[]> {
  return loadContent({
    label: `events:${when}`,
    fromApi: async (api) => {
      const page = await api.get<Paginated<ApiEventSummary>>('events', {
        query: { when, limit: 100 },
        ...publicCache('events'),
      });
      return page.items.map(toEvent);
    },
    fallback: () => eventFixtures,
  });
}

export async function getEvent(slug: string): Promise<SailentEvent | null> {
  return loadContent({
    label: `events/${slug}`,
    fromApi: async (api) => {
      try {
        return toEvent(
          await api.get<ApiEventDetail>(`events/${slug}`, publicCache(`event-${slug}`)),
        );
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => eventFixtures.find((event) => event.slug === slug) ?? null,
  });
}
