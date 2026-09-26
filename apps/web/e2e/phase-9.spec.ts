import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Team, events and impact, as a signed-out visitor sees them.
 *
 * Everything here runs with NO session, which is most of what Phase 9 added to
 * the public site: two new detail pages, and an event page that has to say the
 * right thing in four different states before anybody signs in.
 *
 * The signed-in half — registering, cancelling, "Your events" — lives in
 * `dashboard.spec.ts`. The note at the foot of this file says why.
 */

/** An event with plenty of room, so four concurrent projects cannot fill it. */
const OPEN_EVENT = 'animal-care-awareness';
/** Seeded at capacity, so its page must say so rather than offering a form. */
const FULL_EVENT = 'school-kit-distribution-namkum';

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

// =========================================================================
test.describe('the public pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a team member has a page of their own', async ({ page }) => {
    await page.goto('/team');

    const first = page.getByRole('link', { name: /^[A-Z]/ }).first();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The directory links to the detail pages — added in Phase 9, and the
    // reason the card's name became a link.
    const profile = page.locator('a[href^="/team/"]').first();
    await expect(profile).toBeVisible();
    const href = await profile.getAttribute('href');
    expect(href).toMatch(/^\/team\/[a-z0-9-]+$/);

    await page.goto(href!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'See the whole team' })).toBeVisible();
    await expectNoAxeViolations(page);
    void first;
  });

  test('an impact record shows its figure and how it was counted', async ({ page }) => {
    await page.goto('/impact');

    const record = page.locator('a[href^="/impact/"]').first();
    await expect(record).toBeVisible();
    const href = await record.getAttribute('href');

    await page.goto(href!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    /*
      Decision A14, as a test. A published figure has to carry the method
      alongside it — a page that shows the number and withholds the evidence is
      the arrangement the decision exists to prevent.
    */
    await expect(page.getByRole('heading', { name: 'How this was counted' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a full event says so instead of offering a form', async ({ page }) => {
    await page.goto(`/events/${FULL_EVENT}`);

    await expect(page.getByRole('heading', { name: 'This event is full' })).toBeVisible();
    // There is no waitlist in Phase 9, and the page must not imply one.
    await expect(page.getByText(/waitlist/i)).toHaveCount(0);
  });

  test('a signed-out visitor is invited to sign in, carrying the way back', async ({ page }) => {
    await page.goto(`/events/${OPEN_EVENT}`);

    const signIn = page.getByRole('link', { name: 'Sign in to register' });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', `/sign-in?next=/events/${OPEN_EVENT}`);
  });

  test('the footer offers no refund policy', async ({ page }) => {
    await page.goto('/');

    // Phase 9 §59: no refund policy, link, information or terms.
    await expect(page.getByRole('link', { name: /refund/i })).toHaveCount(0);
    // And the page itself is gone rather than merely unlinked.
    const response = await page.goto('/refund-policy');
    expect(response?.status()).toBe(404);
  });
});

/*
  ══════════════════════════════════════════════════════════════════════════
  THE SIGNED-IN REGISTRATION TESTS ARE NOT IN THIS FILE.

  They live in `dashboard.spec.ts`, inside its serial `signed in as a donor`
  block, and they have to: that block ends with a test that SIGNS THE DONOR
  OUT, which revokes the session at the API rather than only in the browser.

  There is one donor per viewport project, shared across every file that uses
  that project's storage state. Under `fullyParallel` a test in a separate file
  runs ALONGSIDE the sign-out rather than after it — and this is not a theory:
  these tests were here for one run, and all four projects failed with "Your
  session is not valid" partway through a registration.

  Serial ordering inside a single describe is the only primitive that actually
  orders them, so anything needing that donor's session goes there. What stays
  here is everything a signed-out visitor sees.
  ══════════════════════════════════════════════════════════════════════════
*/
