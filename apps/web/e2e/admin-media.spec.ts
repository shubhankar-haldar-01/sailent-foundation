import { test, expect } from '@playwright/test';

import { STAFF_STATE } from './global-setup';

/**
 * The media library, in a browser.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THESE ASSERT, AND WHY NO IMAGE IS EVER REALLY UPLOADED HERE.
 *
 * The E2E stack is deliberately fenced away from Cloudflare R2: the four R2
 * variables are blanked in `playwright.config.ts`, so
 * `StorageService.isConfigured` is false and an upload is refused with a 503
 * that says exactly that.
 *
 * The fence is there because the buckets are REAL. `sailent-public` is what
 * the live site serves images from, and R2 has no local emulator. An E2E run
 * that could upload would leave test images in it — every run, from every
 * worker, with nothing to clean them up.
 *
 * That refusal IS worth testing on its own account: it is the state a
 * misconfigured deployment lands in, and an administrator meeting "something
 * went wrong" would go and re-export their image half a dozen times before
 * suspecting the server.
 *
 * The real upload, the bucket move, the signed URL and the delete are covered
 * against the live service by `apps/api/test/r2-round-trip.spec.ts`, which
 * removes every object it creates. See docs/phase-10.6.md §E.
 * ══════════════════════════════════════════════════════════════════════════
 */
test.use({ storageState: STAFF_STATE });

/** A real 1×1 PNG, so the upload path is exercised with genuine bytes. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('media library', () => {
  test('opens, and offers an upload', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/media');
    await expect(page.getByRole('heading', { level: 1, name: 'Media' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload an image' })).toBeVisible();
  });

  test('the upload form asks for alt text before anything else', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/media');
    await page.getByRole('button', { name: 'Upload an image' }).click();

    // Required, and required HERE — the moment somebody chooses an image is
    // the only moment they reliably know what it shows.
    const altText = page.getByLabel('Alt text');
    await expect(altText).toBeVisible();
    await expect(altText).toHaveAttribute('required', '');

    // And the picker only offers the formats the validator accepts.
    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    );
  });

  test('refuses an upload clearly when storage is not configured', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/media');
    await page.getByRole('button', { name: 'Upload an image' }).click();

    await page.getByLabel('Alt text').fill('A test upload');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await page
      .getByRole('button', { name: /Upload/ })
      .last()
      .click();

    /*
      A 503 naming the cause, not a generic failure. The message has to send
      the administrator to the deployment rather than back to their image
      editor.
    */
    /*
      Matched on the form's ALERT, not on the page text: the tiles for the
      seeded rows each carry a "No preview — storage is not configured"
      placeholder, so a loose text match finds fifteen of them.
    */
    const alert = page
      .getByRole('alert')
      // Next renders its own empty `role="alert"` route announcer on every
      // page, so the alert has to be identified by what it says.
      .filter({ hasText: /storage is not configured/i });

    await expect(alert).toBeVisible({ timeout: 15000 });
    // The half that sends the operator to the deployment, not to their image.
    await expect(alert).toContainText(/Nothing was uploaded/i);
  });

  test('shows an empty state rather than a blank page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/media?q=zzz-nothing-matches-this');
    await expect(page.getByText(/No image matches/i)).toBeVisible();
  });

  test.skip('uploads an image and shows it in the library', async () => {
    /*
      PERMANENTLY SKIPPED, and not because anything is missing.

      The buckets exist and the credentials work — `r2-round-trip.spec.ts`
      proves it against the live service on every `pnpm test`. This test stays
      skipped because making it run would mean unfencing the browser suite and
      letting it write into `sailent-public`, which is the one thing the fence
      in `playwright.config.ts` exists to prevent.

      It is kept rather than deleted so the next person to wonder "why is there
      no upload journey?" finds the answer here instead of writing one.
    */
  });
});

test.describe('media is staff-only', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects a signed-out visitor away from the media library', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/media');
    // The admin shell sends anybody without a staff session to sign in.
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
