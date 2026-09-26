import { test, expect } from '@playwright/test';

import { STAFF_STATE } from './global-setup';

/**
 * The Phase 10.2–10.4 admin screens.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * These screens are pure frontend over APIs that already existed — users,
 * roles and audit have been reachable by curl since Phase 3 and 7 and had no
 * UI at all. So what is worth asserting is not that the API works, which its
 * own suites cover, but that the SCREEN tells the truth about it:
 *
 *   - exactly one administrative role is offered anywhere,
 *   - no retired role name appears,
 *   - the audit log is read-only,
 *   - settings that govern nothing are labelled as such.
 * ══════════════════════════════════════════════════════════════════════════
 */
test.use({ storageState: STAFF_STATE });

/** Names Phase 8 retired. None may appear in any admin screen. */
const RETIRED_ROLES = [
  'FINANCE_MANAGER',
  'CAMPAIGN_MANAGER',
  'VOLUNTEER_MANAGER',
  'CONTENT_MANAGER',
  'Finance Manager',
  'Campaign Manager',
  'Volunteer Manager',
  'Content Manager',
];

test.describe('staff administration', () => {
  test('lists staff accounts without leaking a credential', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: 'Staff accounts' })).toBeVisible();

    // The seeded and suspended development accounts are all here.
    await expect(page.getByRole('table')).toBeVisible();

    const body = (await page.content()).toLowerCase();
    for (const secret of ['passwordhash', 'password_hash', 'totpsecret', 'totp_secret', 'argon2']) {
      expect(body, secret).not.toContain(secret);
    }
  });

  test('offers NO role picker, because there is one role', async ({ page }) => {
    await page.goto('/admin/users');

    const content = await page.content();
    for (const role of RETIRED_ROLES) {
      expect(content, role).not.toContain(role);
    }

    // And no select that would imply a choice.
    await expect(page.locator('select[name*="role" i]')).toHaveCount(0);
  });

  test('shows the single role and its permissions, read-only', async ({ page }) => {
    await page.goto('/admin/roles');
    await expect(page.getByRole('heading', { level: 2, name: 'SUPER_ADMIN' })).toBeVisible();

    const content = await page.content();
    for (const role of RETIRED_ROLES) {
      expect(content, role).not.toContain(role);
    }

    // Read-only: nothing on this screen may write.
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /save|create|delete|edit/i })).toHaveCount(0);
  });

  test('renders the audit log, and offers no way to change it', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Decision A10: append-only. No edit, no delete, no clear.
    await expect(page.getByRole('button', { name: /delete|remove|clear entries/i })).toHaveCount(0);

    // The filter form is a GET; it must not post anything.
    for (const form of await page.locator('form').all()) {
      const method = ((await form.getAttribute('method')) ?? 'get').toLowerCase();
      expect(method).toBe('get');
    }
  });

  test('settings show current values and say which govern nothing', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    await expect(page.getByLabel('Organisation name')).toHaveValue(/\S/);

    // The honest labelling this screen exists to carry.
    await expect(page.getByText(/not yet enforced/i)).toBeVisible();

    // FCRA is read-only: the organisation is not registered and no code reads it.
    await expect(page.getByLabel('Foreign contributions (FCRA)')).toBeDisabled();
  });
});
