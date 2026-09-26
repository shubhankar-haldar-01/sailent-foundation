import { test, expect } from '@playwright/test';
import pg from 'pg';

import { E2E_STAFF_SECOND } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * The blog, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ASSERTION THAT MATTERS IS THAT A DRAFT IS NOT PUBLIC.
 *
 * `/blog` used to render eight fabricated articles and was deliberately kept
 * out of the index because nobody had written them. That risk is now inverted:
 * the posts are real, and the dangerous state is a DRAFT — an article the
 * organisation has not decided to stand behind — becoming readable.
 *
 * A leaked draft looks exactly like a published one, so nothing appears wrong
 * until somebody quotes it. The full lifecycle below therefore checks the
 * public site at every step, not only at the end: invisible as a draft,
 * visible once published, invisible again once archived.
 * ══════════════════════════════════════════════════════════════════════════
 */
/*
  ══════════════════════════════════════════════════════════════════════════
  ITS OWN STAFF SESSION, NOT THE SHARED ONE.

  This spec re-authenticates in order to publish, and a re-authentication opens
  a five-minute window on the SESSION. Using the shared `STAFF_STATE` meant
  that window was open for every other spec too — and `admin-stories.spec.ts`
  asserts the opposite: that publishing without one is refused. Whichever ran
  second failed, depending on order.

  So it uses a session for a SECOND staff account, minted once in
  `global-setup.ts`. Signing in through the form at test time was tried and
  failed differently: under the full suite that login is rate limited alongside
  everything else reaching the API from one address, and a throttled login
  simply never redirects.
  ══════════════════════════════════════════════════════════════════════════
*/
test.use({ storageState: E2E_STAFF_SECOND.state });

/*
  SERIAL, like `admin-stories.spec.ts` and for the same reason: these tests
  create posts through the UI and then read the public listing back. Run in
  parallel they interleave, and one test's draft appears while another is
  asserting on the listing.
*/
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now().toString(36);
const TITLE = `E2E blog lifecycle ${STAMP}`;
const SLUG = `e2e-blog-lifecycle-${STAMP}`;
const BODY = 'This article exists only to prove the publishing lifecycle works from end to end.';

test.afterAll(async () => {
  // Real rows in the E2E database. Left behind they would sit in the admin
  // list looking like work somebody had started.
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM slug_history WHERE entity_id IN (SELECT id FROM blog_posts WHERE title LIKE $1)`,
      [`E2E %${STAMP}`],
    );
    await client.query(`DELETE FROM blog_posts WHERE title LIKE $1`, [`E2E %${STAMP}`]);
  } finally {
    await client.end();
  }
});

test.describe('admin blog', () => {
  test('opens the blog list', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    await page.goto('/admin/blog');
    await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Write a post' })).toBeVisible();
  });

  /**
   * THE WHOLE LIFECYCLE, in one test.
   *
   * Deliberately not split: each step only means anything in the state the
   * previous one left, and separate tests sharing a post through module scope
   * is the same sequence with a worse failure message.
   */
  test('creates a draft, verifies it is private, publishes, then archives it', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    /*
      THE PUBLIC SITE IS READ AS A READER, in a context with no staff session.

      Two reasons, and the second is why this is not merely tidy. It is more
      faithful: a visitor is not signed in, so asserting "what the public can
      see" from a staff browser asserts the wrong thing. And it is more
      reliable: driving both the admin app and the public pages through one
      page object meant `page.goto('/blog/…')` could land while the admin
      router was still mid-transition, leaving the public route's Suspense
      fallback on screen — the failure screenshot was `loading.tsx`, while the
      same URL fetched over HTTP returned the finished page in 34ms.
    */
    const readerContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const reader = await readerContext.newPage();

    // ---- create -----------------------------------------------------------
    await page.goto('/admin/blog/new');

    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(TITLE);
    await page.getByLabel('Summary').fill('A summary, which the publish gate requires.');
    await page.getByLabel('Article').fill(BODY);

    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Create draft' }).click(),
    ]);

    // Lands on the post just created.
    await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}/);
    const adminUrl = page.url();
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();

    // ---- a draft is NOT public -------------------------------------------
    /*
      ASSERTED ON CONTENT, NOT ON THE STATUS CODE.

      `notFound()` renders the not-found page but this application answers it
      with 200 — and it does so on EVERY dynamic route, not only this one:
      /stories, /campaigns, /programs and /team behave identically, so it
      predates the blog. It is a soft-404 worth fixing app-wide and is recorded
      in docs/phase-10.7.md rather than papered over here.

      What actually matters for a draft is that none of it reaches the reader,
      and that is what these assert. A status code leaks nothing; content does.
    */
    await reader.goto(`/blog/${SLUG}`);
    await expect(reader.getByText(/couldn.t find that article/i)).toBeVisible({ timeout: 20_000 });
    await expect(reader.getByRole('heading', { level: 1, name: TITLE })).toHaveCount(0);
    expect(await reader.content()).not.toContain(BODY.slice(0, 40));

    await reader.goto('/blog');
    await expect(reader.getByRole('link', { name: TITLE })).toHaveCount(0);

    // ---- publish ----------------------------------------------------------
    await page.goto(adminUrl);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    /*
      Publishing is `@Sensitive()`, so a session that has not re-authenticated
      in the last five minutes is asked for a password. That prompt is the
      designed behaviour, so it is satisfied rather than bypassed — and going
      through the real control matters for a second reason: the server action
      is what calls `revalidateTag('blog')`. Changing the row underneath the
      application would leave the public pages serving their cached copies for
      five minutes and this test asserting on stale HTML.
    */
    await expect(page.getByText(/Confirm your password to continue/i)).toBeVisible();

    await openSensitiveWindow(page);
    await page.goto(adminUrl);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Publish this post?' })).toBeVisible();
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Confirm', exact: true }).click(),
    ]);

    /*
      RELOAD, THEN ASSERT — the pattern `admin-stories.spec.ts` already
      documents. The status panel is re-rendered by `router.refresh()`, a
      second round trip the action's own response does not wait for, so reading
      it immediately races the re-render. Reloading asserts what was actually
      recorded rather than how quickly the client caught up.
    */
    await page.reload();
    await expect(page.getByText(/Status:\s*published/i)).toBeVisible({ timeout: 15_000 });

    await reader.goto(`/blog/${SLUG}`);
    await expect(reader.getByRole('heading', { level: 1, name: TITLE })).toBeVisible({
      timeout: 20_000,
    });
    await expect(reader.getByText(BODY.slice(0, 40))).toBeVisible();

    await reader.goto('/blog');
    await expect(reader.getByRole('link', { name: TITLE })).toBeVisible();

    // ---- and the metadata a search engine would read ----------------------
    await reader.goto(`/blog/${SLUG}`);
    const robots = reader.locator('meta[name="robots"]');
    if (await robots.count()) {
      // The old mock blog was `noindex, nofollow`. A real post must not be.
      await expect(robots.first()).toHaveAttribute('content', /^(?!.*noindex).*$/);
    }
    await expect(reader.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/blog/${SLUG}$`),
    );
    await expect(reader.locator('script[type="application/ld+json"]').first()).toBeAttached();

    // ---- archive ----------------------------------------------------------
    await page.goto(adminUrl);
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Archive this post?' })).toBeVisible();
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Confirm', exact: true }).click(),
    ]);

    await page.reload();
    await expect(page.getByText(/Status:\s*archived/i)).toBeVisible({ timeout: 15_000 });

    await reader.goto(`/blog/${SLUG}`);
    await expect(reader.getByText(/couldn.t find that article/i)).toBeVisible({ timeout: 20_000 });
    expect(await reader.content()).not.toContain(BODY.slice(0, 40));

    await reader.goto('/blog');
    await expect(reader.getByRole('link', { name: TITLE })).toHaveCount(0);

    await readerContext.close();
  });
});

/**
 * Open the five-minute sensitive-operation window.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DONE ON `/admin/settings`, WHICH IS NOT AN ACCIDENT.
 *
 * `ReauthPanel` is rendered in place of a page whose LOAD the API refused. The
 * blog pages are not `@Sensitive()` to read — an editor works on a draft over
 * several sittings — so they load normally and the panel never appears there;
 * a refused publish shows an error banner instead, which has no password field.
 *
 * Settings IS sensitive to read, so visiting it presents the panel. That is
 * also how this works for a real administrator: the confirmation is attached
 * to the session for five minutes, not to one button.
 *
 * The E2E staff account is created with `totp_enabled = false`, so the panel's
 * optional TOTP field is left empty and the password alone is enough.
 * ══════════════════════════════════════════════════════════════════════════
 */
async function openSensitiveWindow(page: import('@playwright/test').Page) {
  /*
    A VOLUNTEER DETAIL PAGE, because its LOAD is what the API marks sensitive.

    `/admin/settings` was the obvious candidate and does not work: only the
    settings UPDATE is `@Sensitive()`, so the page loads normally and the panel
    never appears. `GET admin/volunteers/:id` is one of the two reads that are
    sensitive — a volunteer record carries personal data — so opening one
    presents the prompt.
  */
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  let volunteerId: string;
  try {
    const result = await client.query<{ id: string }>('SELECT id FROM volunteers LIMIT 1');
    if (result.rows.length === 0)
      throw new Error('No volunteer to open the sensitive window with.');
    volunteerId = result.rows[0]!.id;
  } finally {
    await client.end();
  }

  await page.goto(`/admin/volunteers/${volunteerId}`);
  await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();

  /*
    Located by NAME, not by label. This repo's `Label` appends a visually
    hidden "(required)", so `getByLabel('Password', { exact: true })` matches
    nothing — and `getByRole('textbox')`, the usual workaround, does not apply
    either because `input[type=password]` has no implicit textbox role.
  */
  await page.locator('input[name="password"]').fill(E2E_STAFF_SECOND.password);

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
