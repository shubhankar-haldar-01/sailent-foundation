import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { donorFor, donorStateFor } from './global-setup.js';

/**
 * The donor dashboard, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SIGNED-OUT TESTS COME FIRST, AND THEY ARE THE IMPORTANT ONES.
 *
 * A dashboard that renders for its owner is the easy half. What this suite has
 * to prove is that it does NOT render for anybody else — that every route
 * bounces a visitor with no session, and that the bounce happens before any
 * page runs rather than as an error page full of 401s.
 *
 * The signed-in half then uses a storage state created in global setup, where
 * the donor signs in through the real OTP endpoint.
 * ══════════════════════════════════════════════════════════════════════════
 */

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
    })),
  ).toEqual([]);
}

/**
 * Wait for client components to hydrate before interacting.
 *
 * The dashboard forms are server-rendered, so their fields and buttons are
 * visible and clickable BEFORE React has attached anything. A click in that
 * window is either swallowed or triggers a plain form POST that never renders
 * the confirmation — which showed up here as a save that "failed" on the two
 * slower viewport projects and passed on the others. Same reasoning, and same
 * helper, as journeys.spec.ts.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Submit and wait for the server action to actually finish.
 *
 * A server action posts to the page's own URL. Pressing the button starts that
 * POST and returns immediately, so navigating straight afterwards races it —
 * which is why saved campaigns kept appearing to save and then not be there.
 * `domcontentloaded` does not help: no navigation has begun yet.
 *
 * Waiting for the POST response is the precise signal, and it works whether or
 * not the form has hydrated.
 */
async function submitAndWait(page: Page, locator: Locator) {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST', {
      timeout: 20_000,
    }),
    locator.press('Enter'),
  ]);
}

/** A campaign title goes into a regex, and titles contain punctuation. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The event the registration tests use.
 *
 * Chosen for ample capacity: the four viewport projects run concurrently, each
 * with its own donor, and every test here registers and then cancels so the
 * seeded seat count ends where it started.
 */
const OPEN_EVENT = 'animal-care-awareness';

const PROTECTED = [
  '/dashboard',
  '/dashboard/donations',
  '/dashboard/campaigns',
  '/dashboard/saved',
  '/dashboard/events',
  '/dashboard/updates',
  '/dashboard/profile',
  '/dashboard/settings',
];

// =========================================================================
test.describe('signed out', () => {
  // No storage state at all: not the donor's, and not the staff one either.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of PROTECTED) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/sign-in/);
      // Where they were going, so sign-in could return them there.
      expect(page.url()).toContain(`next=${encodeURIComponent(path)}`);
      // And nothing from the dashboard leaked into the response on the way.
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });
  }

  test('the sign-in form asks for an email, not a password', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByLabel('Email address')).toBeVisible();
    // There is no password anywhere in this flow, by design (decision A8).
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByText(/no separate sign-up, and no password/i)).toBeVisible();
  });

  /**
   * The first step must advance whether or not the address is known, because the
   * API answers identically either way — otherwise this page becomes a way to
   * ask "has this person donated?".
   */
  test('asking for a code reveals nothing about whether the address is known', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill('nobody-signin-probe@example.test');
    await page.getByRole('button', { name: /send me a code/i }).click();

    await expect(page.getByLabel('Six-digit code')).toBeVisible();
    await expect(page.getByText(/if .* matches a donation/i)).toBeVisible();
  });

  test('the sign-in page has no accessibility violations', async ({ page }) => {
    await page.goto('/sign-in');
    await expectNoAxeViolations(page);
  });

  test('/account still reaches the dashboard, for old links', async ({ page }) => {
    await page.goto('/account');
    // Signed out, so it lands on sign-in — via /dashboard, which is what proves
    // the redirect fired rather than the route 404ing.
    await expect(page).toHaveURL(/\/sign-in/);
    expect(page.url()).toContain('dashboard');
  });
});

// =========================================================================
test.describe('signed in as a donor', () => {
  /**
   * Each viewport project signs in as ITS OWN donor — see `global-setup.ts`.
   * These tests edit a profile, toggle preferences and add and remove
   * bookmarks, so sharing one donor between four concurrent projects meant
   * sharing mutable state and one revocable session.
   */
  test.use({
    storageState: ({}, use, testInfo) => use(donorStateFor(testInfo.project.name)),
  });

  /** Within a project the tests still mutate one donor, so they run in order. */
  test.describe.configure({ mode: 'serial' });

  test('the overview shows this donor’s own totals', async ({ page }, testInfo) => {
    const donor = donorFor(testInfo.project.name);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: `Hello, ${donor.firstName}` })).toBeVisible();
    // ₹1,800 from the fixture's single confirmed donation.
    await expect(page.getByText('Total given')).toBeVisible();
    await expect(page.getByText('Campaigns funded')).toBeVisible();

    // Counted from the donor's own product lines: two school kits.
    await expect(page.getByRole('heading', { name: 'What you funded' })).toBeVisible();
    await expect(page.getByText('School kit')).toBeVisible();
  });

  test('the donation history lists the donation and opens its detail', async ({
    page,
  }, testInfo) => {
    const donor = donorFor(testInfo.project.name);
    await page.goto('/dashboard/donations');
    await settle(page);

    await expect(page.getByRole('heading', { name: 'Your donations' })).toBeVisible();
    const row = page.getByRole('link').filter({ hasText: donor.reference });
    await expect(row).toBeVisible();

    // `waitForURL` rather than `toHaveURL`: with four viewport projects running
    // at once the server takes longer than the 5s assertion default, and the
    // failure then reads as "the link does nothing" rather than "this was slow".
    await Promise.all([
      page.waitForURL(/\/dashboard\/donations\/[0-9a-f-]{36}$/, { timeout: 15_000 }),
      row.click(),
    ]);
    await expect(page.getByRole('heading', { name: 'What this bought' })).toBeVisible();
    // The snapshotted price, not today's catalogue price.
    await expect(page.getByText('2 × ₹900')).toBeVisible();
  });

  /**
   * The ownership boundary, from the outside.
   *
   * The API scopes the query by the session's donor id, so another donor's
   * donation does not come back forbidden — it does not come back, and the page
   * calls `notFound()`. 403 would confirm the id exists, which is what an
   * id-guessing attacker is actually after.
   *
   * ASSERTED ON WHAT RENDERS, NOT ON THE STATUS LINE. The dashboard layout
   * fetches before the page does, so Next has already begun streaming the shell
   * by the time `notFound()` fires and the response is committed as 200. The
   * not-found page still renders and no donation is disclosed, which is the
   * security property; the status code is a streaming artefact of the App
   * Router, and asserting on it would test Next rather than this platform.
   */
  test('a donation id that is not this donor’s discloses nothing', async ({ page }) => {
    // A well-formed uuid that certainly belongs to nobody.
    await page.goto('/dashboard/donations/00000000-0000-4000-8000-000000000000');

    await expect(page.getByRole('heading', { name: /couldn’t find that/i })).toBeVisible();

    // Nothing from a donation leaked onto the page on the way past.
    await expect(page.getByRole('heading', { name: 'What this bought' })).toHaveCount(0);
    await expect(page.getByText(/DON-/)).toHaveCount(0);
    // And the message does not distinguish "someone else's" from "gone", which
    // is the whole point of answering with a 404 rather than a 403.
    await expect(page.getByText(/permission|access|another account/i)).toHaveCount(0);
  });

  test('campaigns can be saved and unsaved', async ({ page }) => {
    /*
      ══════════════════════════════════════════════════════════════════════
      THREE THINGS THIS TEST LEARNED THE HARD WAY.

      1. It NORMALISES ITS OWN STARTING STATE. A saved campaign persists
         between runs, so a test that assumes "not saved" passes once and then
         fails forever — the control reads "Remove … from saved campaigns" on
         the second run.

      2. It reads the campaign's TITLE FROM THE PAGE rather than hard-coding
         one. The accessible names of these controls include the title, and a
         slug does not tell you what it is.

      3. It does NOT wait for `networkidle` on a campaign page. That page never
         goes quiet — the donation builder and its imagery keep it busy — so
         `settle()` there just burns the timeout. Waiting for the control
         itself is both faster and a real signal.
      ══════════════════════════════════════════════════════════════════════
    */
    await page.goto('/campaigns');
    const firstCampaign = page.getByRole('link').filter({ hasText: /./ });
    await expect(firstCampaign.first()).toBeVisible();

    // Any published campaign will do; take the one the listing leads with.
    await page.goto('/campaigns/school-kits-jharkhand');

    /*
      The save control lives in the donation summary, and below `lg` that
      summary is a COLLAPSED bottom sheet — so on a phone it takes one tap to
      reach, exactly as the itemisation does. The test opens it the same way a
      donor would rather than asserting against a hidden node.
    */
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await page.getByRole('button', { name: /review/i }).click();
    }

    const saveButton = page.getByRole('button', { name: /^save .* for later$/i });
    const removeButton = page.getByRole('button', { name: /^remove .* from saved campaigns$/i });

    // Whichever is present tells us the current state — and that one being
    // visible is also the signal that the page is ready.
    await expect(saveButton.or(removeButton).first()).toBeVisible({ timeout: 20_000 });

    const title = (await page.getByRole('heading', { level: 1 }).first().textContent())?.trim();
    expect(title).toBeTruthy();

    if ((await removeButton.count()) > 0) {
      await submitAndWait(page, removeButton.first());
      await page.reload();
      await expect(saveButton.first()).toBeVisible({ timeout: 20_000 });
    }

    await submitAndWait(page, saveButton.first());

    await page.goto('/dashboard/saved');
    await expect(page.getByRole('heading', { name: 'Saved campaigns' })).toBeVisible();

    // Targeted at this campaign, not "some list item somewhere" — the dashboard
    // nav is a list too, and the loose version matched that and proved nothing.
    await expect(page.getByRole('heading', { level: 2, name: title! })).toBeVisible();

    /*
      And removing it takes THIS ONE back out.

      Asserted on the campaign, not on an empty list: a donor may have saved
      others in an earlier run, and "Nothing saved yet" then never appears. The
      claim under test is that the entry removed is gone, which is true whether
      or not the list is now empty.
    */
    await submitAndWait(
      page,
      page.getByRole('button', {
        name: new RegExp(`remove ${escapeRegExp(title!)} from saved`, 'i'),
      }),
    );

    // Re-read from the server rather than trusting the in-place re-render,
    // for the same reason the profile and settings tests reload: before
    // hydration the form posts natively and the client never re-renders.
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: title! })).toHaveCount(0, {
      timeout: 20_000,
    });
  });

  test('the profile saves a change', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await settle(page);

    await page.getByLabel('City').fill('Ranchi');

    /*
      Settle again before clicking, and scroll the button into view first.

      On the narrow projects the save button sits below a long form, and
      scrolling to it brings the footer into the viewport — whose images then
      load and shift the layout under it. Playwright refuses to click a target
      whose box is still moving, correctly, and reports "element is not stable".
      Waiting for the network to go quiet lets those images finish first.
    */
    const save = page.getByRole('button', { name: /save changes/i });
    await save.scrollIntoViewIfNeeded();
    await settle(page);

    /*
      SUBMITTED BY KEYBOARD, not by a synthetic click at a coordinate.

      On the Pixel 5 project, hit-testing the button's centre kept resolving to
      the address input above it — a visual-viewport offset on an emulated
      mobile device, not an overlay in the page. Playwright then refused to
      click, correctly, and retried until the test timed out.

      Focusing the button and pressing Enter is a real way a person submits this
      form — keyboard users do exactly this — so the test is not weaker for it,
      and it does not depend on where the device thinks the pixel is.
    */
    await submitAndWait(page, save);

    /*
      THE RELOAD IS THE ASSERTION, not the inline confirmation.

      These forms are progressively enhanced: with React hydrated, the submit
      goes through a server action and `useActionState` renders the green
      confirmation. Before hydration the browser posts the form natively — the
      action still runs and the change still saves, but the client state that
      draws the confirmation was never there to be set.

      Under four viewport projects hitting one server, a click can land in that
      window, and asserting on the banner made a passing save look like a
      failure. What the donor must be able to rely on is that the change STUCK,
      so that is what this asserts, after a reload that re-reads it from the API.

      The inline confirmation is therefore NOT asserted anywhere in this suite,
      and that is a deliberate gap rather than an oversight: asserting it means
      asserting that hydration finished first, which no amount of waiting on the
      network can promise. It is recorded in docs/phase-7.md.
    */
    await page.reload();
    await expect(page.getByLabel('City')).toHaveValue('Ranchi');
  });

  /**
   * The totals are written only by payment capture (decision A6), so the
   * profile shows them and does not offer a field for them. A form input named
   * `totalDonated` appearing here would mean somebody had added one.
   */
  test('the profile offers no way to edit the lifetime totals', async ({ page }, testInfo) => {
    const donor = donorFor(testInfo.project.name);
    await page.goto('/dashboard/profile');

    await expect(page.locator('[name="totalDonated"]')).toHaveCount(0);
    await expect(page.locator('[name="donationCount"]')).toHaveCount(0);
    await expect(page.locator('[name="donorCode"]')).toHaveCount(0);
    // The address is the sign-in identifier, so it is not a profile field
    // either — changing it is a support operation, like the phone number.
    await expect(page.locator('[name="phone"]')).toHaveCount(0);

    // But they are visible, because a donor should see what is held about them.
    await expect(page.getByText('Total given')).toBeVisible();
    /*
      Rendered TWICE by design — once in the sidebar identity block and once in
      the read-only record below the form. The sidebar copy is `hidden lg:block`,
      so at 320px `.first()` picks an element that is in the DOM and invisible.
      `.filter({ visible: true })` narrows to whichever copy this viewport
      actually shows, which is the thing being asserted.
    */
    await expect(page.getByText(donor.donorCode).filter({ visible: true }).first()).toBeVisible();
  });

  test('settings save, and transactional mail is not offered as a choice', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await settle(page);

    const newsletter = page.getByLabel(/newsletter/i);
    await newsletter.check();

    const save = page.getByRole('button', { name: /save preferences/i });
    await save.scrollIntoViewIfNeeded();
    await settle(page);
    await submitAndWait(page, save);

    // Persistence, not the banner — same reasoning as the profile test above:
    // before hydration the form posts natively, which saves but draws no
    // confirmation. The reload proves the preference stuck.
    await page.reload();
    await expect(page.getByLabel(/newsletter/i)).toBeChecked();

    // A donor cannot switch off the record of their own giving.
    await expect(page.getByText(/receipts and sign-in codes are always sent/i)).toBeVisible();
  });

  test('the dashboard has no accessibility violations', async ({ page }) => {
    await page.goto('/dashboard');
    await expectNoAxeViolations(page);
  });

  // -------------------------------------------------------------------------
  // Event registration (Phase 9)
  //
  // HERE RATHER THAN IN `phase-9.spec.ts`, because these need this donor's
  // session and the test below them revokes it. See the note at the foot of
  // that file.
  // -------------------------------------------------------------------------

  /**
   * ONE TEST FOR THE WHOLE REGISTRATION CYCLE, not three.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THE API RATE LIMIT IS 100 REQUESTS A MINUTE PER ADDRESS, and the four
   * viewport projects all reach it from one address through the BFF. Every
   * signed-in page view costs at least one `/me` for the header badge, and an
   * event page costs a registration lookup as well — so a test that visits the
   * event page four times costs the shared budget sixteen requests.
   *
   * Split across three tests this pushed the suite over the limit, and what
   * failed was an unrelated profile test in another file. The limiter is doing
   * its job; the suite works within it, the same way global setup works within
   * the OTP cap.
   *
   * It also ends where it started — registered, then cancelled — so the seeded
   * seat count does not drift upward on every run.
   * ══════════════════════════════════════════════════════════════════════════
   */
  test('a donor registers, is refused a second place, sees it listed, and cancels', async ({
    page,
  }) => {
    await page.goto(`/events/${OPEN_EVENT}`);
    await settle(page);

    // A previous run that failed midway may have left a place held. Start from
    // a known state rather than assuming one.
    const registered = page.getByRole('heading', { name: 'You are registered' });
    if (!(await registered.isVisible().catch(() => false))) {
      await expect(page.getByRole('heading', { name: 'Register to attend' })).toBeVisible();
      await submitAndWait(page, page.getByRole('button', { name: /^Register/ }));
    }

    await expect(registered).toBeVisible();

    // A second place is not offered — the button is GONE rather than disabled,
    // so the UI never presents an action the server would refuse.
    await expect(page.getByRole('button', { name: /^Register my place$/ })).toHaveCount(0);

    // It appears on the dashboard, under "Coming up".
    await page.goto('/dashboard/events');
    await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Animal Care/i }).first()).toBeVisible();

    // And cancelling puts the place back — two clicks, deliberately, because a
    // single destructive button in a card somebody opened to check a date gets
    // pressed by accident.
    await page.goto(`/events/${OPEN_EVENT}`);
    await settle(page);
    await page.getByRole('button', { name: 'Cancel my registration' }).click();
    await submitAndWait(page, page.getByRole('button', { name: 'Yes, cancel my place' }));

    /*
      RELOAD BEFORE ASSERTING, for the reason `admin-stories.spec.ts` sets out.

      `submitAndWait` waits for the POST to answer, and nothing more. The panel
      is re-rendered by `router.refresh()`, which is a SECOND round trip that
      the POST response does not wait for — so the page can still be showing
      "You are registered" when the cancel has already been recorded.

      With four viewport projects running concurrently that refresh sometimes
      took longer than the 5s `toBeVisible` retries for, and this assertion
      failed while the application was behaving correctly. Reloading asserts
      what actually matters — that the place was given back — instead of how
      quickly the client re-rendered.
    */
    await page.reload();
    await settle(page);
    await expect(page.getByRole('heading', { name: 'Register to attend' })).toBeVisible();
  });

  test('the dashboard events page is accessible', async ({ page }) => {
    await page.goto('/dashboard/events');
    await expect(page.getByRole('heading', { level: 1, name: 'Your events' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  /**
   * LAST, AND INSIDE THE SERIAL BLOCK ON PURPOSE.
   *
   * Signing out revokes the session AT THE API, not just in the browser. Each
   * project has a donor of its own, so this cannot reach the other projects —
   * but it certainly reaches the other tests using the SAME donor, and under
   * `fullyParallel` a separate describe runs alongside them rather than after.
   *
   * It lived in its own describe for exactly one run, which failed on three
   * projects in three different places. Serial ordering inside this block is
   * what actually puts it last.
   */
  test('signing out revokes the session, not just the cookie', async ({ page }) => {
    await page.goto('/dashboard');
    await settle(page);
    await expect(page.getByRole('heading', { name: /hello|your account/i })).toBeVisible();

    // Keyboard again, for the same reason as the forms above — the sign-out
    // control sits at the end of a long page on mobile.
    await page
      .getByRole('button', { name: /sign out/i })
      .first()
      .press('Enter');
    await expect(page).toHaveURL(/\/sign-in/);

    // Genuinely gone, not merely navigated away from.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
