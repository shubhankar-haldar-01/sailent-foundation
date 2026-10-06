import { randomUUID } from 'node:crypto';

import { test, expect } from '@playwright/test';

import { STAFF_STATE } from './global-setup';

/**
 * Phase 13 — admin, CMS and communications, in a browser.
 *
 * The API integration suite (apps/api/test/cms-communications.spec.ts) covers
 * every rule and refusal; these check that the screens and public forms are
 * wired to it. Admin screens run on desktop only, like the other admin specs;
 * the public form submissions run once, so the per-client rate limits are not
 * spent four times over.
 */

test.describe('public forms and content', () => {
  test('the contact form stores the message and staff can find it', async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One submission per run.');
    const email = `e2e-contact-${randomUUID().slice(0, 8)}@example.test`;

    await page.goto('/contact');
    await page.getByLabel('Your name').fill('E2E Visitor');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Message').fill('Asking about a CSR partnership for school kits.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('status')).toContainText('Message sent');
    await expect(page.getByText('Preview only')).toHaveCount(0);

    const staff = await browser.newContext({ storageState: STAFF_STATE });
    const admin = await staff.newPage();
    await admin.goto('/admin/messages');
    await admin
      .getByRole('link', { name: /E2E Visitor/ })
      .first()
      .click();
    await expect(admin.getByText(email)).toBeVisible();
    await admin.getByRole('button', { name: 'Mark handled' }).click();
    // The status pill, then the buttons a handled message offers.
    await expect(admin.getByText('handled', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(admin.getByRole('button', { name: 'Mark as new again' })).toBeVisible();
    await staff.close();
  });

  test('the newsletter sign-up asks for confirmation by email', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One submission per run.');
    await page.goto('/');
    const form = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: /Subscribe/ }) });
    await form.getByRole('textbox').fill(`e2e-reader-${randomUUID().slice(0, 8)}@example.test`);
    await form.getByRole('button', { name: /Subscribe/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'check your inbox' })).toBeVisible();
  });

  test('a newsletter link with no token says so instead of acting', async ({ page }) => {
    await page.goto('/newsletter/confirm');
    // Text, not role: Next.js's route announcer is also role=alert.
    await expect(page.getByText('This link is incomplete')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm my subscription' })).toHaveCount(0);
  });

  test('/faq shows the published questions from the database, never a draft', async ({ page }) => {
    await page.goto('/faq');
    await expect(
      page.getByRole('button', { name: 'Can I set up a regular donation?' }),
    ).toBeVisible();
    await expect(page.getByText('Demo unpublished general question')).toHaveCount(0);
  });

  test('search finds published content through the API', async ({ page }) => {
    await page.goto('/search?q=Disaster');
    await expect(page.getByRole('heading', { name: 'Disaster Relief' }).first()).toBeVisible();
    await expect(page.getByText(/results? for/)).toBeVisible();
  });

  test('no page offers monthly or recurring giving', async ({ page }) => {
    for (const path of ['/', '/faq', '/donate']) {
      await page.goto(path);
      await expect(
        page.getByText(/give monthly|monthly (giving|donation|donor)|recurring (donation|gift)/i),
        path,
      ).toHaveCount(0);
    }
  });
});

test.describe('staff accounts without a session', () => {
  test('forgot password answers without revealing whether the account exists', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');
    await page.goto('/admin/login');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(/\/admin\/forgot-password$/);
    await page.getByLabel('Email address').fill(`nobody-${randomUUID().slice(0, 8)}@example.test`);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText(
      'If that address belongs to an active staff account',
    );
  });

  test('an invitation page opened without its token does nothing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');
    await page.goto('/admin/accept-invite');
    await expect(page.getByText('This link is incomplete')).toBeVisible();
    await expect(page.getByLabel('New password')).toHaveCount(0);
  });
});

test.describe('admin screens', () => {
  test.use({ storageState: STAFF_STATE });

  test('the dashboard shows live figures, not a placeholder', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Campaigns open for donations')).toBeVisible();
    await expect(page.getByText('Needs attention')).toBeVisible();
    await expect(page.getByText('Operational dashboard')).toHaveCount(0);
  });

  test('a campaign is edited with its cover, gallery and progress updates', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');
    await page.goto('/admin/campaigns');
    // Straight to the address: the edit page loads a dozen things, and a click
    // that has not finished navigating is not what this test is about.
    const href = await page
      .locator('a[href^="/admin/campaigns/"][href$="/edit"]')
      .first()
      .getAttribute('href');
    await page.goto(href!);
    await expect(page.getByRole('heading', { name: 'Cover image' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campaign Gallery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Progress updates' })).toBeVisible();
  });

  test('general FAQs are managed in the admin, drafts included', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');
    await page.goto('/admin/faqs');
    await expect(page.getByText('Demo unpublished general question')).toBeVisible();
    await expect(page.getByText('Draft — not on the site').first()).toBeVisible();
  });

  test('the newsletter list and the messages inbox open', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');
    await page.goto('/admin/newsletter');
    await expect(page.getByRole('heading', { level: 1, name: 'Newsletter' })).toBeVisible();
    await page.goto('/admin/messages');
    await expect(page.getByRole('heading', { level: 1, name: 'Messages' })).toBeVisible();
  });
});
