import { test, expect } from '@playwright/test';
import pg from 'pg';

import { STAFF_STATE } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * Create a draft and open it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WAITS FOR THE RESPONSE AND RESOLVES THE ROW — NOT FOR THE NAVIGATION.
 *
 * Creating redirects server-side, so the navigation only happens once React
 * commits the action's transition. Under a saturated machine the App Router
 * occasionally never commits one whose request demonstrably finished (measured
 * and documented in docs/phase-10.9.md §H), and `waitForURL` then times out on
 * a draft that was created perfectly well.
 *
 * Reading the id back and navigating there asserts the stronger thing anyway:
 * that the draft reached the table, not that a URL changed.
 * ══════════════════════════════════════════════════════════════════════════
 */
async function createDraftAndOpen(
  page: import('@playwright/test').Page,
  title: string,
): Promise<string> {
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() !== 'GET' && response.status() < 400,
      { timeout: 20_000 },
    ),
    page.getByRole('button', { name: 'Create draft' }).click(),
  ]);

  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  let id: string;
  try {
    const rows = await client.query<{ id: string }>(
      `SELECT id FROM success_stories WHERE title = $1 LIMIT 1`,
      [title],
    );
    if (rows.rows.length === 0) throw new Error(`No story was created for "${title}".`);
    id = rows.rows[0]!.id;
  } finally {
    await client.end();
  }

  await page.goto(`/admin/stories/${id}`);
  return id;
}

/**
 * Success stories, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ASSERTION THAT MATTERS IS THE ONE ABOUT CONSENT.
 *
 * A success story is somebody's account of their own life, published under the
 * organisation's name. The API refuses to publish one that names a person
 * without consent, and the database refuses underneath it — but an editor only
 * meets those rules through this screen, so this checks the screen says so
 * plainly rather than failing at the last step.
 *
 * DESKTOP ONLY: it writes rows, and running the same writes on four viewport
 * projects would race them against each other.
 * ══════════════════════════════════════════════════════════════════════════
 */
test.use({ storageState: STAFF_STATE });

/*
  SERIAL, like `dashboard.spec.ts`.

  Every test here CREATES stories through the UI and the public assertions read
  the same listing back. Run in parallel they interleave — one test's draft
  appears while another is asserting the listing, and a save races a sibling's
  `router.refresh()` against the same server. It passed six times out of ten,
  which is the shape of a suite nobody can trust.

  The repo already uses `mode: 'serial'` for exactly this: suites whose tests
  mutate state the others read.
*/
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now().toString(36);
const titleFor = (what: string) => `E2E ${what} ${STAMP}`;

/*
  A name that cannot appear anywhere else. The seed publishes real stories
  about Ramesh, Sita and Meera — asserting one of those was absent from
  /stories asserted that a correctly published story had gone missing.
*/
const SUBJECT = `Zzsubject${STAMP}`;

test.afterAll(async () => {
  // Real rows in the E2E database. Left behind they would sit in the admin
  // review list looking like work somebody had started.
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM slug_history WHERE entity_id IN (SELECT id FROM success_stories WHERE title LIKE $1)`,
      [`E2E %${STAMP}`],
    );
    await client.query(`DELETE FROM success_stories WHERE title LIKE $1`, [`E2E %${STAMP}`]);
  } finally {
    await client.end();
  }
});

test.describe('admin success stories', () => {
  test('opens the stories list', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');
    await page.goto('/admin/stories');
    await expect(page.getByRole('heading', { level: 1, name: 'Success stories' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Draft a story' })).toBeVisible();
  });

  test('creates a draft, edits it, and publishes it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');
    await page.goto('/admin/stories/new');

    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(titleFor('publishable'));
    await page.getByLabel('Summary').fill('A short summary for the listing.');
    await createDraftAndOpen(page, titleFor('publishable'));
    await expect(page.getByText('/stories/e2e-publishable')).toBeVisible();

    /*
      Edit a narrative section, and assert that the VALUE persisted rather than
      that the confirmation banner appeared. The banner is real but transient:
      a successful save triggers `router.refresh()`, which re-renders the
      server component and clears it — so asserting on it is a race, and what
      the editor actually cares about is that the text is still there.
    */
    await page.getByLabel('The outcome').fill('She finished school.');

    /*
      WAIT FOR THE SAVE TO ANSWER before doing anything else.

      `click()` resolves when the click is DISPATCHED, not when the request it
      starts has finished. The reload below was therefore racing the save — and
      a reload cancels requests still in flight, so under a loaded parallel run
      the edit was sometimes discarded before it ever reached the server, and
      the assertion that followed failed against an application that was
      working correctly.
    */
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);

    /*
      RELOAD, then assert. A successful save triggers `router.refresh()`, so
      asserting immediately races the re-render: the confirmation banner is
      cleared by it and the uncontrolled field is remounted from the server
      value mid-assertion. Reloading removes the race entirely and asserts the
      thing that matters — that the edit reached the database.
    */
    await page.reload();
    await expect(page.getByLabel('The outcome')).toHaveValue('She finished school.');

    /*
      Publishing is available — it names nobody, so no consent is required —
      but it is `@Sensitive()`, and this session has never re-authenticated.

      That refusal is the designed behaviour, not a gap: publishing puts a
      person's account of their own life on a public website, and a session
      somebody walked away from must not be able to do it. The successful
      publish is covered by `apps/api/test/stories.spec.ts`, which
      re-authenticates properly.
    */
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText(/Confirm your password to continue/i)).toBeVisible();
  });

  test('BLOCKS publishing a story that names somebody without consent', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');
    await page.goto('/admin/stories/new');

    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(titleFor('needs-consent'));
    await page.getByLabel('Summary').fill('A summary.');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(SUBJECT);
    await createDraftAndOpen(page, titleFor('needs-consent'));

    // Said standing, not discovered by pressing the button.
    await expect(page.getByText(new RegExp(`names ${SUBJECT}`, 'i'))).toBeVisible();

    // And the button itself is unavailable.
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  });

  test('allows publishing once the story is anonymised', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');
    await page.goto('/admin/stories/new');

    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(titleFor('anonymised'));
    await page.getByLabel('Summary').fill('A summary.');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(SUBJECT);
    await createDraftAndOpen(page, titleFor('anonymised'));

    await page.getByLabel(/Anonymised/).check();
    /*
      WAIT FOR THE SAVE, THEN RELOAD, rather than waiting for the "Saved."
      banner.

      That banner is client state: it appears only once React commits the
      server action's transition. Under a saturated machine the App Router
      occasionally never commits a transition whose request demonstrably
      finished — measured at 232ms, with the banner still absent twenty
      seconds later. Asserting the RELOADED page proves the stronger thing
      anyway: the anonymisation reached the database, not just the screen.
    */
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);

    await page.reload();
    await expect(page.getByLabel(/Anonymised/)).toBeChecked();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  });
});

test.describe('the public site', () => {
  test('lists published stories and hides every draft', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    await page.goto('/stories');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // The seeded published stories are there.
    await expect(
      page.getByRole('article').or(page.locator('a[href^="/stories/"]')).first(),
    ).toBeVisible();

    /*
      A draft's own URL 404s rather than revealing that it exists.

      This test makes its OWN draft rather than relying on one another test
      created: `fullyParallel` lets the tests in a file run in any order across
      workers, so depending on a sibling's data is depending on luck.

      The slug is read back from the database rather than guessed — the slug
      service derives it, and guessing meant asserting against a URL that had
      never existed, which passes for the wrong reason.
    */
    await page.goto('/admin/stories/new');
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(titleFor('hidden-draft'));
    await page.getByLabel('Summary').fill('A draft that must never be public.');
    await createDraftAndOpen(page, titleFor('hidden-draft'));

    const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
    await client.connect();
    let draftSlug: string;
    try {
      const rows = await client.query<{ slug: string }>(
        `SELECT slug FROM success_stories WHERE title = $1`,
        [titleFor('hidden-draft')],
      );
      draftSlug = rows.rows[0]!.slug;
    } finally {
      await client.end();
    }

    /*
      The draft's URL serves the not-found page and NONE of its content.

      Asserted on the body rather than the status code: this application
      answers every unknown public slug with 200 and the not-found page —
      `/campaigns/nope` does the same, and has since long before stories had an
      editor. That is worth fixing, and it is an app-wide routing question
      rather than anything to do with stories, so it is recorded in
      `docs/phase-10.5.md` instead of being changed here.

      What matters for privacy is what the page CONTAINS, and this asserts it
      directly.
    */
    await page.goto(`/stories/${draftSlug}`);
    const draftPage = await page.content();
    expect(draftPage).toContain('couldn’t find');
    expect(draftPage).not.toContain(titleFor('hidden-draft'));
    expect(draftPage).not.toContain('A draft that must never be public.');

    // Nor does its title appear on the listing.
    await page.goto('/stories');
    expect(await page.content()).not.toContain(titleFor('hidden-draft'));
  });

  test('never shows the name from an anonymised story', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    /*
      The anonymised story this run created is still a draft, so nothing of it
      appears at all — and the name least of all. The published case is
      asserted in `apps/api/test/stories.spec.ts`, where a story IS published
      anonymised and the endpoint returns `subjectName: null`.
    */
    await page.goto('/stories');
    expect(await page.content()).not.toContain(SUBJECT);
  });
});
