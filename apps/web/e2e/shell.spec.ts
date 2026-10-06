import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { settleAnimations } from './settle-animations';

/**
 * Phase 1 covers the application shells and the responsive/accessibility
 * foundation, not business flows. Those arrive with the modules that own them.
 */

async function expectNoAxeViolations(page: Page) {
  // Audit the page people read, not a frame of its entrance: the same WCAG
  // checks, run once the cards have finished fading in (see the helper).
  await settleAnimations(page);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // Reported in full so a failure names the rule rather than just a count.
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
    })),
  ).toEqual([]);
}

test.describe('public shell', () => {
  test('renders the header, main landmark and footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('exposes the donate call to action at every viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Donate' }).first()).toBeVisible();
  });

  /**
   * Phase 11. `payment=()` blocked the Payment Request API inside Razorpay
   * Checkout's frame (wallet and UPI-intent payments). Payment is allowed for
   * this origin and Razorpay only; the other browser features stay off.
   */
  test('lets Razorpay Checkout use payments, and nothing else new', async ({ page }) => {
    const campaignPage = await page.goto('/campaigns/school-kits-jharkhand');
    const policy = campaignPage?.headers()['permissions-policy'] ?? '';
    expect(policy).toContain(
      'payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
    );
    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
    expect(policy).toContain('geolocation=()');
    expect(campaignPage?.headers()['x-frame-options']).toBe('DENY');
  });

  /**
   * Phase 12. A Content-Security-Policy on every page, permitting Razorpay
   * Checkout and nothing else from outside, and the BFF refusing a
   * state-changing request that did not come from this site.
   */
  test('sends a Content-Security-Policy that keeps Razorpay Checkout working', async ({ page }) => {
    const response = await page.goto('/campaigns/school-kits-jharkhand');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src [^;]*https:\/\/checkout\.razorpay\.com/);
    expect(csp).toMatch(/frame-src [^;]*https:\/\/api\.razorpay\.com/);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test('refuses a cross-site write through the BFF, and allows a same-site one', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');
    const forged = await page.request.post('/api/bff/donations', {
      headers: { Origin: 'https://evil.example' },
      data: {},
    });
    expect(forged.status()).toBe(403);

    const own = await page.request.post('/api/bff/donations', {
      headers: { Origin: new URL(baseURL!).origin },
      data: {},
    });
    // Reaches the API, which rejects the empty donation on its merits.
    expect(own.status()).not.toBe(403);
  });

  test('never scrolls horizontally', async ({ page }) => {
    // The most common responsive defect, and the easiest to regress.
    await page.goto('/');
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test('skip link is first in the DOM and reveals itself on focus', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.getByRole('link', { name: /skip to content/i });
    await expect(skipLink).toHaveAttribute('href', '#main-content');

    // Asserted structurally rather than by pressing Tab: emulated touch devices
    // do not move focus on Tab the way a desktop browser does, so a Tab-based
    // assertion would test the emulation rather than the page.
    const isFirstFocusable = await page.evaluate(() => {
      const focusable = document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      return focusable[0]?.textContent?.trim().toLowerCase() ?? null;
    });
    expect(isFirstFocusable).toContain('skip to content');

    // Off-screen until focused, on-screen once focused.
    // Polled rather than measured once: the reveal is a 150ms transition, so a
    // single boundingBox() read races it and flakes.
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await expect
      .poll(async () => (await skipLink.boundingBox())?.y ?? -1, { timeout: 2000 })
      .toBeGreaterThanOrEqual(0);
  });

  test('returns a real 404 for an unknown route', async ({ page }) => {
    // A soft 404 (status 200 with an error page) misleads crawlers and monitoring.
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/couldn.t find/i);
  });

  test('marks private areas noindex and public pages indexable', async ({ page }) => {
    await page.goto('/account');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    await page.goto('/campaigns');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/);
  });

  test('lets the real blog be indexed, and marks up a real article', async ({ page }) => {
    /*
      ══════════════════════════════════════════════════════════════════════
      THIS TEST ASSERTED THE OPPOSITE UNTIL PHASE 10.7, AND THE REVERSAL IS
      THE POINT.

      `/blog` rendered eight FABRICATED posts from `@/lib/mock`, so the page
      carried `noindex` and this test held that line — "when the blog is backed
      by a real table this test is what has to be deleted, deliberately,
      alongside restoring the sitemap entries", as its own comment put it.

      It is backed by a real table now. Decision A14 is unchanged — no public
      claim without a record behind it — and it is now SATISFIED rather than
      avoided, so the obligation flips: the page must be indexable, and an
      article must carry the structured data that was previously forbidden
      because there was no real author or date to put in it.
      ══════════════════════════════════════════════════════════════════════
    */
    await page.goto('/blog');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/);

    const firstPost = page.locator('a[href^="/blog/"]').first();
    await expect(firstPost).toBeVisible();
    await firstPost.click();
    await page.waitForURL(/\/blog\/.+/);

    /*
      Wait for the ARTICLE before reading the head. `waitForURL` resolves on
      navigation, and the page streams — reading `<script type="ld+json">` at
      that moment found nothing on the slower viewports, which looked like
      missing markup rather than a race.
    */
    await expect(page.locator('article')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/);

    /*
      AND NOW THERE IS `BlogPosting` STRUCTURED DATA, which the previous
      version asserted must be absent. Every field in it comes from a column:
      a headline, a publication date, and an author only when the post has one.
    */
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    const article = schemas.find((schema) => schema.includes('"BlogPosting"'));
    expect(article, 'a published article should carry BlogPosting markup').toBeTruthy();

    const parsed = JSON.parse(article!) as Record<string, unknown>;
    expect(parsed.headline).toBeTruthy();
    expect(parsed.datePublished).toBeTruthy();
    // Never a placeholder byline.
    expect(JSON.stringify(parsed)).not.toContain('"Admin"');
  });

  test('serves a segmented sitemap index, and every segment it names', async ({ request }) => {
    /*
      `docs/seo-strategy.md` §6 specifies an index with one file per content
      type, so a growing blog cannot delay discovery of a new campaign. Until
      Phase 10.8 there was a single `<urlset>` with everything in it.

      Asserted over HTTP rather than on the builders, because what can break is
      the ROUTING — six handlers that must each exist and serve XML, and an
      index that must name exactly those six.
    */
    const index = await request.get('/sitemap.xml');
    expect(index.status()).toBe(200);
    expect(index.headers()['content-type']).toContain('xml');

    const body = await index.text();
    expect(body).toContain('<sitemapindex');
    // An index points at files, never at pages.
    expect(body).not.toContain('<url>');

    const segments = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
    expect(segments).toHaveLength(6);

    for (const segment of segments) {
      const response = await request.get(new URL(segment).pathname);
      expect(response.status(), segment).toBe(200);
      expect(await response.text(), segment).toContain('<urlset');
    }
  });

  test('robots.txt disallows the private and transactional routes', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();

    for (const path of [
      '/admin/',
      '/account/',
      '/volunteer/portal/',
      '/api/',
      '/donate/checkout',
      '/donate/status/',
      '/search',
    ]) {
      expect(robots, path).toContain(`Disallow: ${path}`);
    }
    expect(robots).toContain('/sitemap.xml');
  });

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expectNoAxeViolations(page);
  });
});

/**
 * A staff session, minted through the API and written into the cookie the BFF
 * reads.
 *
 * Not driven through the sign-in form, deliberately: the privileged accounts
 * require a TOTP code, and generating one in a browser test would mean
 * reimplementing RFC 6238 in the spec. The form itself is covered by the API's
 * own auth suite; what these tests are about is the shell behind it.
 */
import { STAFF_STATE } from './global-setup';

test.describe('admin access control', () => {
  test('redirects a signed-out visitor to sign-in', async ({ page }) => {
    // Enforced in middleware, before any page renders — a guard in the layout
    // does not stop the page's data fetch, which runs in parallel with it.
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
  });

  test('offers the sign-in form without a session', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
});

test.describe('admin shell', () => {
  // The session is minted once per RUN by the global setup and reused here, so
  // the suite does not trip the sign-in rate limit it is not trying to test.
  test.use({ storageState: STAFF_STATE });

  test('renders the dashboard and its navigation', async ({ page, viewport }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    // Below `lg` the sidebar is an off-canvas drawer that is not mounted until
    // opened — that is the intended responsive behaviour, not a missing nav.
    const isDesktop = (viewport?.width ?? 0) >= 1024;
    if (!isDesktop) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
    }

    const nav = page.getByRole('navigation', { name: 'Admin' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('applies the admin surface theme', async ({ page }) => {
    // One attribute switches the neutral hue from warm to cool and tightens the
    // radius — the whole mechanism behind "two experiences, one design system".
    await page.goto('/admin');
    await expect(page.locator('[data-surface="admin"]')).toBeAttached();
  });

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/admin');
    await expectNoAxeViolations(page);
  });
});

test.describe('mobile navigation', () => {
  test('drawer opens, closes on Escape, and locks body scroll', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, 'The drawer only exists below the lg breakpoint');

    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();

    const nav = page.getByRole('navigation', { name: 'Mobile' });
    await expect(nav).toBeVisible();

    // Body scroll is locked while the drawer is open, so the page behind does
    // not scroll under the overlay.
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.body).position))
      .toBe('fixed');

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.body).position))
      .not.toBe('fixed');
  });
});
