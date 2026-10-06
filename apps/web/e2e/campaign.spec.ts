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

    /*
      The section links are links, not tabs: every section is on the page, so
      there are no panels to switch. Products is the current one on arrival —
      the campaign is asking for specific things, and the ask comes first.
    */
    const sections = page.getByRole('navigation', { name: 'Campaign sections' });
    await expect(sections.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Choose How You Want to Help' })).toBeVisible();
  });

  /**
   * The page reads in the approved order, top to bottom, whatever the width.
   * Asserted on the headings' positions rather than on the DOM, because the
   * order a reader meets them in is the requirement.
   */
  test('lays the sections out in the approved order', async ({ page }) => {
    await page.goto(CAMPAIGN);

    const order = [
      'Choose How You Want to Help',
      'Other Ways to Support',
      'About This Campaign',
      'Stories from the Ground',
      'Recent Supporters',
      'The Difference Your Support Can Make',
      'FAQs',
    ];

    const tops: number[] = [];
    for (const name of order) {
      const heading = page.getByRole('heading', { name, exact: true });
      await expect(heading).toBeVisible();
      tops.push((await heading.boundingBox())!.y);
    }

    expect(tops, `headings out of order: ${order.join(' → ')}`).toEqual(
      [...tops].sort((a, b) => a - b),
    );

    // Below `lg` the donation card is in the page itself, straight after the
    // ways of giving and before the story.
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      const card = page.getByRole('heading', { name: 'Your Donation' }).filter({ visible: true });
      const cardTop = (await card.boundingBox())!.y;
      expect(cardTop).toBeGreaterThan(tops[1]!);
      expect(cardTop).toBeLessThan(tops[2]!);
    }
  });

  /**
   * "Other Ways to Support": any amount, typed, beside the products. It writes
   * the same amount the card's presets do, so the two always agree.
   */
  test('takes any amount in Other Ways to Support, and totals it with the products', async ({
    page,
  }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    const field = page.getByLabel('Custom donation amount in rupees');
    await expect(field).toBeVisible();
    await field.fill('750');

    // No preset is that amount, so none is pressed; the card shows the ₹750.
    const presets = page.getByRole('group', { name: 'Add an Amount' }).filter({ visible: true });
    await expect(presets.first().getByRole('button', { pressed: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Donate ₹750' }).filter({ visible: true }),
    ).toBeEnabled();

    // And a product on top: one donation, both together.
    const priceText = await page
      .getByRole('article')
      .first()
      .getByText(/^₹[\d,]+$/)
      .first()
      .textContent();
    const price = Number(priceText!.replace(/[₹,]/g, ''));
    await page
      .getByRole('button', { name: /^Add one / })
      .first()
      .click();
    await expect(
      page
        .getByRole('button', { name: `Donate ₹${(price + 750).toLocaleString('en-IN')}` })
        .filter({ visible: true }),
    ).toBeEnabled();

    // Choosing a preset in the card replaces the typed amount in the field.
    await presets.first().getByRole('button', { name: '₹1,000', exact: true }).click();
    await expect(field).toHaveValue('1000');
  });

  /**
   * Below `lg` nothing is fixed to the screen. The donation card is part of
   * the page and scrolls away with it, so it never covers the content — or the
   * control that has focus — and there is no bar to open first.
   */
  test('keeps the donation card in the page on a phone, not fixed over it', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) >= 1024, 'below lg only');

    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    const card = page.getByRole('heading', { name: 'Your Donation' }).filter({ visible: true });
    const donate = page
      .getByRole('button', { name: /^Donate( ₹[\d,.]+)?$/ })
      .filter({ visible: true });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeInViewport();
    await expect(donate).toBeVisible();

    // Nothing in the page is pinned to the viewport.
    const pinned = await page.evaluate(
      () =>
        [...document.querySelectorAll('main *')].filter(
          (element) => getComputedStyle(element).position === 'fixed',
        ).length,
    );
    expect(pinned, 'no element in the page is position: fixed').toBe(0);

    // Further down, the card has scrolled away like the rest of the page.
    await page.getByRole('heading', { name: 'FAQs', exact: true }).scrollIntoViewIfNeeded();
    await expect(card).not.toBeInViewport();
    await expect(donate).not.toBeInViewport();

    // And there is no collapsed bar to open.
    await expect(page.getByRole('button', { name: /(Review|Hide)$/ })).toHaveCount(0);
  });

  /**
   * The side column on a desktop: whole on arrival, then pinned by its bottom.
   *
   * The donation card — assurances included — fits a laptop window, so it is
   * whole on arrival and stays whole while the page scrolls: title, Donate
   * button and the 80G line all on screen. Near the end the Donate button is
   * still there. Below `lg` there is no rail, so this is desktop-only.
   */
  test('keeps the donation card in view while the page scrolls', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) < 1024, 'the rail exists only at lg and up');

    await page.goto(CAMPAIGN);
    const title = page.getByRole('heading', { name: 'Your Donation' }).locator('visible=true');
    const donate = page
      .getByRole('button', { name: /^Donate( ₹[\d,.]+)?$/ })
      .locator('visible=true');
    const assurances = page.getByText('80G Tax Benefit').filter({ visible: true });

    // Arrival: the whole donation card, top to Donate button.
    await expect(title).toBeInViewport({ ratio: 1 });
    await expect(donate).toBeInViewport({ ratio: 1 });

    // Arrival, continued: the assurances at the foot of the same card.
    await expect(assurances).toBeInViewport({ ratio: 1 });

    // Mid-page: the whole card is still on screen.
    await page.getByRole('heading', { name: 'Stories from the Ground' }).scrollIntoViewIfNeeded();
    await expect(title).toBeInViewport({ ratio: 1 });
    await expect(donate).toBeInViewport({ ratio: 1 });
    await expect(assurances).toBeInViewport({ ratio: 1 });

    await page.getByRole('heading', { name: 'FAQs', exact: true }).scrollIntoViewIfNeeded();
    await expect(donate).toBeInViewport();
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

    // The toggle lives in the donation card — beside the page on a desktop,
    // in it below `lg` — and is there without opening anything.
    await expect(page.getByRole('radio', { name: 'One-Time Donation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // NEITHER way of giving is hidden by the selection: the products stay on
    // the page and the card's amount presets stay in the card.
    const presets = page.getByRole('group', { name: 'Add an Amount' }).filter({ visible: true });
    const firstPreset = presets.first().getByRole('button').first();
    await expect(page.getByRole('heading', { name: 'Choose How You Want to Help' })).toBeVisible();
    await expect(presets.first()).toBeVisible();

    await page.getByRole('radio', { name: 'Support with Products' }).click();
    await expect(page.getByRole('radio', { name: 'Support with Products' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Choose How You Want to Help' })).toBeVisible();

    await expect(firstPreset).toBeVisible();

    // And back: "One-Time Donation" moves to the amount field in Other Ways to
    // Support and puts the cursor in it.
    await page.getByRole('radio', { name: 'One-Time Donation' }).click();
    await expect(page.getByLabel('Custom donation amount in rupees')).toBeFocused();
  });

  /** Products and an amount in one donation — the hybrid the toggle must not block. */
  test('totals products and a custom amount together', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    // Whatever the first item costs — read from its card, not assumed.
    const priceText = await page
      .getByRole('article')
      .first()
      .getByText(/^₹[\d,]+$/)
      .first()
      .textContent();
    const price = Number(priceText!.replace(/[₹,]/g, ''));

    await page
      .getByRole('button', { name: /^Add one / })
      .first()
      .click();

    // The amount is a preset in the donation card, and the smallest one is
    // already chosen on arrival — in the side column on a desktop, in the
    // page on a phone.
    const preset = page
      .getByRole('group', { name: 'Add an Amount' })
      .filter({ visible: true })
      .first()
      .getByRole('button', { name: '₹500', exact: true });
    await expect(preset).toHaveAttribute('aria-pressed', 'true');

    const visible = (text: string | RegExp) =>
      page.getByText(text, { exact: true }).filter({ visible: true }).first();

    // The total is the item plus the amount.
    await expect(visible(`₹${(price + 500).toLocaleString('en-IN')}`)).toBeVisible();

    // Pressing the same amount again takes it back off.
    await preset.click();
    await expect(preset).toHaveAttribute('aria-pressed', 'false');
    await expect(visible(`₹${price.toLocaleString('en-IN')}`)).toBeVisible();
  });

  /**
   * The card opens on the smallest preset, so the Donate button is ready
   * before anything is touched — at every width, now that the phone's card is
   * the same card in the page.
   */
  test('starts with the smallest amount already chosen', async ({ page }) => {
    await page.goto(CAMPAIGN);

    const presets = page.getByRole('group', { name: 'Add an Amount' }).filter({ visible: true });
    await expect(presets.first().getByRole('button').first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByRole('button', { name: 'Donate ₹500' }).filter({ visible: true }),
    ).toBeEnabled();
  });

  test('shows what each item costs and how much is still needed', async ({ page }) => {
    await page.goto(CAMPAIGN);

    const card = page.getByRole('article').first();
    // "354 / 500 Donated" — both counts, so the scale of the ask shows — and
    // the price under its PRICE label.
    await expect(card.getByText(/^[\d,]+ \/ [\d,]+ Donated$/)).toBeVisible();
    await expect(card.getByText('Price', { exact: true })).toBeVisible();
    await expect(card.getByText(/^₹[\d,]+$/)).toBeVisible();
    await expect(card.getByRole('img', { name: /^[\d,]+ of [\d,]+ funded$/ })).toBeVisible();
  });

  test('adds an item to the summary and totals it', async ({ page }) => {
    await page.goto(CAMPAIGN);
    await page.waitForLoadState('networkidle');

    const add = page.getByRole('button', { name: /^Add one / }).first();
    await add.click();
    await add.click();

    /*
      `.filter({ visible: true })`, NOT `.first()`.

      The summary renders TWICE — the copy in the page for phones first in the
      DOM, then the desktop rail — and the one that is not this viewport's is
      still present, just hidden. `.first()` therefore picks a `display:none`
      node at one width or the other and waits for it to become visible until
      the test times out.
    */
    const visible = (text: string | RegExp) =>
      page.getByText(text).filter({ visible: true }).first();

    await expect(visible(/Selected Items/)).toBeVisible();
    await expect(visible('Total Amount')).toBeVisible();
    // Two of the first product, whatever it costs — the line's own stepper
    // in the summary must say so.
    const line = page
      .getByRole('group', { name: /^Quantity of .+ in your donation$/ })
      .filter({ visible: true })
      .first();
    await expect(line).toHaveText('2');
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
    const donorList = page.getByRole('region', { name: 'Recent Supporters' }).getByRole('listitem');
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
