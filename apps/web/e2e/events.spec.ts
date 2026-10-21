import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import pg from 'pg';

import { STAFF_STATE } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * The events listing: search, the date menu, "View More Events", and what
 * each card offers.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SPEC OWNS ITS EVENTS, AND EACH PROJECT OWNS ITS OWN.
 *
 * The seed has two upcoming events — too few to page through. So each
 * project writes eight of its own into the E2E database, far enough ahead
 * that nothing else is affected, every title carrying a word only that
 * project's run uses ("kestrel-desktop-r0-end"); the assertions search for
 * it, so the four projects running at once never count each other's cards.
 *
 * The web app caches the events list for five minutes, and a row written
 * straight to the database does not tell it. So one of the eight is written
 * as a draft and PUBLISHED THROUGH THE ADMIN PAGE, whose action revalidates
 * the list — the same path an editor's change takes. Cleaning up is the
 * mirror image: the rest are deleted, the published one is unpublished
 * through the admin page (revalidating again), and then it is deleted too.
 * ══════════════════════════════════════════════════════════════════════════
 */

async function query<T extends pg.QueryResultRow>(sql: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    return (await client.query<T>(sql, values)).rows;
  } finally {
    await client.end();
  }
}

/**
 * The word only this run's events carry: per project, and per repetition, so
 * `--repeat-each` copies running side by side never share (or delete) each
 * other's events. Ends in "-end" so no key is a prefix of another
 * ("kestrel-mobile-r0-end" is not inside "kestrel-mobile-xs-r0-end").
 */
const keyFor = (project: string, repeat: number) => `kestrel-${project}-r${repeat}-end`;

interface Fixture {
  n: number;
  /** IST wall-clock start, March or April 2027. */
  start: string;
  registration: 'open' | 'closed' | 'full' | 'cancelled';
  capacity: number | null;
  registered: number;
  deadlinePassed?: boolean;
}

/** Five in March 2027, three in April — every state a card can show. */
const FIXTURES: Fixture[] = [
  { n: 1, start: '2027-03-02T10:00', registration: 'open', capacity: 40, registered: 10 },
  { n: 2, start: '2027-03-03T10:00', registration: 'full', capacity: 20, registered: 20 },
  { n: 3, start: '2027-03-04T10:00', registration: 'closed', capacity: null, registered: 0 },
  {
    n: 4,
    start: '2027-03-05T10:00',
    registration: 'open',
    capacity: null,
    registered: 0,
    deadlinePassed: true,
  },
  { n: 5, start: '2027-03-06T10:00', registration: 'cancelled', capacity: null, registered: 0 },
  { n: 6, start: '2027-04-06T10:00', registration: 'open', capacity: null, registered: 0 },
  { n: 7, start: '2027-04-07T10:00', registration: 'open', capacity: null, registered: 0 },
  // The last one is the draft published through the admin page.
  { n: 8, start: '2027-04-08T10:00', registration: 'open', capacity: null, registered: 0 },
];

const titleFor = (key: string, n: number) => `${key} Field Day ${n}`;
const slugFor = (key: string, n: number) => `${key}-field-day-${n}`;

/**
 * Publish or unpublish through the admin page, so the web app's events cache
 * is revalidated, and wait until the database agrees.
 *
 * Its OWN browser context, with scripting on whatever the calling test set:
 * a context made inside a test inherits that test's options, and the admin
 * page streams its controls in — with scripting off they never appear.
 */
async function setPublication(browser: Browser, eventId: string, target: 'published' | 'draft') {
  const context = await browser.newContext({ storageState: STAFF_STATE, javaScriptEnabled: true });
  const page = await context.newPage();
  try {
    await page.goto(`/admin/events/${eventId}/edit`);
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page
        .getByRole('button', {
          name: target === 'published' ? 'Publish' : 'Unpublish',
          exact: true,
        })
        .click(),
    ]);
    await expect
      .poll(
        async () =>
          (await query<{ status: string }>(`SELECT status FROM events WHERE id = $1`, [eventId]))[0]
            ?.status,
        { timeout: 20_000 },
      )
      .toBe(target);
  } finally {
    await context.close();
  }
}

const cards = (page: Page): Locator =>
  page.getByRole('list', { name: 'Upcoming events' }).getByRole('listitem');

const cardFor = (page: Page, title: string): Locator =>
  cards(page).filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test.describe('the events listing', () => {
  test.describe.configure({ mode: 'serial' });

  let key = '';
  let triggerId = '';

  test.beforeAll(async ({ browser }, testInfo) => {
    key = keyFor(testInfo.project.name, testInfo.repeatEachIndex);
    const slugs = FIXTURES.map((fixture) => slugFor(key, fixture.n));

    // A previous run that died half-way must not leave a slug clash behind.
    await query(`DELETE FROM events WHERE slug = ANY($1::text[])`, [slugs]);

    for (const fixture of FIXTURES) {
      const isTrigger = fixture.n === FIXTURES.length;
      const [row] = await query<{ id: string }>(
        `INSERT INTO events (
           title, slug, summary, start_date, end_date, city, is_online,
           capacity, registered_count, registration_status, registration_deadline,
           status, published_at
         ) VALUES (
           $1, $2, 'A community field day for the events listing tests.',
           ($3::text || ':00+05:30')::timestamptz,
           ($3::text || ':00+05:30')::timestamptz + interval '4 hours',
           'Pune, Maharashtra', false,
           $4::int, $5::int, $6::text::event_registration_status,
           CASE WHEN $7::boolean THEN now() - interval '1 day' ELSE NULL END,
           $8::text::publish_status, CASE WHEN $8::text = 'published' THEN now() ELSE NULL END
         ) RETURNING id`,
        [
          titleFor(key, fixture.n),
          slugFor(key, fixture.n),
          fixture.start,
          fixture.capacity,
          fixture.registered,
          fixture.registration,
          fixture.deadlinePassed ?? false,
          isTrigger ? 'draft' : 'published',
        ],
      );
      if (isTrigger) triggerId = row!.id;
    }

    await setPublication(browser, triggerId, 'published');
  });

  test.afterAll(async ({ browser }) => {
    const others = FIXTURES.slice(0, -1).map((fixture) => slugFor(key, fixture.n));
    await query(`DELETE FROM events WHERE slug = ANY($1::text[])`, [others]);
    if (triggerId) {
      await setPublication(browser, triggerId, 'draft');
      await query(`DELETE FROM events WHERE id = $1`, [triggerId]);
    }
  });

  test('pages through the upcoming events six at a time, never repeating one', async ({ page }) => {
    await page.goto(`/events?q=${key}`);

    await expect(page.getByRole('status').filter({ hasText: 'Showing 6 of 8' })).toBeVisible();
    await expect(cards(page)).toHaveCount(6);

    const more = page.getByRole('link', { name: 'View More Events' });
    await expect(more).toBeVisible();
    await more.click();

    // The search is carried into the next page, which lands below the first.
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    expect(new URL(page.url()).searchParams.get('q')).toBe(key);
    await expect(cards(page)).toHaveCount(8);

    const titles = await cards(page).getByRole('heading').allTextContents();
    expect(new Set(titles).size).toBe(8);
    expect(titles).toEqual(FIXTURES.map((fixture) => titleFor(key, fixture.n)));

    // Everything is showing, so there is nothing more to offer.
    await expect(page.getByRole('link', { name: 'View More Events' })).toHaveCount(0);
  });

  test('narrows to a month, with or without the search, and lifts either filter cleanly', async ({
    page,
  }) => {
    // Six navigations in one journey: with four projects running at once, the
    // default 30s budget can run out before the last one lands.
    test.slow();
    await page.goto(`/events?q=${key}`);
    await page.waitForLoadState('networkidle');

    const menu = page.getByRole('combobox', { name: 'Filter events by date' });
    await menu.click();
    await page.getByRole('option', { name: 'April 2027' }).click();

    await page.waitForURL((url) => url.searchParams.get('date') === '2027-04');
    expect(new URL(page.url()).searchParams.get('q')).toBe(key);
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).getByRole('heading')).toHaveText(
      [6, 7, 8].map((n) => titleFor(key, n)),
    );

    /*
      Emptying the search keeps the month: every card left is in April 2027.
      Not "our three are showing" — the other projects' April events are in
      the list too while they run, and ties in date order are in no fixed order.
    */
    await page.getByRole('searchbox', { name: 'Search events' }).fill('');
    await page.waitForURL((url) => !url.searchParams.has('q'));
    expect(new URL(page.url()).searchParams.get('date')).toBe('2027-04');
    await expect(cards(page).first()).toBeVisible();
    for (const text of await cards(page).allTextContents()) expect(text).toContain('April 2027');

    // And "All Dates" lifts the month.
    await menu.click();
    await page.getByRole('option', { name: 'All Dates' }).click();
    await page.waitForURL((url) => !url.searchParams.has('date'));
    await expect(menu).toHaveText(/All Dates/);
  });

  test('offers "Register Now" only where the shared registration rule allows it', async ({
    page,
  }) => {
    await page.goto(`/events?q=${key}&page=2`);
    await expect(cards(page)).toHaveCount(8);

    const register = (n: number) =>
      cardFor(page, titleFor(key, n)).getByRole('link', { name: /^Register Now/ });

    // Open, with a cap: the button — to the event's registration page — and the places left.
    await expect(register(1)).toBeVisible();
    await expect(register(1)).toHaveAttribute('href', `/events/${slugFor(key, 1)}/register`);
    await expect(cardFor(page, titleFor(key, 1))).toContainText('30 places left');

    // Every place taken, closed by hand, past its deadline, cancelled: no button.
    const states: [number, string][] = [
      [2, 'Fully booked'],
      [3, 'Registration closed'],
      [4, 'Registration closed'],
      [5, 'Event cancelled'],
    ];
    for (const [n, label] of states) {
      await expect(cardFor(page, titleFor(key, n))).toContainText(label);
      await expect(register(n)).toHaveCount(0);
    }

    // Open and uncapped: the button, and no count to show.
    await expect(register(6)).toBeVisible();
    await expect(cardFor(page, titleFor(key, 6))).not.toContainText('places left');
  });

  test('says so when nothing matches, and offers the way back', async ({ page }) => {
    await page.goto(`/events?q=${key}-nothing`);

    await expect(page.getByText('No events match your search')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);

    await page.getByRole('link', { name: 'View all upcoming events' }).click();
    await page.waitForURL((url) => url.pathname === '/events' && url.search === '');
    await expect(cards(page).first()).toBeVisible();
  });
});

/**
 * The rest of the owner's events design (2026-10-17): the "Want to get
 * involved?" panel and the latest past events. The seed's one past event is
 * "Community Plantation Drive"; nothing here is created by the test.
 */
test.describe('the events page around the listing', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('invites the visitor to volunteer, and lists past events', async ({ page }) => {
    await page.goto('/events');

    const involved = page.getByRole('region', { name: 'Want to get involved?' });
    await expect(involved).toBeVisible();
    await expect(involved.getByRole('link', { name: /Explore Volunteering/ })).toHaveAttribute(
      'href',
      '/volunteer',
    );

    await expect(page.getByRole('heading', { level: 2, name: 'Past events' })).toBeVisible();
    const past = page.getByRole('list', { name: 'Past events' }).getByRole('listitem');
    await expect(past.filter({ hasText: 'Community Plantation Drive' })).toHaveCount(1);
    await expect(past.getByRole('link', { name: /^View Details/ }).first()).toHaveAttribute(
      'href',
      /^\/events\/[a-z0-9-]+$/,
    );
  });
});
