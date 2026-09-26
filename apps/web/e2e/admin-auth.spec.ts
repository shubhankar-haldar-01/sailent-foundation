import { test, expect } from '@playwright/test';

import { E2E_STAFF } from './global-setup';

/**
 * Staff sign-in, in a browser.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE USED TO BE, AND WHY IT CHANGED.
 *
 * It was written to catch a two-step TOTP form that was broken and that no
 * API test could see: React 19 resets an uncontrolled form once its action
 * completes, so the email and password were wiped the moment the code field
 * appeared, and the second submit went out with no credentials. It surfaced
 * as "Those details do not match an account", which reads exactly like a
 * wrong password.
 *
 * There is no second step any more. Mandatory TOTP for SUPER_ADMIN has been
 * removed — the application has no enrolment route, so requiring a factor
 * nobody could enrol was a deadlock, not a control.
 *
 * So this now asserts the CURRENT contract, and the strongest thing it can
 * say is the negative one: no authenticator field appears, and sign-in
 * completes in a single step. If mandatory TOTP is ever reinstated without
 * building enrolment first, this fails — which is the point of keeping it.
 *
 * The fields remain CONTROLLED in the component. That fix stays whether or
 * not a second step exists, and re-introducing one must not re-introduce the
 * bug.
 *
 * DESKTOP ONLY. Staff sign-in is capped at five attempts a minute per address
 * and those counters are shared across instances via Redis, so running this on
 * all four viewport projects would spend the window on one suite.
 * ══════════════════════════════════════════════════════════════════════════
 */

test('a super admin signs in with email and password, in one step', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Rate limited — one project is enough.');

  await page.goto('/admin/login');

  await page.getByLabel('Email address').fill(E2E_STAFF.email);
  await page.getByLabel('Password').fill(E2E_STAFF.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Straight to the workspace: no interstitial, no second factor.
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20000 });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  // The contract, stated as a negative. Reinstating mandatory TOTP without an
  // enrolment route would fail here rather than in production.
  await expect(page.getByLabel('Authenticator code')).toHaveCount(0);
});

test('a wrong password is refused, and says nothing useful about why', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Rate limited — one project is enough.');

  await page.goto('/admin/login');

  await page.getByLabel('Email address').fill(E2E_STAFF.email);
  await page.getByLabel('Password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Still on the form, with an error that does not confirm the account exists.
  await expect(page).toHaveURL(/\/admin\/login/);
  const error = page.getByText(/do not match/i).first();
  await expect(error).toBeVisible();
});
