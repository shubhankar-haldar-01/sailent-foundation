import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { settleAnimations } from './settle-animations';

import { E2E_POST } from './global-setup';

/**
 * Critical public journeys.
 *
 * These follow the eight paths named in the Phase 2 brief. They assert that a
 * visitor can get from the homepage to each destination and that the
 * destination is genuinely usable — not merely that a route returns 200.
 *
 * No payment is exercised: the donation flow stops at the point where Phase 5
 * takes over.
 */

async function expectNoAxeViolations(page: Page) {
  // Audit the page people read, not a frame of its entrance: the same WCAG
  // checks, run once the cards have finished fading in (see the helper).
  await settleAnimations(page);

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

/** The nav collapses below lg, so link-following differs by viewport. */
/**
 * The donation total appears on two surfaces: a sticky rail on desktop, and a
 * collapsed bottom bar on mobile that expands into the full itemisation. Both
 * are correct; which one is visible depends on the viewport.
 *
 * Asserting on "the first match" breaks because the hidden surface is still in
 * the DOM, so this checks that the amount is visible SOMEWHERE — which is the
 * behaviour that actually matters to a donor.
 */
/**
 * Wait for client components to hydrate before interacting.
 *
 * The donation builder is server-rendered, so its markup — and therefore its
 * buttons — are visible and clickable BEFORE React has attached handlers. A
 * click in that window is silently swallowed, which shows up as a flaky test
 * with no error. Waiting for the network to settle is the practical signal
 * that the page chunks have loaded and run.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
}

async function expectAmountVisible(page: Page, amount: string) {
  // `.filter({ visible: true })` narrows the matched set. Chaining
  // `.locator('visible=true')` instead would look for a visible DESCENDANT,
  // and these amounts are leaf nodes — so it never matches.
  await expect(
    page.getByText(amount, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
}

async function navigateTo(page: Page, label: string | RegExp, href: string) {
  const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (!isDesktop) {
    await page.goto(href);
    return;
  }
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: label })
    .click();
  await page.waitForURL(`**${href}`);
}

test.describe('journey: homepage → campaign', () => {
  test('a visitor can reach a campaign and see its progress and products', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await navigateTo(page, 'Campaigns', '/campaigns');
    await expect(
      page.getByRole('heading', { level: 1, name: /support causes that create real change/i }),
    ).toBeVisible();

    // Follow the first campaign through to its detail page, by its title.
    await page
      .getByRole('list', { name: 'Campaigns' })
      .getByRole('heading')
      .first()
      .getByRole('link')
      .click();
    await page.waitForURL('**/campaigns/**');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    /*
      PROGRESS PER PRODUCT, AND FOR THE CAMPAIGN.

      Each item states its own — "354 / 500 Donated, 71%" — which is the
      figure that decides whether somebody buys that item. Both counts are
      asserted, not just the percentage: 1% of 500 and 1% of 5 are very
      different asks, and a bare percentage hides which one this is. The
      donation card adds the campaign's own "46% Complete" against its goal.
    */
    await expect(page.getByText(/^[\d,]+ \/ [\d,]+ Donated$/).first()).toBeVisible();
    await expect(page.getByText(/^\d+%$/).first()).toBeVisible();
    await expect(
      page
        .getByText(/^\d+% Complete$/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });
});

/**
 * The featured band moves on its own, so it must still be stoppable.
 *
 * Its visible pause button was removed at the client's request; WCAG 2.2.2
 * (Level A) still needs a way to stop it that works without a pointer. This
 * holds that line: the control is present, out of sight until it is tabbed to,
 * and it pauses the rail.
 */
test.describe('featured campaigns rail', () => {
  test('keyboard users can still pause it', async ({ page }) => {
    await page.goto('/');
    const pause = page.getByRole('button', { name: 'Pause featured campaigns' });
    await expect(pause).toHaveCount(1);

    // Nothing for a pointer to see…
    expect(await pause.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);

    // …until it is reached from the keyboard, as the stop before "View All".
    await page.getByRole('link', { name: 'View All Campaigns' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(pause).toBeFocused();
    expect(await pause.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(40);

    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Play featured campaigns' })).toHaveCount(1);
  });
});

/**
 * The testimonials move on their own too, with the same obligation: their
 * arrows were removed at the client's request, so the keyboard pause is what
 * keeps the band stoppable (WCAG 2.2.2).
 */
test.describe('testimonials rail', () => {
  test('has no arrows, and keyboard users can pause it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('list', { name: 'Testimonials, scrollable' })).toBeVisible();
    await expect(page.getByRole('button', { name: /(Previous|Next) testimonials/ })).toHaveCount(0);

    const pause = page.getByRole('button', { name: 'Pause testimonials' });
    await expect(pause).toHaveCount(1);
    expect(await pause.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);

    await pause.focus();
    expect(await pause.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(40);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Play testimonials' })).toHaveCount(1);
  });
});

/**
 * The campaigns page's grid, added to the homepage before "Who we are".
 *
 * It sits BESIDE the featured band rather than replacing it, so both have to
 * be on the page — and its tiles must narrow only its own cards.
 */
test.describe('homepage campaigns grid', () => {
  const grid = (page: Page) => page.getByRole('list', { name: 'Campaigns by cause' });
  const tiles = (page: Page) => page.getByRole('group', { name: 'Filter campaigns by cause' });

  test('sits beside the featured band, before "Who we are"', async ({ page }) => {
    await page.goto('/');
    await expect(grid(page).getByRole('listitem').first()).toBeVisible();

    // The featured band is still there; the focus-area strip under the hero
    // was removed at the client's request.
    await expect(page.getByRole('heading', { name: /What we work on/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Make a Real Difference' })).toBeVisible();
    await expect(page.getByRole('list', { name: /Featured campaigns/i })).toBeVisible();

    // Two rows of four at most, and it comes before "Who we are".
    expect(await grid(page).getByRole('listitem').count()).toBeLessThanOrEqual(8);
    const gridBox = await grid(page).boundingBox();
    const aboutBox = await page.getByRole('heading', { name: 'Who We Are' }).boundingBox();
    expect(gridBox?.y ?? Infinity).toBeLessThan(aboutBox?.y ?? -Infinity);
  });

  test('its tiles are toggles, and each change is announced', async ({ page }) => {
    await page.goto('/');
    const cards = grid(page).getByRole('listitem');
    await expect(cards.first()).toBeVisible();
    const all = await cards.count();
    const live = page.locator(
      'section[aria-labelledby="campaign-showcase-title"] [aria-live="polite"]',
    );

    const education = tiles(page).getByRole('button', { name: /^Education/ });
    await education.click();
    await expect(education).toHaveAttribute('aria-pressed', 'true');
    await expect(cards).toHaveCount(1);
    await expect(live).toHaveText(/Showing 1 Education campaign\./);

    // Pressing it again is the way back to every campaign.
    await education.click();
    await expect(education).toHaveAttribute('aria-pressed', 'false');
    await expect(cards).toHaveCount(all);
  });

  test('its tiles narrow its own cards, and View More carries the cause', async ({ page }) => {
    await page.goto('/');
    const featured = page.getByRole('list', { name: /Featured campaigns/i }).getByRole('listitem');
    await expect(featured.first()).toBeVisible();
    const featuredBefore = await featured.count();

    await tiles(page)
      .getByRole('button', { name: /^Women Empowerment/ })
      .click();
    await expect(grid(page).getByRole('listitem')).toHaveCount(1);
    // The band above keeps its own selection.
    await expect(featured).toHaveCount(featuredBefore);

    const more = page.getByRole('link', { name: /View More Women Empowerment Campaigns/ });
    await expect(more).toHaveAttribute('href', '/campaigns?category=women-empowerment');
  });
});

/**
 * The campaign listing: search, causes and the cards themselves.
 *
 * Every filter is a URL the server renders, so these assert on the address as
 * well as on what is drawn — a filter that changed the grid but not the URL
 * would not survive a refresh or a shared link.
 */
test.describe('campaign listing', () => {
  const grid = (page: Page) => page.getByRole('list', { name: 'Campaigns' }).getByRole('listitem');
  const cause = (page: Page, name: string | RegExp) =>
    page.getByRole('navigation', { name: 'Filter campaigns by cause' }).getByRole('link', { name });

  test('searches through the API, and says so when nothing matches', async ({ page }) => {
    await page.goto('/campaigns');
    await page.getByRole('searchbox', { name: 'Search campaigns' }).fill('school');
    await page.getByRole('searchbox', { name: 'Search campaigns' }).press('Enter');

    await page.waitForURL(/\/campaigns\?q=school$/);
    await expect(grid(page)).toHaveCount(1);
    await expect(grid(page).first()).toContainText(/Educate Rural Children/i);

    // The search travels with a cause, and an empty result is a state, not a blank.
    await cause(page, /Healthcare/).click();
    await page.waitForURL(/q=school&category=healthcare/);
    await expect(page.getByText('No campaigns found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View All Campaigns' })).toHaveAttribute(
      'href',
      '/campaigns',
    );
  });

  test('each card states its figures and offers one way to give', async ({ page }) => {
    await page.goto('/campaigns');
    const card = grid(page).first();

    for (const term of ['Donors', 'Raised', 'Goal']) {
      await expect(card.getByRole('term').filter({ hasText: term })).toBeVisible();
    }
    await expect(card.getByRole('img', { name: /% of the ₹[\d,]+ goal raised/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /Donate Now/ })).toHaveAttribute(
      'href',
      /^\/campaigns\/[a-z0-9-]+#give$/,
    );
  });

  test('the status menu offers closed campaigns, and filters to them', async ({ page }) => {
    await page.goto('/campaigns');
    const menu = page.getByRole('combobox', { name: 'Show campaigns' });
    await expect(menu).toContainText('Active Campaigns');

    await menu.click();
    await expect(page.getByRole('option')).toHaveText([
      /Active Campaigns/,
      /Closed Campaigns/,
      /Completed Campaigns/,
      /All Campaigns/,
    ]);
    await page.getByRole('option', { name: /Closed Campaigns/ }).click();

    await page.waitForURL(/\/campaigns\?status=closed$/);
    await expect(menu).toContainText('Closed Campaigns');
  });

  test('every card says which state it is in, in every view', async ({ page }) => {
    await page.goto('/campaigns?status=all');
    await expect(grid(page).filter({ hasText: 'Status: Completed' })).toHaveCount(1);
    await expect(grid(page).filter({ hasText: 'Status: Active' }).first()).toBeVisible();

    // The default Active view badges its cards too, not only the mixed one.
    await page.goto('/campaigns');
    const cards = grid(page);
    await expect(cards.first()).toBeVisible();
    await expect(cards.filter({ hasText: 'Status: Active' })).toHaveCount(await cards.count());

    await page.goto('/campaigns?status=completed');
    await expect(grid(page).filter({ hasText: 'Status: Completed' }).first()).toBeVisible();
  });

  test('the save heart is shown signed out, and leads to sign-in', async ({ page }) => {
    await page.goto('/campaigns');
    const heart = grid(page)
      .first()
      .getByRole('link', { name: /^Sign in to save / });
    await expect(heart).toHaveAttribute('href', /^\/sign-in\?next=%2Fcampaigns/);
  });
});

/**
 * The partner strip scrolls itself continuously, which makes it the second
 * piece of the homepage that can break without a screenshot showing anything.
 */
test.describe('partner strip', () => {
  const strip = (page: Page) => page.locator('.marquee');

  /*
    ══════════════════════════════════════════════════════════════════════════
    DORMANT WHILE THERE ARE NO PARTNERS, NOT DELETED.

    The list was emptied on 25 September 2026 because nobody could confirm the
    eight supplied marks were real partners or that they could be used, so the
    section renders nothing and every assertion below has no subject.

    The COMPONENT still ships — `partners` is one of the nine types the section
    composer offers — so it will render again the day a confirmed partner is
    added, and these tests are what stop it coming back broken. They skip on
    the absence of the strip rather than on a hard-coded expectation, so they
    wake up on their own.

    The band's absence is not left untested: `never shows an unverified partner
    mark` below asserts it directly, and fails if logos reappear.
    ══════════════════════════════════════════════════════════════════════════
  */
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    test.skip(
      (await strip(page).count()) === 0,
      'No partners are configured, so the band does not render.',
    );
  });

  /** The animated offset of the first group, in CSS pixels. */
  const offset = (page: Page) =>
    strip(page)
      .locator('> ul')
      .first()
      .evaluate((el) => Math.round(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));

  async function settle(page: Page) {
    await page.goto('/');
    await strip(page).scrollIntoViewIfNeeded();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
  }

  test('scrolls on its own and pauses under the pointer', async ({ page }) => {
    await settle(page);
    const start = await offset(page);
    await expect.poll(() => offset(page), { timeout: 8_000 }).not.toBe(start);

    // Hover pauses in CSS alone, so this holds even if the bundle never lands.
    await strip(page).hover();
    const held = await offset(page);
    await page.waitForTimeout(2_500);
    expect(await offset(page)).toBe(held);
  });

  /**
   * WCAG 2.2.2 (Level A). This fails if somebody removes the control.
   *
   * It is deliberately NOT visible chrome — it sits transparent and out of the
   * layout until it takes focus. So the assertions are about what the
   * requirement actually asks for: that the mechanism exists, is announced, is
   * reachable by keyboard, and works.
   */
  test('keeps a keyboard-reachable pause control that actually stops it', async ({ page }) => {
    await settle(page);

    const pause = page.getByRole('button', { name: /Pause the scrolling list of partners/i });

    // In the accessibility tree and operable, though not painted.
    await expect(pause).toBeAttached();
    await expect(pause).toBeEnabled();

    // Reachable by keyboard, and revealed once it gets there.
    await pause.focus();
    await expect(pause).toBeFocused();
    await expect(pause).toHaveCSS('opacity', '1');

    await pause.press('Enter');
    await page.mouse.move(5, 5);
    // Blur, or `focus-within` would be what is holding the strip still.
    await page.locator('h1').first().focus();

    const stopped = await offset(page);
    await page.waitForTimeout(3_000);
    expect(await offset(page)).toBe(stopped);

    await expect(
      page.getByRole('button', { name: /Resume the scrolling list of partners/i }),
    ).toBeAttached();
  });

  test('shows no pause button in the layout', async ({ page }) => {
    await settle(page);

    // The visual design carries no control. Transparent and out of flow, so it
    // takes no space in the row and nothing can be clicked by accident.
    const pause = page.getByRole('button', { name: /scrolling list of partners/i });
    await expect(pause).toHaveCSS('opacity', '0');
    await expect(pause).toHaveCSS('pointer-events', 'none');
  });

  test('loops without a seam, and never widens the page', async ({ page }) => {
    await settle(page);

    // Daylight at either edge would mean the hand-over between the two groups
    // is landing short — a stutter once per cycle.
    for (let sample = 0; sample < 12; sample += 1) {
      await page.waitForTimeout(250);
      const gap = await strip(page).evaluate((el) => {
        const box = el.getBoundingClientRect();
        const marks = [...el.querySelectorAll('img')].map((mark) => mark.getBoundingClientRect());
        if (marks.length === 0) return 0;
        return Math.round(
          Math.max(
            Math.min(...marks.map((mark) => mark.left)) - box.left,
            box.right - Math.max(...marks.map((mark) => mark.right)),
          ),
        );
      });
      expect(gap).toBeLessThanOrEqual(1);
    }
  });

  test('names each partner once, not twice', async ({ page }) => {
    await settle(page);

    // The seam copy must be hidden from assistive technology, or a screen
    // reader announces all eight partners over again.
    const exposed = await strip(page).evaluate(
      (el) => el.querySelectorAll('ul:not([aria-hidden="true"]) img').length,
    );
    const total = await strip(page).evaluate((el) => el.querySelectorAll('img').length);

    expect(exposed).toBeGreaterThan(0);
    expect(total).toBe(exposed * 2);
  });

  test('falls back to a static wrapping row under reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await settle(page);

    // `innerWidth` is read INSIDE the page. `page.viewportSize()` is a
    // Playwright API and does not exist in the browser context, so calling it
    // here throws rather than failing the assertion it was meant to make.
    const state = await strip(page).evaluate((el) => {
      const first = el.querySelector('ul')!;
      const marks = [...first.querySelectorAll('img')];
      return {
        animation: getComputedStyle(first).animationName,
        // A paused marquee still clips. Anyone who asked for less motion would
        // lose every logo past the right edge, so the clipping has to go too.
        overflow: getComputedStyle(el).overflow,
        onScreen: marks.filter((mark) => {
          const box = mark.getBoundingClientRect();
          return box.left >= -1 && box.right <= window.innerWidth + 1;
        }).length,
        total: marks.length,
      };
    });

    expect(state.animation).toBe('none');
    expect(state.overflow).toBe('visible');
    expect(state.onScreen).toBe(state.total);

    // Nothing is moving, so a control to stop it would be a lie.
    await expect(page.getByRole('button', { name: /scrolling list of partners/i })).toHaveCount(0);

    await context.close();
  });
});

/**
 * The pair to the skip guarding the block above: that one lets the strip's
 * tests stand down while there is nothing to test, this one makes sure the
 * reason stays true.
 */
test.describe('partner claims', () => {
  test('never shows an unverified partner mark', async ({ page }) => {
    await page.goto('/');

    /*
      A logo on a partner strip is a claim that the organization endorses us.
      The eight that used to sit in this band — UNICEF, the WHO, Microsoft and
      the rest — were supplied with the design and never confirmed, and the
      visitor most likely to recognise them is the one deciding whether to
      trust us with money.

      The assertion is on the HEADING rather than the images, because an empty
      list has to take the whole section with it: a titled band with nothing
      under it would be its own defect.
    */
    await expect(page.getByRole('heading', { name: /Partners & Supporters/i })).toHaveCount(0);
  });
});

test.describe('journey: campaign → donation UI', () => {
  test('products can be selected and the total updates', async ({ page }) => {
    await page.goto('/campaigns/school-kits-jharkhand');

    /*
      The products come straight after the campaign's facts, so there is no
      in-page "Donate now" anchor to follow — the ask is the first section
      rather than a builder somebody has to scroll down to find.
    */
    await expect(page.getByRole('heading', { name: 'Choose How You Want to Help' })).toBeVisible();
    await settle(page);

    // Add one School Kit and confirm the summary reflects it.
    await page
      .getByRole('button', { name: /Add one School Kit/i })
      .first()
      .click();

    // One School Kit at ₹900 — the line total appears on whichever summary
    // surface this viewport shows.
    await expectAmountVisible(page, '₹900');
  });

  test('hybrid giving combines products and a custom amount', async ({ page }) => {
    await page.goto('/campaigns/school-kits-jharkhand#give');
    await settle(page);

    await page
      .getByRole('button', { name: /Add one School Kit/i })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Add one School Kit/i })
      .first()
      .click();
    /*
      PICKED FROM A PRESET — and the smallest is chosen on arrival.

      The donation card offers round amounts as buttons beside the total, and
      opens with ₹500 already pressed, so the products are added on top of it.
      On a phone the card is in the page, after the ways of giving.
    */
    await expect(
      page
        .getByRole('group', { name: 'Add an Amount' })
        .filter({ visible: true })
        .first()
        .getByRole('button', { name: '₹500', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    // 2 × ₹900 + ₹500 = ₹2,300, shown with Indian digit grouping.
    await expectAmountVisible(page, '₹2,300');
  });

  test('continue is disabled until something is selected, with the reason stated', async ({
    page,
  }) => {
    await page.goto('/campaigns/school-kits-jharkhand#give');
    await settle(page);

    /*
      The card opens with ₹500 chosen, so "nothing selected" means taking it
      off first — in the side column on a desktop, in the page on a phone.
    */
    await page
      .getByRole('group', { name: 'Add an Amount' })
      .filter({ visible: true })
      .first()
      .getByRole('button', { name: '₹500', exact: true })
      .click();

    // At every width, the card says what to do rather than only greying the
    // button out, and the action itself is unavailable until there is
    // something to give.
    await expect(
      page.getByText('Choose an item above, or pick an amount below.').filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Donate( ₹[\d,.]+)?$/ }).filter({ visible: true }),
    ).toBeDisabled();
  });
});

test.describe('journey: homepage → volunteer', () => {
  test('the application form is reachable and validates', async ({ page }) => {
    await page.goto('/');
    await page.goto('/volunteer');

    await expect(page.getByRole('heading', { level: 1, name: /give time/i })).toBeVisible();

    await page.getByRole('link', { name: 'Apply to volunteer' }).click();
    await expect(page.getByRole('heading', { name: 'Personal details' })).toBeVisible();
    await settle(page);

    // Submitting empty must surface per-field errors, not a generic failure.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Enter your full name')).toBeVisible();
  });
});

test.describe('journey: homepage → programs', () => {
  test('a program detail page shows goals, activities and related campaigns', async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, 'Programs', '/programs');

    /*
      SCOPED TO `main`, and to the programme's own href.

      An unscoped `.first()` matched the FOOTER's "Education" link — which goes
      to `/campaigns?categorySlug=education` — and the test then waited for a
      programme URL that was never coming. The footer carries a link of the same
      name on every page, so "the first Education link in the document" was
      never a reliable way to name the programme card.
    */
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Education' })
      .filter({ has: page.locator('[href="/programs/education"]') })
      .or(page.getByRole('main').locator('a[href="/programs/education"]'))
      .first()
      .click();
    await page.waitForURL('**/programs/education');

    await expect(page.getByRole('heading', { level: 1, name: 'Education' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible();
  });
});

test.describe('journey: homepage → stories', () => {
  test('a story renders the five-part structure', async ({ page }) => {
    await page.goto('/stories');
    await page
      .getByRole('link', { name: /A New Beginning for Meera/i })
      .first()
      .click();
    await page.waitForURL('**/stories/**');

    await expect(page.getByRole('heading', { name: 'The challenge' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What we did' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The outcome' })).toBeVisible();
  });
});

test.describe('journey: homepage → events', () => {
  test('an event shows its details and a registration form', async ({ page }) => {
    await page.goto('/events');
    await expect(
      page.getByRole('heading', { level: 1, name: /come and see the work/i }),
    ).toBeVisible();

    await page
      .getByRole('link', { name: /Community Clean-up Drive/i })
      .first()
      .click();
    await page.waitForURL('**/events/**');

    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Register to attend|Join the waitlist/ }),
    ).toBeVisible();
  });
});

test.describe('journey: homepage → blog', () => {
  test('an article renders with a named author and semantic markup', async ({ page }) => {
    /*
      THE ARTICLE IS A REAL ROW NOW, not one of eight invented posts.

      This used to open "Why we publish" by a "Head of Programs" — both from
      `lib/mock/blog.ts`, which Phase 10.7 deleted. The post it opens is seeded
      by `global-setup.ts` into the isolated E2E database and authored by the
      E2E staff user, so the byline below is a real `users` row rather than a
      string somebody typed into a fixture file.
    */
    await page.goto('/blog');
    await page
      .getByRole('link', { name: new RegExp(E2E_POST.title, 'i') })
      .first()
      .click();
    await page.waitForURL('**/blog/**');

    await expect(page.locator('article')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: E2E_POST.title })).toBeVisible();

    // The author must be a real person, never "Admin".
    await expect(page.getByText('End-to-end Staff').first()).toBeVisible();

    /*
      And the body is rendered as SEMANTIC MARKUP, not a wall of text.

      Matched by NAME rather than by tag: the renderer deliberately shifts an
      article's own `##` down to `<h3>`, because the page title is the `h1` and
      a document with two `h1`s is both a heading-order failure for a screen
      reader and a muddled signal for a crawler. Asserting `article h2` was
      asserting the renderer did the wrong thing.
    */
    await expect(page.getByRole('heading', { name: 'What is in a kit' })).toBeVisible();
    await expect(page.locator('article ul li').first()).toBeVisible();
    await expect(page.locator('article blockquote')).toBeVisible();
  });
});

test.describe('journey: about → registration', () => {
  /**
   * The registration identifiers, and the guard that matters most on them.
   *
   * These used to live on `/transparency`, alongside lists of published
   * documents. That page and `/reports` were both removed — the platform keeps
   * documents admin-only — but the identifiers could not go with them: a donor
   * claiming relief under Section 80G needs the registration number, and
   * "verify us against the public register" is the most useful thing an NGO
   * site offers someone deciding whether to give. They sit on About now.
   */
  test('about carries the identifiers a donor can verify us by', async ({ page }) => {
    await page.goto('/about');

    await expect(
      page.getByRole('heading', { level: 2, name: /check us before you give/i }),
    ).toBeVisible();
    await expect(page.getByText('Section 80G registration')).toBeVisible();
    await expect(page.getByText('Section 12A registration')).toBeVisible();
  });

  test('registration identifiers are unmistakably marked as dummy values', async ({ page }) => {
    // The single most damaging thing a demo build could get wrong is publishing
    // a registration number that looks genuine. The identifiers are filled in
    // so the page can be reviewed complete, so the guard is not "are they
    // absent" but "is every one of them obviously fake".
    await page.goto('/about');
    const body = await page.locator('body').innerText();

    const panLike = body.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g) ?? [];
    for (const candidate of panLike) {
      expect(candidate, `${candidate} must carry a DEMO marker`).toContain('DEMO');
    }

    // And the page says so in words, not just in the identifiers.
    await expect(page.getByText(/dummy value/i).first()).toBeVisible();
  });

  /**
   * The public site must not offer a document library at all.
   *
   * `/reports` and `/transparency` are gone and nothing links to them. This
   * fails if either comes back, or if a nav entry starts pointing at one again.
   */
  test('publishes no public document library', async ({ page }) => {
    for (const path of ['/reports', '/transparency']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} must not exist`).toBe(404);
    }

    await page.goto('/');
    await expect(page.getByRole('link', { name: /^reports?$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^transparency$/i })).toHaveCount(0);
  });
});

test.describe('site-wide quality', () => {
  const pages = [
    { path: '/', name: 'homepage' },
    { path: '/campaigns', name: 'campaign listing' },
    { path: '/campaigns/school-kits-jharkhand', name: 'campaign detail' },
    { path: '/programs/education', name: 'program detail' },
    { path: '/stories/sunita-finished-school', name: 'story detail' },
    { path: '/donate', name: 'donate' },
    { path: '/volunteer', name: 'volunteer' },
    { path: '/impact', name: 'impact' },
    { path: '/faq', name: 'faq' },
    { path: '/contact', name: 'contact' },
    { path: '/team', name: 'team' },
    { path: '/blog', name: 'blog' },
    { path: '/events', name: 'events' },
    { path: '/search', name: 'search' },
    { path: '/about', name: 'about' },
  ];

  for (const entry of pages) {
    test(`${entry.name} has no horizontal scroll`, async ({ page }) => {
      await page.goto(entry.path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflows).toBe(false);
    });
  }

  /**
   * One test, fourteen page loads.
   *
   * The default 30s budget is for a test that does one thing. This walks the
   * whole site, and on the tablet project — the slowest, because its 2× pixel
   * ratio means the image optimiser is serving the largest variants — a busy
   * run tips it over. It was timing out intermittently on tablet alone, which
   * reads as a flake and is really a test asking for more than it was given.
   */
  /**
   * Every internal link goes somewhere.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * This exists because six of them did not.
   *
   * The donor account navigation listed Donations, Recurring, Receipts,
   * Campaigns supported, Impact and Profile, and every one was a 404 — pages
   * that were planned, never built, and left in the menu. Nothing caught it,
   * because each individual page test only visited pages that existed.
   *
   * A navigation item is a promise that there is something at the other end.
   * This walks the links the site actually renders and checks each one, so the
   * next broken promise fails here rather than in front of a donor.
   * ══════════════════════════════════════════════════════════════════════════
   */
  test('every internal link resolves', async ({ page }) => {
    test.slow();

    const seen = new Map<string, string[]>();

    for (const entry of pages) {
      await page.goto(entry.path);
      const hrefs = await page.$$eval('a[href^="/"]', (anchors) =>
        anchors.map((anchor) => anchor.getAttribute('href') ?? ''),
      );

      for (const href of hrefs) {
        // Fragments and query strings resolve to the same route.
        const route = href.split('#')[0]!.split('?')[0]!;
        if (!route || route === '/') continue;
        seen.set(route, [...(seen.get(route) ?? []), entry.name]);
      }
    }

    const broken: string[] = [];
    for (const [route, from] of seen) {
      const response = await page.goto(route, { waitUntil: 'commit' });
      const status = response?.status() ?? 0;
      if (status >= 400)
        broken.push(`${route} → ${status} (linked from ${[...new Set(from)].join(', ')})`);
    }

    expect(broken, `broken internal links:\n${broken.join('\n')}`).toEqual([]);
  });

  test('every page has exactly one h1', async ({ page }) => {
    test.slow();
    for (const entry of pages) {
      await page.goto(entry.path);

      /*
        `toHaveCount` RETRIES; `count()` takes one instantaneous snapshot.

        This used `expect(await …count()).toBe(1)`, which asks the DOM the
        question once, the moment `goto` resolves. Under four viewport projects
        against one server that occasionally landed a beat early and reported
        zero — on a different page each run, which is the signature of a race
        rather than a missing heading.

        The assertion is unchanged in what it rejects: zero h1s still fails, and
        so do two.
      */
      await expect(
        page.getByRole('heading', { level: 1 }),
        `${entry.name} should have exactly one h1`,
      ).toHaveCount(1);
    }
  });

  test('every page has a unique title and a canonical URL', async ({ page }) => {
    // Same fourteen page loads as the h1 sweep above.
    test.slow();
    const titles = new Set<string>();
    for (const entry of pages) {
      await page.goto(entry.path);
      const title = await page.title();
      expect(title, `${entry.name} needs a title`).toBeTruthy();
      expect(titles.has(title), `${entry.name} title is not unique`).toBe(false);
      titles.add(title);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    }
  });
});

test.describe('accessibility', () => {
  const auditPages = [
    '/',
    '/campaigns',
    '/campaigns/school-kits-jharkhand',
    '/programs/education',
    '/stories/sunita-finished-school',
    '/donate',
    '/volunteer',
    '/impact',
    '/faq',
    '/contact',
    '/blog/why-we-publish-what-did-not-work',
    '/events/volunteer-orientation-october',
  ];

  for (const path of auditPages) {
    test(`${path} has no detectable violations`, async ({ page }) => {
      await page.goto(path);
      await expectNoAxeViolations(page);
    });
  }
});
