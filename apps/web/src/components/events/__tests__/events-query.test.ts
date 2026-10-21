import { describe, expect, it } from 'vitest';

import type { SailentEvent } from '@/lib/mock/types';

import {
  EVENTS_PAGE_SIZE,
  cardAction,
  dateBadge,
  dayLabel,
  eventMonthOptions,
  eventsHref,
  eventsView,
  locationLabel,
  matchesSearch,
  monthKey,
  parseEventsQuery,
  timeRange,
} from '../events-query';

const NBSP = ' ';

/** An upcoming event with everything a card reads, open and uncapped unless told otherwise. */
function event(overrides: Partial<SailentEvent> = {}): SailentEvent {
  return {
    slug: 'health-camp',
    title: 'Health Camp',
    summary: 'A one-day community health camp.',
    startsAt: '2026-11-10T04:30:00.000Z', // 10:00 IST
    endsAt: '2026-11-10T08:30:00.000Z', // 14:00 IST
    venueName: 'Ward 12 Community Hall',
    city: 'Pune, Maharashtra',
    isOnline: false,
    capacity: null,
    registeredCount: 0,
    status: 'registration_open',
    lifecycle: 'open',
    registrationDeadline: null,
    cover: { seed: 'event-health-camp', alt: 'Health Camp' },
    description: [],
    schedule: [],
    address: null,
    programSlug: null,
    campaignSlug: null,
    requiresVolunteers: false,
    gallery: [],
    ...overrides,
  };
}

/** `count` events a day apart from 1 November, slugs `e1`…, titles "Event 1"… */
function series(count: number, start = Date.UTC(2026, 10, 1, 4, 30)): SailentEvent[] {
  return Array.from({ length: count }, (_, index) =>
    event({
      slug: `e${index + 1}`,
      title: `Event ${index + 1}`,
      startsAt: new Date(start + index * 86_400_000).toISOString(),
      endsAt: null,
    }),
  );
}

describe('parseEventsQuery / eventsHref', () => {
  it('defaults to the first page of every upcoming event, with the latest three past ones', () => {
    expect(parseEventsQuery({})).toEqual({ q: null, date: null, page: 1, allPast: false });
    expect(eventsHref({})).toBe('/events');
  });

  it('ignores a month, a page or a past flag it does not recognise', () => {
    const query = parseEventsQuery({ date: '2026-13', page: 'lots', past: 'yes' });
    expect(query).toEqual({ q: null, date: null, page: 1, allPast: false });
  });

  it('keeps the page count inside what one API request can serve', () => {
    expect(parseEventsQuery({ page: '999' }).page).toBe(Math.ceil(100 / EVENTS_PAGE_SIZE));
    expect(parseEventsQuery({ page: '0' }).page).toBe(1);
  });

  it('round-trips every filter, leaving defaults out of the URL', () => {
    const href = eventsHref({ q: 'health camp', date: '2026-11', page: 2, allPast: true });
    expect(href).toBe('/events?q=health+camp&date=2026-11&page=2&past=all');

    const parsed = parseEventsQuery(Object.fromEntries(new URL(href, 'http://x').searchParams));
    expect(parsed).toEqual({ q: 'health camp', date: '2026-11', page: 2, allPast: true });
  });

  it('trims the search and treats an empty one as none', () => {
    expect(parseEventsQuery({ q: '   ' }).q).toBeNull();
    expect(parseEventsQuery({ q: '  camp ' }).q).toBe('camp');
  });
});

describe('dates are read in India Standard Time', () => {
  it('puts an event just after midnight IST in the new month', () => {
    // 31 Oct 19:00 UTC is 1 Nov 00:30 in IST; 18:00 UTC is still 31 Oct 23:30.
    expect(monthKey('2026-10-31T19:00:00.000Z')).toBe('2026-11');
    expect(monthKey('2026-10-31T18:00:00.000Z')).toBe('2026-10');
  });

  it('offers each month that has an event, once, in date order', () => {
    const options = eventMonthOptions([
      { startsAt: '2026-12-02T04:30:00.000Z' },
      { startsAt: '2026-10-22T04:30:00.000Z' },
      { startsAt: '2026-12-20T04:30:00.000Z' },
    ]);
    expect(options).toEqual([
      { value: '2026-10', label: 'October 2026' },
      { value: '2026-12', label: 'December 2026' },
    ]);
  });

  it('draws the date block in IST, day month and year', () => {
    expect(dateBadge('2026-10-22T04:30:00.000Z')).toEqual({
      day: '22',
      month: 'OCT',
      year: '2026',
    });
    // 21 Oct 20:00 UTC is already 22 Oct in India.
    expect(dateBadge('2026-10-21T20:00:00.000Z').day).toBe('22');
  });

  it('writes a past event’s date as the design does, in IST', () => {
    expect(dayLabel('2026-10-13T04:30:00.000Z')).toBe('13 Oct 2026');
    // 12 Sep 20:00 UTC is already 13 Sep in India.
    expect(dayLabel('2026-09-12T20:00:00.000Z')).toMatch(/^13 Sept? 2026$/);
  });

  it('writes the time range the way the design does', () => {
    expect(timeRange('2026-10-22T04:30:00.000Z', '2026-10-22T08:30:00.000Z')).toBe(
      `10:00${NBSP}AM – 2:00${NBSP}PM`,
    );
    expect(timeRange('2026-10-22T04:30:00.000Z', null)).toBe(`10:00${NBSP}AM`);
    // Across midnight IST, the end carries its own day.
    expect(timeRange('2026-11-02T03:30:00.000Z', '2026-11-03T07:30:00.000Z')).toBe(
      `9:00${NBSP}AM – 3 Nov, 1:00${NBSP}PM`,
    );
  });
});

describe('locationLabel', () => {
  it('says Online, the city, the venue, or that the venue is not set — in that order', () => {
    expect(locationLabel({ isOnline: true, city: 'Pune', venueName: 'Hall' })).toBe('Online');
    expect(locationLabel({ isOnline: false, city: 'Pune', venueName: 'Hall' })).toBe('Pune');
    expect(locationLabel({ isOnline: false, city: null, venueName: 'Hall' })).toBe('Hall');
    expect(locationLabel({ isOnline: false, city: null, venueName: null })).toBe(
      'Venue to be confirmed',
    );
  });
});

describe('matchesSearch', () => {
  const camp = event({ title: 'Free Health Check-up Camp', city: 'Sāngli, Maharashtra' });

  it('matches title, summary and place, ignoring case and accents', () => {
    expect(matchesSearch(camp, 'HEALTH')).toBe(true);
    expect(matchesSearch(camp, 'community')).toBe(true); // in the summary
    expect(matchesSearch(camp, 'sangli')).toBe(true);
  });

  it('needs every word typed, so a second word narrows rather than widens', () => {
    expect(matchesSearch(camp, 'health sangli')).toBe(true);
    expect(matchesSearch(camp, 'health nashik')).toBe(false);
  });

  it('finds an event by its programme, and an online event by "online"', () => {
    expect(matchesSearch(camp, 'healthcare', 'Healthcare')).toBe(true);
    expect(matchesSearch(event({ isOnline: true }), 'online')).toBe(true);
  });
});

describe('eventsView — the grid and "View More Events"', () => {
  const events = series(14);

  it('shows six at a time, and says when more remain', () => {
    const first = eventsView(events, parseEventsQuery({}));
    expect(first.visible.map((item) => item.slug)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
    expect(first.hasMore).toBe(true);

    const second = eventsView(events, parseEventsQuery({ page: '2' }));
    expect(second.visible).toHaveLength(12);
    expect(second.hasMore).toBe(true);
  });

  it('never repeats a card, and stops offering more at the end', () => {
    const last = eventsView(events, parseEventsQuery({ page: '3' }));
    expect(last.visible).toHaveLength(14);
    expect(new Set(last.visible.map((item) => item.slug)).size).toBe(14);
    expect(last.hasMore).toBe(false);
  });

  it('clamps a page past the end to the last one that exists', () => {
    const view = eventsView(events, parseEventsQuery({ page: '9' }));
    expect(view.page).toBe(3);
    expect(view.visible).toHaveLength(14);
  });

  it('narrows to a month, and to a search, and to both together', () => {
    const mixed = [
      event({ slug: 'oct-camp', title: 'Eye Camp', startsAt: '2026-10-22T04:30:00.000Z' }),
      event({ slug: 'nov-camp', title: 'Eye Camp', startsAt: '2026-11-05T04:30:00.000Z' }),
      event({ slug: 'nov-drive', title: 'Tree Drive', startsAt: '2026-11-06T04:30:00.000Z' }),
    ];
    const slugs = (params: Record<string, string>) =>
      eventsView(mixed, parseEventsQuery(params)).visible.map((item) => item.slug);

    expect(slugs({ date: '2026-11' })).toEqual(['nov-camp', 'nov-drive']);
    expect(slugs({ q: 'eye camp' })).toEqual(['oct-camp', 'nov-camp']);
    expect(slugs({ q: 'eye camp', date: '2026-11' })).toEqual(['nov-camp']);
    // Lifting either filter restores what the other one allows.
    expect(slugs({ q: 'eye camp' })).toEqual(['oct-camp', 'nov-camp']);
    expect(slugs({})).toEqual(['oct-camp', 'nov-camp', 'nov-drive']);
  });

  it('treats a month with no events as "All Dates", so the menu and the grid agree', () => {
    const view = eventsView(events, parseEventsQuery({ date: '2030-01' }));
    expect(view.activeDate).toBeNull();
    expect(view.filtered).toBe(false);
    expect(view.matching).toHaveLength(14);
  });

  it('starts from the first page of a search’s own results', () => {
    // Every word must match: only "Event 13" has both "event" and "13" (the
    // shared venue, "Ward 12 Community Hall", has a 12 but no 13).
    const view = eventsView(events, parseEventsQuery({ q: 'event 13', page: '3' }));
    expect(view.matching.map((item) => item.slug)).toEqual(['e13']);
    // One result is one page, however many pages the URL asked for.
    expect(view.page).toBe(1);
    expect(view.hasMore).toBe(false);
  });
});

describe('cardAction — the shared registration rule', () => {
  const now = new Date('2026-11-01T00:00:00.000Z');

  it('offers registration while there is room, with the places left', () => {
    expect(cardAction(event({ capacity: 40, registeredCount: 27 }), now)).toEqual({
      kind: 'register',
      seatsLeft: 13,
    });
    expect(cardAction(event(), now)).toEqual({ kind: 'register', seatsLeft: null });
  });

  it('says full when the places are taken, whatever the lifecycle field says', () => {
    expect(cardAction(event({ capacity: 25, registeredCount: 25 }), now)).toEqual({ kind: 'full' });
    expect(cardAction(event({ lifecycle: 'full', capacity: 25, registeredCount: 3 }), now)).toEqual(
      { kind: 'full' },
    );
  });

  it('says closed for an operator-closed event and for one past its deadline', () => {
    expect(cardAction(event({ lifecycle: 'closed', status: 'registration_closed' }), now)).toEqual({
      kind: 'closed',
    });
    expect(cardAction(event({ registrationDeadline: '2026-10-31T00:00:00.000Z' }), now)).toEqual({
      kind: 'closed',
    });
  });

  it('puts cancelled before everything else', () => {
    expect(
      cardAction(
        event({
          lifecycle: 'cancelled',
          status: 'cancelled',
          capacity: 10,
          registeredCount: 10,
          registrationDeadline: '2026-10-31T00:00:00.000Z',
        }),
        now,
      ),
    ).toEqual({ kind: 'cancelled' });
  });
});
