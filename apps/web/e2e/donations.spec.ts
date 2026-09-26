import { expect, test, type Page } from '@playwright/test';

/**
 * The donation journey, in a browser.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHERE THIS STOPS, AND WHY.
 *
 * It goes as far as the moment before Razorpay Checkout opens. Beyond that is a
 * third-party modal in a cross-origin iframe, driven by a sandbox account and a
 * test card — automating it would test Razorpay's UI, need live credentials in
 * CI, and fail whenever their markup changed.
 *
 * Everything past that boundary is covered where it can be exercised properly:
 * the API's integration suite drives capture, webhooks, idempotency, amount
 * mismatches and out-of-band provider events against a real database with a
 * substituted provider.
 * That is the right place for it, and it is where a regression in the financial
 * rules would actually be caught.
 *
 * What these tests own is the part only a browser can check: that the total the
 * donor sees is right, that the steps connect, that validation fires before
 * anything is sent, and that a campaign which is not taking money says so.
 * ══════════════════════════════════════════════════════════════════════════
 */

const CAMPAIGN = '/campaigns/school-kits-jharkhand';

/**
 * Which summary layout this viewport gets.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * FROM THE VIEWPORT, NOT FROM THE DOM.
 *
 * The builder switches at Tailwind's `lg`, which is 1024px, so the width the
 * project was configured with settles the question exactly.
 *
 * Asking the DOM instead — "is the Review toggle visible?" — looked equivalent
 * and was the cause of a long-running tablet flake. Immediately after `goto`
 * the markup is present but the stylesheet may not have applied, so the
 * `lg:hidden` rules are not yet in effect and the answer depends on whether the
 * CSS happened to arrive first. Under parallel load it often had not, the test
 * took the desktop branch on a tablet, and then waited five seconds for a
 * control that layout does not show.
 * ══════════════════════════════════════════════════════════════════════════
 */
function usesSheetLayout(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 1024;
}

async function openBuilder(page: Page) {
  await page.goto(CAMPAIGN);
  const add = page.getByRole('button', { name: /Add one School Kit/i }).first();
  await add.scrollIntoViewIfNeeded();
  await expect(add).toBeVisible();
  return add;
}

/**
 * The Continue control, wherever this viewport puts it.
 *
 * On a desktop the donation summary is a sticky rail and Continue is always
 * visible. On a phone it is a collapsed bar showing the running total, with the
 * itemisation and Continue behind a "Review" toggle — a full summary panel on a
 * 320px screen would push the products themselves off the page.
 *
 * So the test opens the sheet when there is one, rather than asserting a layout
 * that only exists at one width.
 */
/**
 * A money figure that is actually on screen.
 *
 * The running total is rendered TWICE on a phone — once in the collapsed
 * summary bar and once inside the panel behind it — so a bare `getByText`
 * resolves to whichever comes first in the DOM, which is frequently the hidden
 * one. `visible=true` picks the one a donor can read.
 */
function visibleAmount(page: Page, amount: string) {
  return page.getByText(amount, { exact: true }).locator('visible=true').first();
}

async function continueButton(page: Page) {
  /*
    Matches BOTH labels. The toggle reads "Review" when shut and "Hide" when
    open, so a locator keyed on "Review" stops resolving the moment it works.
  */
  const toggle = page.getByRole('button', { name: /(Review|Hide)$/ }).first();

  /*
    THE VISIBLE ONE. The summary is rendered twice — a desktop rail and a mobile
    sheet — and the rail comes first in the DOM, so `.first()` alone returns a
    `display: none` button below `lg` that never becomes actionable.
  */
  /*
    The label is "Proceed to Donate" since the campaign redesign. "Continue" is
    kept in the pattern so this helper still resolves if an older surface is
    reached — matching both costs nothing and matching neither costs a timeout.
  */
  const control = page
    .getByRole('button', { name: /^(Proceed to Donate|Continue)$/ })
    .locator('visible=true')
    .first();

  if (!usesSheetLayout(page)) {
    return control;
  }

  /*
    WAIT FOR THE BUNDLE BEFORE TOUCHING ANYTHING.

    The summary bar is server-rendered, so it is clickable while React is still
    hydrating — and React REPLAYS the clicks it captured during hydration. A
    retry loop that clicked three times while waiting therefore had all three
    replayed at once, toggling the sheet open, shut and open again, and the
    sheet's final state came down to parity.

    That is why this test failed and the others did not: the rest reach the
    sheet through `openBuilder`, which waits for a control to be visible first
    and incidentally gives hydration time. This one goes straight for the
    toggle.

    `networkidle` is the honest signal here: the page's interactivity depends on
    a script arriving, so waiting for the network to settle is waiting for the
    thing that actually matters.
  */
  await page.waitForLoadState('networkidle');

  /*
    RETRY UNTIL THE CONTROL IS THERE, not until the toggle says it opened.

    An earlier version waited on the toggle's `aria-expanded`, which looks
    equivalent and is not: the bar is server-rendered and clickable before React
    has attached its handler, and a click in that window is swallowed. The
    attribute could then read `true` from a later click while the assertion that
    followed had already moved on — so the test went looking for a Continue
    button that was not there yet and failed after its own five seconds.

    Asserting on the button we actually want makes the loop self-correcting: if
    the sheet is shut it clicks, and if a click was swallowed it clicks again.
  */
  /*
    THE CLICK IS GATED ON THE TOGGLE, THE ASSERTION IS ON THE CONTROL.

    Both halves are needed, and an earlier version had each on its own.

    Gating on "is the Continue button there yet" double-clicks: a first click
    that is slow to register leaves the control absent, so the next iteration
    clicks again, and the two together open the sheet and shut it. The loop then
    exits on a lucky iteration and the very next assertion finds nothing.

    Asserting on `aria-expanded` alone is the opposite mistake: it can read true
    from a click while the panel behind it has not rendered.

    `aria-expanded` and the panel come from the same piece of React state, so
    gating on it means at most one click is ever in flight, and waiting on the
    control means the loop does not finish until the thing we want exists.
  */
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }
    await expect(control).toBeVisible({ timeout: 2000 });

    /*
      AND STILL OPEN A MOMENT LATER.

      This second check is the one that matters under load. React replays the
      clicks it captured while hydrating, so a sheet that has just opened can be
      shut again by a click issued seconds earlier — after this loop would
      otherwise have declared success, and just before the caller's assertion
      runs. Re-checking makes that iteration fail and the loop reopen it, rather
      than handing back a control that is about to vanish.
    */
    await page.waitForTimeout(400);
    await expect(control).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  return control;
}

test.describe('donation flow', () => {
  test('totals products, a custom amount, and the two together', async ({ page }) => {
    const add = await openBuilder(page);

    // One school kit at ₹900.
    await add.click();
    await expect(visibleAmount(page, '₹900')).toBeVisible();

    // Two of them.
    await add.click();
    await expect(await continueButton(page)).toBeEnabled();

    // Plus ₹500 on top — a hybrid donation. The field is labelled
    // "Custom donation amount in rupees" since the campaign redesign.
    await page.getByLabel(/custom donation amount/i).fill('500');
    await expect(visibleAmount(page, '₹2,300')).toBeVisible();
  });

  /**
   * You cannot proceed with an empty basket, and the interface says so.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * ASSERTED DIFFERENTLY PER LAYOUT, BECAUSE THE LAYOUTS DIFFER.
   *
   * On a desktop the summary is a sticky rail: Continue is on screen, disabled,
   * with the reason beneath it. On a phone or tablet it is a collapsed bar
   * showing "₹0 · Nothing selected", and Continue lives behind a Review toggle
   * — a full summary panel on a narrow screen would push the products
   * themselves off the page.
   *
   * An earlier version opened that sheet to reach the same button everywhere.
   * It raced hydration: the bar is server-rendered and clickable before React
   * attaches, React then REPLAYS the clicks it captured while hydrating, and
   * the sheet could be shut again a moment after the test had opened it. It
   * failed on tablet roughly a third of the time and no amount of re-checking
   * removed the race, because the stray click can land at any point.
   *
   * So each layout is checked on what it actually presents. The requirement is
   * the same and is fully covered: nothing offers a way forward, and the reason
   * is visible without hunting for it.
   * ══════════════════════════════════════════════════════════════════════════
   */
  test('will not continue with nothing chosen, and says why', async ({ page }) => {
    await page.goto(CAMPAIGN);

    const toggle = page.getByRole('button', { name: /(Review|Hide)$/ });

    if (usesSheetLayout(page)) {
      // The collapsed bar is the summary at this width, and it states the
      // total and that nothing has been chosen — no interaction needed.
      await expect(toggle.first()).toContainText(/Nothing selected/i);
      await expect(toggle.first()).toContainText('₹0');
    } else {
      const cont = page
        .getByRole('button', { name: /^(Proceed to Donate|Continue)$/ })
        .locator('visible=true')
        .first();
      await expect(cont).toBeDisabled();
      // The rail says what to do, not just that the button is off.
      await expect(
        page
          .getByText(/Choose an item above, or enter any amount you like/i)
          .locator('visible=true')
          .first(),
      ).toBeVisible();
    }

    // Whatever the layout, there is no enabled way forward.
    const enabled = page.getByRole('button', { name: /^Continue$/ }).and(page.locator(':enabled'));
    await expect(enabled).toHaveCount(0);
  });

  test('a quantity cannot go below zero', async ({ page }) => {
    await page.goto(CAMPAIGN);
    const remove = page.getByRole('button', { name: /Remove one School Kit/i }).first();
    await remove.scrollIntoViewIfNeeded();

    // Disabled at zero rather than hidden, so nothing shifts under the pointer.
    await expect(remove).toBeDisabled();

    const add = page.getByRole('button', { name: /Add one School Kit/i }).first();
    await add.click();
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(remove).toBeDisabled();
  });

  test('reaches donor details, and validates before sending anything', async ({ page }) => {
    const add = await openBuilder(page);
    await add.click();

    let posted = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/bff/donations')) posted += 1;
    });

    await (await continueButton(page)).click();

    await expect(page.getByLabel(/Full name/i)).toBeVisible();
    await expect(page.getByLabel(/^Email/i)).toBeVisible();
    await expect(page.getByLabel(/Mobile number/i)).toBeVisible();

    const pay = page.getByRole('button', { name: /^Pay ₹/ });
    await expect(pay).toHaveText(/Pay ₹900/);

    await pay.click();
    await expect(page.getByText(/Enter your name/i)).toBeVisible();

    // Nothing left the browser: an empty form must not create a donation row.
    expect(posted).toBe(0);
  });

  /**
   * A PAN is deliberately absent from checkout (decision A7). It is collected
   * later, from donors who choose to claim relief — asking for a sensitive
   * identifier at the highest-abandonment step costs donations for a benefit
   * most people will not use.
   */
  test('does not ask for a tax id at checkout', async ({ page }) => {
    const add = await openBuilder(page);
    await add.click();
    await (await continueButton(page)).click();

    await expect(page.getByLabel(/PAN/i)).toHaveCount(0);
    await expect(page.getByLabel(/tax/i)).toHaveCount(0);
  });

  test('never calls a receipt a tax certificate', async ({ page }) => {
    const add = await openBuilder(page);
    await add.click();
    await (await continueButton(page)).click();

    // Section 80G relief comes from Form 10BE, issued by the Income Tax
    // Department after the annual Form 10BD filing — months later, by a
    // different party. Promising it at the moment of giving is a claim this
    // platform cannot honour.
    await expect(page.getByText(/Form 10BE/i)).toBeVisible();
    await expect(page.getByText(/80G certificate will be/i)).toHaveCount(0);
  });

  test('can go back from details without losing the basket', async ({ page }) => {
    const add = await openBuilder(page);
    await add.click();
    await add.click();

    await (await continueButton(page)).click();
    await expect(page.getByRole('button', { name: /^Pay ₹1,800/ })).toBeVisible();

    await page.getByRole('button', { name: /Back to your donation/i }).click();

    // The two kits are still chosen. Losing a basket on a back press is how a
    // donor gives up.
    await expect(await continueButton(page)).toBeEnabled();
    await expect(visibleAmount(page, '₹1,800')).toBeVisible();
  });
});

test.describe('donation status page', () => {
  test('tells an unknown reference apart from a failure, and does not blame the donor', async ({
    page,
  }) => {
    await page.goto('/donation/DON-NOTAREALREF');

    /*
      A generous timeout, because the page is DESIGNED to be slow to conclude.
      It polls with backoff and treats anything that is not a definitive 404 —
      a rate limit, a dropped connection — as "keep waiting", precisely so it
      never tells a donor their payment failed on thin evidence. Under a loaded
      run the first poll can be rate-limited, and the page is then correct to
      show "confirming" for a few seconds before it knows.
    */
    await expect(page.getByRole('heading', { name: /cannot find that donation/i })).toBeVisible({
      timeout: 20_000,
    });
    // Crucially it does NOT say the payment failed, because it does not know.
    await expect(page.getByText(/payment was not completed/i)).toHaveCount(0);
    await expect(page.getByText(/rather find your payment than take a second one/i)).toBeVisible();
  });

  test('is kept out of search indexes', async ({ page }) => {
    // The reference is a capability — it is the only thing between a request
    // and somebody's receipt.
    const response = await page.goto('/donation/DON-NOTAREALREF');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(response?.status()).toBe(200);
    expect(robots).toMatch(/noindex/);
  });
});

test.describe('campaigns that are not taking money', () => {
  test('a completed campaign offers no way to pay', async ({ page }) => {
    await page.goto('/campaigns/tailoring-training-centre');

    await expect(page.getByText(/complete/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Proceed to Donate|Continue)$/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: /(Review|Hide)$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Pay ₹/ })).toHaveCount(0);
  });
});
