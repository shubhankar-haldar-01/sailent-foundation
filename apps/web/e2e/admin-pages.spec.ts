import { test, expect } from '@playwright/test';
import pg from 'pg';

import { E2E_STAFF_THIRD } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * The section composer, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ASSERTION THAT MATTERS IS THAT AN UNPUBLISHED LAYOUT CHANGES NOTHING.
 *
 * A composed page decides what visitors see on a real route. A draft that
 * leaked would not look like a bug — it would look like the site. So the
 * public surface is checked before publishing, after publishing, and again
 * after archiving.
 *
 * It runs against the E2E database, which `playwright.config.ts` fences off
 * from development and from production.
 * ══════════════════════════════════════════════════════════════════════════
 */

/*
  ITS OWN STAFF ACCOUNT AND SESSION, minted in `global-setup.ts`.

  Publishing needs a re-authentication, and a re-auth opens a five-minute window
  on the SESSION. Sharing one would open that window for `admin-stories`, which
  asserts that publishing without it is refused — and for `admin-blog`, which
  asserts the same. Three specs that each need a window need three accounts.
*/
test.use({ storageState: E2E_STAFF_THIRD.state });
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now().toString(36);
const TITLE = `E2E composed page ${STAMP}`;

/*
  ══════════════════════════════════════════════════════════════════════════
  A ROUTE NOTHING RENDERS, NOT `home`.

  The first version composed `home`, which is exactly what §4.17 describes —
  and which mutates the REAL homepage for every spec running beside this one.
  Publishing it changed `/` mid-run for whatever else was reading it, and a
  test that alters a shared public surface is a test that makes other tests
  lie.

  So the lifecycle runs against a slug no route reads. Everything this file is
  for — compose, reorder, publish, schedule, archive, and what the public API
  then returns — is unchanged by that choice, because a page does not create a
  route: `home` is not special to the composer, only to the site.

  The homepage's own rendering of a composition is covered where it can be
  covered safely: `section-renderer.test.tsx` asserts order, dispatch and that
  nothing stored becomes markup.
  ══════════════════════════════════════════════════════════════════════════
*/
const SLUG = `e2e-composer-${STAMP}`;

/** Open the five-minute sensitive window on a page whose LOAD is sensitive. */
async function openSensitiveWindow(page: import('@playwright/test').Page) {
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  let volunteerId: string;
  try {
    const result = await client.query<{ id: string }>('SELECT id FROM volunteers LIMIT 1');
    volunteerId = result.rows[0]!.id;
  } finally {
    await client.end();
  }

  await page.goto(`/admin/volunteers/${volunteerId}`);
  await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();
  await page.locator('input[name="password"]').fill(E2E_STAFF_THIRD.password);

  /*
    ══════════════════════════════════════════════════════════════════════════
    WAIT FOR THE CONFIRMATION TO LAND, THEN RELOAD.

    The panel hides only when React commits the server action's transition.
    Under a saturated machine — three browser projects, five hundred tests and
    two Node servers on one laptop — the App Router occasionally never commits
    a transition whose request demonstrably finished: instrumenting this click
    caught the POST completing in 232ms with the button still reading
    "Saving…" twenty seconds later, and no further network activity at all.

    Reloading asserts the thing that actually matters and is stronger than the
    banner: the five-minute window is open ON THE SESSION, so the page the API
    refused a moment ago now renders. A client transition that never committed
    cannot make that pass.
    ══════════════════════════════════════════════════════════════════════════
  */
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() !== 'GET' && response.status() < 400,
      { timeout: 20_000 },
    ),
    page.getByRole('button', { name: /Confirm|Continue|Unlock/i }).click(),
  ]);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeHidden({
    timeout: 20_000,
  });
}

test.afterAll(async () => {
  // Real rows in the E2E database. A composed page left behind would sit in
  // the admin list looking like work somebody had started.
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    await client.query(`DELETE FROM pages WHERE title LIKE $1`, ['E2E composed page %']);
  } finally {
    await client.end();
  }
});

test.describe('the section composer', () => {
  test('opens the pages list', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    await page.goto('/admin/pages');
    await expect(page.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compose a page' })).toBeVisible();
  });

  /**
   * THE WHOLE LIFECYCLE, in one test.
   *
   * Each step only means anything in the state the previous one left, and
   * separate tests sharing a page through module scope is the same sequence
   * with a worse failure message.
   */
  test('composes a page, reorders, publishes, and takes it down again', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    /*
      The public effect is read through the API rather than a browser, because
      the composition under test is for a slug no route renders — and because
      this is precisely the boundary that decides what a visitor may see.

      ABSOLUTE, against `e2eStack.apiUrl`. The `request` fixture is based at the
      WEB server, where `/api/v1/...` does not exist — so a relative path
      answered 404 whatever the page's status, and the "a draft is not public"
      assertion below passed for the wrong reason.
    */
    const publicPage = () => request.get(`${e2eStack.apiUrl}/api/v1/pages/${SLUG}`);

    // ---- compose ----------------------------------------------------------
    await page.goto('/admin/pages/new');
    await page.getByRole('textbox', { name: 'Route', exact: true }).fill(SLUG);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(TITLE);

    // Two approved sections, in a deliberate order.
    await page.getByRole('button', { name: 'Add a section' }).click();
    await page.getByRole('button', { name: /^Hero/ }).click();
    await page.getByRole('button', { name: 'Add a section' }).click();
    await page.getByRole('button', { name: /^Newsletter/ }).click();

    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Create page' }).click(),
    ]);

    await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}/);
    const adminUrl = page.url();
    await expect(page.getByText('Sections (2)')).toBeVisible();

    // ---- a draft is NOT public ---------------------------------------------
    expect((await publicPage()).status()).toBe(404);

    // ---- reorder ----------------------------------------------------------
    await page.goto(adminUrl);
    await page.getByRole('button', { name: 'Move Newsletter up' }).click();
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);

    await page.reload();
    // A second version exists, so the history is real.
    await expect(page.getByText(/version 2/i).first()).toBeVisible({ timeout: 15_000 });

    // ---- publish ----------------------------------------------------------
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    // `@Sensitive()`: a session that has not re-authenticated is refused.
    await expect(page.getByText(/Confirm your password to continue/i)).toBeVisible();

    await openSensitiveWindow(page);
    await page.goto(adminUrl);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Confirm', exact: true }).click(),
    ]);

    await page.reload();
    await expect(page.getByText(/Status:\s*published/i)).toBeVisible({ timeout: 15_000 });

    // ---- the composition is now public, in the order it was left ----------
    const live = await publicPage();
    expect(live.status()).toBe(200);

    const body = (await live.json()) as { data: { sections: { type: string }[] } };
    // Newsletter was moved above Hero before saving, so the ORDER is the proof
    // that reordering reached the database and not just the screen.
    expect(body.data.sections.map((section) => section.type)).toEqual(['newsletter', 'hero']);

    // ---- archive, and the route falls back --------------------------------
    await page.goto(adminUrl);
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Confirm', exact: true }).click(),
    ]);

    await page.reload();
    await expect(page.getByText(/Status:\s*archived/i)).toBeVisible({ timeout: 15_000 });

    /*
      And it is gone from the public surface. An archived page means "compose
      nothing", and a route in that state renders its own built-in order — which
      is why a composer cannot take the site down.
    */
    expect((await publicPage()).status()).toBe(404);
  });
});
