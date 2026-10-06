import { test, expect, type Page } from '@playwright/test';
import pg from 'pg';

import { STAFF_STATE } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * An administrator decides what leads the homepage.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * "Feature on the homepage" on a campaign's admin form puts it at the front
 * of the Featured Campaigns band, in the order given; un-ticking it takes it
 * out again. The assertions are on the DATABASE and on the PUBLIC PAGE, not on
 * a confirmation banner: what matters is that the choice was stored and that
 * visitors see it.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Uses a seeded campaign that is active and NOT featured, and puts its flags
 * back afterwards whatever happens, so no other spec sees the change.
 */
const SLUG = 'greener-communities-bhopal';
const TITLE = 'Greener Communities';

type Flags = { id: string; is_featured: boolean; featured_order: number | null };

async function query<T extends pg.QueryResultRow>(sql: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    return (await client.query<T>(sql, values)).rows;
  } finally {
    await client.end();
  }
}

const flagsOf = async () =>
  (
    await query<Flags>(
      `SELECT id, is_featured, featured_order FROM campaigns WHERE slug = $1 LIMIT 1`,
      [SLUG],
    )
  )[0];

/** Save, and wait for the request to answer — not just for the click. */
async function save(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.status() < 400,
      { timeout: 20_000 },
    ),
    page.getByRole('button', { name: 'Save changes' }).click(),
  ]);
}

const firstFeatured = (page: Page) =>
  page.getByRole('list', { name: 'Featured campaigns' }).getByRole('listitem').first();

test.use({ storageState: STAFF_STATE });

test.describe('featuring a campaign on the homepage', () => {
  let original: Flags | undefined;

  test.beforeAll(async () => {
    original = await flagsOf();
  });

  test.afterAll(async () => {
    if (!original) return;
    await query(`UPDATE campaigns SET is_featured = $2, featured_order = $3 WHERE id = $1`, [
      original.id,
      original.is_featured,
      original.featured_order,
    ]);
  });

  test('an administrator features a campaign, and it leads the band', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');
    expect(original, `the seeded campaign ${SLUG} exists`).toBeDefined();
    expect(original!.is_featured).toBe(false);

    // Not featured: something else leads the band.
    await page.goto('/');
    await expect(firstFeatured(page)).not.toContainText(TITLE);

    // Feature it, first in line.
    await page.goto(`/admin/campaigns/${original!.id}/edit`);
    await page.getByRole('checkbox', { name: 'Feature on the homepage' }).check();
    await page.getByLabel('Featured order').fill('0');
    await save(page);

    await expect.poll(flagsOf).toMatchObject({ is_featured: true, featured_order: 0 });

    // The list says so too.
    await page.goto('/admin/campaigns');
    await expect(
      page.getByRole('row').filter({ hasText: TITLE }).getByText('Featured · 0'),
    ).toBeVisible();

    // And visitors see it first.
    await page.goto('/');
    await expect(firstFeatured(page)).toContainText(TITLE);

    // Un-featuring clears the order too, so no stale position is left behind.
    await page.goto(`/admin/campaigns/${original!.id}/edit`);
    await expect(page.getByLabel('Featured order')).toHaveValue('0');
    await page.getByRole('checkbox', { name: 'Feature on the homepage' }).uncheck();
    await expect(page.getByLabel('Featured order')).toHaveCount(0);
    await save(page);

    await expect.poll(flagsOf).toMatchObject({ is_featured: false, featured_order: null });

    await page.goto('/');
    await expect(firstFeatured(page)).not.toContainText(TITLE);
  });
});
