import { registrationAvailability } from '@sailent/validation';

import type { SailentEvent } from '@/lib/mock/types';

/**
 * The events listing's state, as it lives in the URL, and everything the page
 * derives from it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SEARCH, THE DATE MENU AND "VIEW MORE EVENTS" ALL LEAD TO URLS, AND THE
 * SERVER RENDERS WHAT THEY LEAD TO — the pattern of the campaigns and programs
 * listings (`components/campaigns/listing-query.ts`,
 * `components/programs/programs-query.ts`).
 *
 * A filtered listing is a link somebody can share, and it survives the
 * back button. Every upcoming event is
 * already in hand — the page has always asked the API for up to 100 at once,
 * and the API has no search or date filter of its own for events — so
 * narrowing, searching and paging are a slice of that one list, as on
 * /programs. One list, sliced, is also why "View More" cannot repeat a card:
 * page two is the first twelve of the same ordering, not a second request
 * that could overlap the first.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Two rows of three on a desktop — the reference design's first screen of cards. */
export const EVENTS_PAGE_SIZE = 6;

/** The API returns at most 100 events a page; past that, search and the date menu are the way in. */
const MAX_EVENTS = 100;
const MAX_PAGES = Math.ceil(MAX_EVENTS / EVENTS_PAGE_SIZE);

/** The most the search box carries, as the campaigns and programs searches do. */
const MAX_SEARCH_LENGTH = 200;

/**
 * Every event is held and shown in India Standard Time — the zone the admin
 * form writes them in (`lib/admin/actions.ts`), and the one the detail page
 * prints. IST has no daylight saving, so a month or a day boundary here is
 * the same all year.
 */
const TIME_ZONE = 'Asia/Kolkata';

/** A month, as the date menu and the URL spell it: `2026-11`. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface EventsQuery {
  /** The search box's text, trimmed; null when empty. */
  q: string | null;
  /** A month (`YYYY-MM`) as it arrived; checked against the months events actually have. */
  date: string | null;
  /** How many pages of upcoming cards are showing — "View More Events" adds one. */
  page: number;
  /** Every past event, rather than the latest three. */
  allPast: boolean;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseEventsQuery(params: SearchParams): EventsQuery {
  const page = Number.parseInt(first(params.page) ?? '1', 10);
  const date = first(params.date)?.trim() ?? '';

  return {
    q: first(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || null,
    date: MONTH_PATTERN.test(date) ? date : null,
    page: Number.isFinite(page) ? Math.min(MAX_PAGES, Math.max(1, page)) : 1,
    allPast: first(params.past) === 'all',
  };
}

/** The listing URL for a query, with every default left out so links stay short. */
export function eventsHref(query: Partial<EventsQuery>): string {
  const params = new URLSearchParams();

  if (query.q) params.set('q', query.q);
  if (query.date) params.set('date', query.date);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.allPast) params.set('past', 'all');

  const search = params.toString();
  return search ? `/events?${search}` : '/events';
}

// ---------------------------------------------------------------------------
// Dates, in IST
// ---------------------------------------------------------------------------

const MONTH_KEY = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

const DAY_KEY = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((entry) => entry.type === type)?.value ?? '';
}

/** The IST month an instant falls in, as `YYYY-MM`. */
export function monthKey(iso: string): string {
  const parts = MONTH_KEY.formatToParts(new Date(iso));
  return `${part(parts, 'year')}-${part(parts, 'month')}`;
}

function dayKey(iso: string): string {
  const parts = DAY_KEY.formatToParts(new Date(iso));
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "November 2026" for `2026-11`. Read at mid-month UTC, so no zone can tip it into another. */
export function monthLabel(key: string): string {
  return MONTH_LABEL.format(new Date(`${key}-15T00:00:00Z`));
}

export interface DateOption {
  value: string;
  label: string;
}

/**
 * The date menu's choices: each month that has at least one upcoming event,
 * in date order.
 *
 * Derived from the live list, so the menu never offers a month with nothing
 * in it, and a month appears the day its first event is published.
 */
export function eventMonthOptions(events: Pick<SailentEvent, 'startsAt'>[]): DateOption[] {
  const keys = [...new Set(events.map((event) => monthKey(event.startsAt)))].sort();
  return keys.map((value) => ({ value, label: monthLabel(value) }));
}

const BADGE = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** The card's date block: "22", "OCT", "2026". */
export function dateBadge(iso: string): { day: string; month: string; year: string } {
  const parts = BADGE.formatToParts(new Date(iso));
  return {
    day: part(parts, 'day'),
    month: part(parts, 'month').toUpperCase(),
    year: part(parts, 'year'),
  };
}

const DAY_LABEL = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "12 Sept 2026" — the past-events row's date, as the design writes it. */
export function dayLabel(iso: string): string {
  return DAY_LABEL.format(new Date(iso));
}

const CLOCK = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const SHORT_DAY = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

/**
 * "10:00 AM" — the design's capitals; `en-IN` writes "am". The space before
 * them is a non-breaking one, so a time never splits across two lines.
 */
function clock(iso: string): string {
  return CLOCK.formatToParts(new Date(iso))
    .map((entry) => (entry.type === 'dayPeriod' ? entry.value.toUpperCase() : entry.value))
    .join('')
    .replace(/\s+/g, '\u00a0');
}

/**
 * When it runs, in IST: "10:00 AM – 2:00 PM" on one day, "9:00 AM – 3 Nov,
 * 1:00 PM" across two, or the start alone when no end was given.
 */
export function timeRange(startsAt: string, endsAt: string | null): string {
  const start = clock(startsAt);
  if (!endsAt) return start;
  if (dayKey(startsAt) === dayKey(endsAt)) return `${start} – ${clock(endsAt)}`;
  return `${start} – ${SHORT_DAY.format(new Date(endsAt))}, ${clock(endsAt)}`;
}

/** Where it is, as briefly as the card can say it. */
export function locationLabel(
  event: Pick<SailentEvent, 'isOnline' | 'city' | 'venueName'>,
): string {
  if (event.isOnline) return 'Online';
  return event.city ?? event.venueName ?? 'Venue to be confirmed';
}

// ---------------------------------------------------------------------------
// Search, the date menu and "View More"
// ---------------------------------------------------------------------------

/** Lower case, accents off: "Sangli" finds "sāngli", "CAMP" finds "camp". */
function normalise(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Whether an event answers a search: every word typed must appear somewhere
 * in its title, summary, place or programme — so "pune health" finds the
 * health camp in Pune and not every event in Pune.
 */
export function matchesSearch(
  event: Pick<SailentEvent, 'title' | 'summary' | 'city' | 'venueName' | 'isOnline'>,
  q: string,
  programName?: string | null,
): boolean {
  const terms = normalise(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = normalise(
    [
      event.title,
      event.summary,
      event.city,
      event.venueName,
      event.isOnline ? 'online' : null,
      programName,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return terms.every((term) => haystack.includes(term));
}

export interface EventsView {
  /** The month in force — null when none was asked for, or the one asked for has no events. */
  activeDate: string | null;
  /** Every upcoming event the search and the month allow, in date order. */
  matching: SailentEvent[];
  /** The ones on screen: the first `page × 6` of `matching`. */
  visible: SailentEvent[];
  /** The page actually shown, after clamping to what exists. */
  page: number;
  hasMore: boolean;
  /** Whether a search or a month is narrowing the list. */
  filtered: boolean;
}

export function eventsView(
  events: SailentEvent[],
  query: EventsQuery,
  programName: (event: SailentEvent) => string | null = () => null,
): EventsView {
  /*
    RESOLVED, not merely well-formed. A month nobody has an event in — a stale
    link, or one typed by hand — falls back to every date rather than to an
    empty page, and the menu then shows "All Dates", so the two agree.
  */
  const activeDate =
    query.date && events.some((event) => monthKey(event.startsAt) === query.date)
      ? query.date
      : null;

  const matching = events.filter(
    (event) =>
      (activeDate === null || monthKey(event.startsAt) === activeDate) &&
      (query.q === null || matchesSearch(event, query.q, programName(event))),
  );

  const pages = Math.max(1, Math.ceil(matching.length / EVENTS_PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const visible = matching.slice(0, page * EVENTS_PAGE_SIZE);

  return {
    activeDate,
    matching,
    visible,
    page,
    hasMore: matching.length > visible.length,
    filtered: activeDate !== null || query.q !== null,
  };
}

// ---------------------------------------------------------------------------
// What a card offers
// ---------------------------------------------------------------------------

export type CardAction =
  | { kind: 'register'; seatsLeft: number | null }
  | { kind: 'full' }
  | { kind: 'closed' }
  | { kind: 'cancelled' }
  | { kind: 'finished' };

/**
 * Whether a card offers "Register Now", or says why it cannot.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SHARED RULE, NOT A SECOND ONE. `registrationAvailability` is the same
 * function the API runs under its row lock before it admits anybody, and the
 * event page's panel follows the same order: cancelled before everything,
 * then closed, the deadline, and capacity. So a card can never offer a place
 * that the event page — or the API — would then refuse.
 *
 * It is still only what to SHOW. A card can be a moment out of date, and the
 * registration itself is decided by the API; whether THIS visitor already
 * holds a place is a fact about their session, which the event page answers.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function cardAction(event: SailentEvent, now: Date = new Date()): CardAction {
  const availability = registrationAvailability(
    {
      // The public API serves published events only.
      status: 'published',
      lifecycle:
        event.lifecycle ??
        (event.status === 'registration_open'
          ? 'open'
          : event.status === 'cancelled'
            ? 'cancelled'
            : event.status === 'completed'
              ? 'completed'
              : 'closed'),
      startDate: event.startsAt,
      registrationDeadline: event.registrationDeadline ?? null,
      capacity: event.capacity,
      registeredCount: event.registeredCount,
    },
    now,
  );

  switch (availability.state) {
    case 'open':
      return { kind: 'register', seatsLeft: availability.seatsLeft };
    case 'full':
      return { kind: 'full' };
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'completed':
      return { kind: 'finished' };
    default:
      // `closed`, `deadline-passed` — and `unpublished`, which the public list never serves.
      return { kind: 'closed' };
  }
}
