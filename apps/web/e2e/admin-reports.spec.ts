import { test, expect } from '@playwright/test';

import { E2E_STAFF_FOURTH } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * Reports, reconciliation and tax readiness, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE DOWNLOAD IS THE PART ONLY A BROWSER CAN CHECK.
 *
 * §4.22's acceptance criterion is that Finance can export donations for a
 * range. The API suite proves the CSV is correct, audited and permission-
 * gated. What it cannot prove is that a person clicking a link in the admin
 * actually receives a file — that involves a route handler, a redirect on
 * re-auth, and `Content-Disposition`, none of which exist inside the API.
 *
 * READ-ONLY. Nothing here writes a row, so there is no cleanup: reports are
 * queries, and the one thing an export writes is an audit entry, which is
 * append-only by design and must not be deleted to tidy up after a test.
 * ══════════════════════════════════════════════════════════════════════════
 */

/*
  Shares `E2E_STAFF_FOURTH` with `admin-documents` and `admin-notifications`.

  Exporting is `@Sensitive()`, and this spec asserts the REFUSAL rather than a
  successful export — so it neither needs a re-auth window nor minds one being
  open. `mode: 'serial'` keeps the three from interleaving.
*/
test.use({ storageState: E2E_STAFF_FOURTH.state });
test.describe.configure({ mode: 'serial' });

const RANGE = { from: '2020-01-01', to: '2020-12-31' };
const QUERY = `from=${RANGE.from}&to=${RANGE.to}`;

test.describe('reports', () => {
  test('shows donations broken down by payment state', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto(`/admin/reports?${QUERY}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();

    /*
      The screen has to say this. These figures include pending and failed
      payments, which the public site never shows — and an administrator who
      confused the two would quote a number the organisation cannot stand
      behind (A14).
    */
    await expect(page.getByText(/internal figures/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Donations' })).toBeVisible();
    await expect(page.getByText(/By payment state/i)).toBeVisible();
  });

  test('the range is in the URL, so a report can be sent to a colleague', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/reports');
    // A default range, not an empty screen.
    await expect(page.getByRole('heading', { name: 'Donations' })).toBeVisible();

    await page.locator('input[name="from"]').fill('2021-01-01');
    await page.locator('input[name="to"]').fill('2021-06-30');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(/from=2021-01-01/);
    await expect(page).toHaveURL(/to=2021-06-30/);
  });

  test('shows the volunteer and impact views too', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto(`/admin/reports?${QUERY}`);
    await expect(page.getByRole('heading', { name: 'Volunteers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Impact' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  });
});

test.describe('the export', () => {
  test('is REFUSED without a re-authentication, and says so where you can answer', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto(`/admin/reports?${QUERY}`);

    /*
      A download cannot render a password prompt, so the route handler carries
      the refusal back as a flag and the page shows the panel. Asserting this
      is the point of testing it in a browser at all.
    */
    // Scoped to the export region: "Donations" is also a sidebar menu item.
    await page
      .getByRole('region', { name: 'Export' })
      .getByRole('link', { name: 'Donations' })
      .click();

    await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('offers only the datasets this operator may export', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto(`/admin/reports?${QUERY}`);
    const exports = page.getByRole('region', { name: 'Export' });
    await expect(exports).toBeVisible();

    // SUPER_ADMIN holds every permission, so every dataset is offered. The
    // filtering itself is enforced in the API and asserted there.
    for (const label of ['Donations', 'Donors', 'Volunteers', 'Campaigns', 'Impact records']) {
      await expect(exports.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('the export endpoint refuses an unauthenticated caller', async ({ request }) => {
    /*
      ABSOLUTE against `e2eStack.apiUrl` — the `request` fixture is based at the
      WEB server, where `/api/v1/...` does not exist, so a relative path would
      answer 404 whatever the truth was.
    */
    const response = await request.post(`${e2eStack.apiUrl}/api/v1/admin/reports/export`, {
      data: { dataset: 'donations', ...RANGE },
    });
    expect(response.status()).toBe(401);
  });

  test('there is no public report route', async ({ request }) => {
    for (const path of ['/reports', '/reports/donations', '/reports/export']) {
      const response = await request.get(`${e2eStack.apiUrl}/api/v1${path}`);
      expect(response.status()).toBe(404);
    }
  });
});

test.describe('reconciliation', () => {
  test('answers what is stuck, and offers no way to change a payment', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto(`/admin/reconciliation?${QUERY}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Reconciliation' })).toBeVisible();

    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(page.getByText(/Captured without a receipt/i)).toBeVisible();

    /*
      NOTHING HERE MOVES MONEY. A donation becomes successful on a verified
      webhook and on nothing else (decision A3); a button on this page that
      marked one captured would be a button that takes an unverified word for
      it. Asserted as an absence, because that is what the design is.
    */
    await expect(page.getByRole('button', { name: /mark|capture|settle|resolve/i })).toHaveCount(0);
  });
});

test.describe('tax readiness', () => {
  test('counts what could not go on the return, and files nothing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/tax');
    await expect(page.getByRole('heading', { level: 1, name: 'Tax compliance' })).toBeVisible();

    // A7: the receipt a donor holds is not their 80G certificate, and the
    // screen has to say so or somebody will assume otherwise.
    await expect(page.getByText(/not an 80G certificate/i)).toBeVisible();
    await expect(page.getByText(/Filing deadline/i)).toBeVisible();
    // Exact: the deadline paragraph above mentions the same phrase.
    await expect(page.getByText('Missing a tax ID', { exact: true })).toBeVisible();

    /*
      NO GENERATE BUTTON. `form_10bd_exports` is documented and deferred, and a
      button producing an unreviewed statutory filing would be worse than not
      having one.
    */
    await expect(page.getByRole('button', { name: /generate|file|submit/i })).toHaveCount(0);
  });

  test('reads a specific financial year from the URL', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/tax?financialYear=2025');
    await expect(page.getByText('2025-2026').first()).toBeVisible();
    // 31 May is the statutory deadline, a fact about Indian tax law.
    await expect(page.getByText('2026-05-31')).toBeVisible();
  });
});

test.describe('reports are staff-only', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects a signed-out visitor away from every screen', async ({ page }) => {
    for (const path of ['/admin/reports', '/admin/reconciliation', '/admin/tax']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });
});
