import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const CAMPAIGN = '/campaigns/school-kits-jharkhand';

/**
 * The campaign page.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE DONOR LIST IS THE PART THAT MATTERS.
 *
 * This is the only public page that prints a person's name next to an amount
 * they gave. The API returns the literal 'Anonymous Donor' for a hidden gift and
 * never reads the real name out of the database — these tests check the page
 * honours that end to end, because an anonymity bug here is a disclosure that
 * cannot be taken back.
 * ══════════════════════════════════════════════════════════════════════════
 */
test.describe('campaign page', () => {
  test('leads with the ask', async ({ page }) => {
    await page.goto(CAMPAIGN);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Products is the default tab: the campaign is asking for specific things.
    await expect(page.getByRole('tab', { name: 'Products', selected: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose Products to Donate' })).toBeVisible();
  });

  /**
   * The two ways to give.
   *
   * The approved design shows "One-Time Donation" selected with the products
   * still on screen and already in the basket — so the control cannot be a
   * filter that hides one panel. It is a JUMP: pressing a segment moves to that
   * way of giving and puts the cursor in it.
   *
   * That reading is also the only one that leaves a hybrid donation reachable.
   * A filter would mean giving both products and an amount required finding a
   * toggle first, and most people would never discover they could.
   */
  test('offers both ways to give at once, and jumps between them', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    // The toggle lives in the summary, and below `lg` that is a collapsed
    // bottom sheet — one tap away, exactly as it is for a donor.
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await page.getByRole('button', { name: /review/i }).click();
    }

    await expect(page.getByRole('radio', { name: 'One-Time Donation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // NEITHER panel is hidden by the selection. Both ways of giving stay on the
    // page whichever segment is lit.
    await expect(page.getByRole('heading', { name: 'Choose Products to Donate' })).toBeVisible();
    await expect(page.getByLabel(/custom donation amount/i)).toBeVisible();

    await page.getByRole('radio', { name: 'Support with Products' }).click();
    await expect(page.getByRole('radio', { name: 'Support with Products' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Choose Products to Donate' })).toBeVisible();
  });

  /** Products and an amount in one donation — the hybrid the toggle must not block. */
  test('totals products and a custom amount together', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    await page
      .getByRole('button', { name: /^Add one / })
      .first()
      .click();
    await page.getByLabel(/custom donation amount/i).fill('500');

    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await page.getByRole('button', { name: /review/i }).click();
    }

    const visible = (text: string | RegExp) =>
      page.getByText(text).filter({ visible: true }).first();

    await expect(visible('Subtotal')).toBeVisible();
    await expect(visible('Custom Amount')).toBeVisible();
  });

  test('shows what each item costs and how much is still needed', async ({ page }) => {
    await page.goto(CAMPAIGN);

    const card = page.getByRole('article').first();
    await expect(card.getByText(/\d+ \/ \d+ Donated/)).toBeVisible();
    await expect(card.getByText('Price', { exact: true })).toBeVisible();
  });

  test('adds an item to the summary and totals it', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    const add = page.getByRole('button', { name: /^Add one / }).first();
    await add.click();
    await add.click();

    /*
      The summary rail is desktop-only. Below `lg` the same component lives in a
      bottom sheet that is COLLAPSED by default — deliberately, so it does not
      eat a third of a phone screen — so the test has to open it, exactly as a
      donor would.

      Decided from the viewport rather than by asking the DOM which layout it is
      in: a query immediately after navigation can run before the CSS applies,
      and the answer is then the desktop one on a phone.
    */
    const width = page.viewportSize()?.width ?? 1280;
    if (width < 1024) {
      await page.getByRole('button', { name: /review/i }).click();
    }

    /*
      `.filter({ visible: true })`, NOT `.first()`.

      The summary renders TWICE — the desktop rail first in the DOM, then the
      mobile sheet — and the one that is not this viewport's is still present,
      just hidden. `.first()` therefore picks a `display:none` node on a phone
      and waits for it to become visible until the test times out.
    */
    const visible = (text: string | RegExp) =>
      page.getByText(text).filter({ visible: true }).first();

    await expect(visible(/Selected Items/)).toBeVisible();
    await expect(visible('Total Amount')).toBeVisible();
    // Two of the first product, whatever it costs — the line must say so.
    await expect(visible('× 2')).toBeVisible();
  });

  /**
   * NO CONDITIONAL SKIP, DELIBERATELY.
   *
   * This guarded itself with `if (no donors) test.skip(…)` and then skipped on
   * two of the four viewports — `count()` does not wait, so on the slower
   * emulated devices it ran before the section had rendered. The most important
   * test on this page reported green while asserting nothing at all.
   *
   * The seed provides five confirmed donations, one of them anonymous. Their
   * absence is itself a failure worth knowing about, so the test asserts and
   * lets the retrying matchers do the waiting.
   */
  test('never prints the name behind an anonymous donation', async ({ page }) => {
    await page.goto(CAMPAIGN);

    await expect(page.getByText('Anonymous Donor')).toBeVisible();
    // The seeded anonymous donor is Kabir Sheikh. Neither half may appear.
    await expect(page.locator('body')).not.toContainText('Kabir');
    await expect(page.locator('body')).not.toContainText('Sheikh');
  });

  test('re-sorts the donor list by amount without a round trip', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    const generous = page.getByRole('radio', { name: 'Most Generous' });
    await expect(generous).toBeVisible();
    await generous.click();
    await expect(generous).toHaveAttribute('aria-checked', 'true');

    /*
      SCOPED TO THE DONOR LIST.

      An unscoped `getByRole('listitem')` matched the first product card, and
      the test failed reporting a school kit's price — which looks like a
      sorting bug and is a locator that was never looking at the right list.
    */
    const donorList = page.getByRole('region', { name: 'Recent Donors' }).getByRole('listitem');
    await expect(donorList.first()).toContainText('1,500');
  });

  /**
   * A one-pixel `sr-only` span inside the carousel once escaped its scroll
   * container and dragged the document to twice the viewport width. Nothing
   * about the page looked wrong; every page view just had a horizontal
   * scrollbar. This is cheap insurance against it coming back.
   */
  test('does not scroll sideways', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    const widths = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: document.documentElement.clientWidth,
    }));

    expect(widths.doc, 'the campaign page must not overflow horizontally').toBeLessThanOrEqual(
      widths.view + 1,
    );
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

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
  });
});
