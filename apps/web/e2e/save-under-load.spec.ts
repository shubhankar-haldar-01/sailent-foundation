import { expect, test, type BrowserContextOptions, type TestInfo } from '@playwright/test';

import { SAVE_UNDER_LOAD_DONOR, STAFF_STATE, donorStateFor } from './global-setup';

/**
 * A save finishes even while the server is busy (2026-11-21).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BUG THIS GUARDS AGAINST.
 *
 * On Next.js 15.5.29 a server-action save could stay on "Saving…" for ever
 * whenever the server was busy with other pages at the same moment, although
 * the save had succeeded (HTTP 200, `{ ok: true }`). After a save, Next
 * re-renders the page into the action's response; under load that response
 * streams in with gaps, and the React build bundled in Next 15.5 never
 * finished applying it. About half the saves stuck in this setup; none
 * without the load. Next.js 16 does not (DEVELOPMENT_STATUS.md, "A save stuck
 * on 'Saving…' under server load").
 *
 * So: staff open the heaviest admin page several times at once, and while
 * the server is busy with them the donor saves their profile. Five rounds;
 * every save must say "Profile saved". On 15.5.29 this failed almost always.
 * ══════════════════════════════════════════════════════════════════════════
 */

const ROUNDS = 5;
const STAFF_PAGES_PER_ROUND = 8;

/**
 * A context of this test's own, with a CLIENT ADDRESS of its own.
 *
 * Its forty heavy page loads would otherwise spend the rate-limit budget that
 * every other desktop test shares (one address per project, see
 * `playwright.config.ts`), and the donor's page would fail on a 429 instead of
 * testing the save. `.41` and `.42` are used by nothing else.
 */
function contextOptions(
  testInfo: TestInfo,
  storageState: string,
  address: string,
): BrowserContextOptions {
  const { baseURL, viewport } = testInfo.project.use;
  return { baseURL, viewport, storageState, extraHTTPHeaders: { 'x-e2e-client-ip': address } };
}

test.describe('a save under server load', () => {
  test('the donor profile saves while staff load heavy admin pages, every time', async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'About the server, not the viewport.');
    test.setTimeout(120_000);

    const staff = await browser.newContext(contextOptions(testInfo, STAFF_STATE, '198.51.100.41'));
    const donor = await browser.newContext(
      contextOptions(testInfo, donorStateFor(SAVE_UNDER_LOAD_DONOR), '198.51.100.42'),
    );

    const list = await staff.newPage();
    await list.goto('/admin/campaigns');
    const editor = await list
      .locator('a[href^="/admin/campaigns/"][href$="/edit"]')
      .first()
      .getAttribute('href');
    expect(editor, 'a campaign editor to load').toBeTruthy();
    await list.close();

    const page = await donor.newPage();
    for (let round = 1; round <= ROUNDS; round += 1) {
      await page.goto('/dashboard/profile');

      const busy = Promise.all(
        Array.from({ length: STAFF_PAGES_PER_ROUND }, async () => {
          const staffPage = await staff.newPage();
          await staffPage.goto(editor!);
          await staffPage.close();
        }),
      );
      // Saved while the server is rendering those pages.
      await page.waitForTimeout(150);
      await page.getByRole('button', { name: 'Save changes' }).click();

      await expect(
        page.getByRole('region', { name: 'Notifications' }).getByText('Profile saved'),
        `save ${round} of ${ROUNDS} finished`,
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
      await busy;
    }

    await staff.close();
    await donor.close();
  });
});
