import { test, expect } from '@playwright/test';
import pg from 'pg';

import { E2E_STAFF_FOURTH } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * Notifications, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BROWSER IS THE ONLY WITNESS TO "VISIBLE TO ADMINS".
 *
 * §4.21's acceptance criterion ends "…and a failed send is retried and visible
 * to admins". The retry lives in the worker and the log entry in the database,
 * and both are tested where they live. Whether an administrator actually finds
 * out is a question about a screen and a bell, and nothing but a browser can
 * answer it.
 *
 * Sending is not exercised here: `playwright.config.ts` runs the stack without
 * a Brevo key, so nothing leaves the machine. The rows these tests read are
 * written straight into the send log, which is exactly what the worker does.
 * ══════════════════════════════════════════════════════════════════════════
 */

/*
  SHARES `E2E_STAFF_FOURTH` WITH `admin-documents`, deliberately.

  Both need a re-auth window and neither asserts that the window is absent, so
  they can share one account — unlike `admin-blog`, `admin-stories` and
  `admin-pages`, each of which asserts its own sensitive action is REFUSED
  without one. `mode: 'serial'` keeps them from interleaving.
*/
test.use({ storageState: E2E_STAFF_FOURTH.state });
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now().toString(36);
const TITLE = `E2E notification ${STAMP}`;

async function withDatabase<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** The signed-in staff account's id, for addressing an in-app notification. */
async function staffId(): Promise<string> {
  return withDatabase(async (client) => {
    const rows = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [E2E_STAFF_FOURTH.email],
    );
    return rows.rows[0]!.id;
  });
}

test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query(`DELETE FROM notifications WHERE title LIKE $1`, ['E2E notification %']);
  });
});

test.describe('the notification inbox', () => {
  test('the bell carries the unread count into the page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    const userId = await staffId();
    await withDatabase(async (client) => {
      await client.query(
        `INSERT INTO notifications
           (user_id, recipient_type, recipient_id, type, title, message, channel, status, sent_at)
         VALUES ($1, 'user', $1, 'notification.send_failed', $2, $3, 'in_app', 'sent', now())`,
        [userId, TITLE, 'A receipt was not delivered (unreachable)'],
      );
    });

    await page.goto('/admin/notifications');

    /*
      The COUNT IS IN THE LABEL, not only in the coloured dot. A badge a screen
      reader cannot read is decoration, and "you have unread notifications" is
      exactly the sort of thing that must not be conveyed by colour and
      position alone.
    */
    await expect(page.getByRole('link', { name: /Notifications, \d+ unread/ })).toBeVisible();

    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    await expect(page.getByText(TITLE)).toBeVisible();
  });

  test('marking one read removes it from the unread filter', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    await page.goto('/admin/notifications?unread=true');
    await expect(page.getByText(TITLE)).toBeVisible();

    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page
        .getByRole('listitem')
        .filter({ hasText: TITLE })
        .getByRole('button', { name: /Mark read/i })
        .click(),
    ]);

    await page.goto('/admin/notifications?unread=true');
    await expect(page.getByText(TITLE)).toHaveCount(0);

    // But it is still there, read, in the full list. Nothing was destroyed.
    await page.goto('/admin/notifications');
    await expect(page.getByText(TITLE)).toBeVisible();
  });

  test('NEVER shows another administrator’s notifications', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    const mine = await staffId();
    const theirs = await withDatabase(async (client) => {
      const rows = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE id <> $1 AND status = 'active' LIMIT 1`,
        [mine],
      );
      return rows.rows[0]?.id ?? null;
    });

    test.skip(theirs === null, 'Only one staff account in this database.');

    await withDatabase(async (client) => {
      await client.query(
        `INSERT INTO notifications
           (user_id, recipient_type, recipient_id, type, title, message, channel, status, sent_at)
         VALUES ($1, 'user', $1, 'notification.send_failed', $2, $3, 'in_app', 'sent', now())`,
        [theirs, `${TITLE} theirs`, 'Not for this administrator'],
      );
    });

    await page.goto('/admin/notifications');
    await expect(page.getByText(`${TITLE} theirs`)).toHaveCount(0);
  });
});

test.describe('the send log', () => {
  test('shows a failed send, why it failed, and offers a retry', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    await withDatabase(async (client) => {
      await client.query(
        `INSERT INTO notifications
           (recipient_type, type, title, message, data, channel, status, error)
         VALUES ('donor', 'donation.confirmation', $1, 'A receipt', $2::jsonb, 'email', 'failed', 'unreachable')`,
        [`${TITLE} failed`, JSON.stringify({ donationId: '00000000-0000-4000-8000-000000000000' })],
      );
    });

    await page.goto('/admin/notifications/log?status=failed');

    await expect(page.getByRole('heading', { level: 1, name: 'Send log' })).toBeVisible();
    await expect(page.getByText(`${TITLE} failed`)).toBeVisible();
    // The reason, not just the fact.
    await expect(page.getByText('unreachable').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Try again/i }).first()).toBeVisible();
  });

  test('never prints a recipient’s email address', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    /*
      An administrator asking "did that receipt go out" needs the answer. They
      do not need a browsable list of donor addresses, and a screen offering
      one would be the easiest place in the platform to harvest them from.

      ASSERTED AGAINST THE REAL ADDRESSES IN THE DATABASE, not against a regex
      for anything email-shaped. The first version of this matched
      `hello@sailentfoundation.org` — the organisation's OWN contact address,
      printed in the admin shell — and failed for a reason that had nothing to
      do with the property under test.
    */
    const addresses = await withDatabase(async (client) => {
      const rows = await client.query<{ email: string }>(
        `SELECT email FROM donors WHERE email IS NOT NULL
         UNION SELECT email FROM users WHERE email IS NOT NULL`,
      );
      return rows.rows.map((row) => row.email);
    });

    expect(addresses.length).toBeGreaterThan(0);

    await page.goto('/admin/notifications/log');
    const body = await page.content();

    for (const address of addresses) {
      expect(body).not.toContain(address);
    }
  });

  test('a retry is REFUSED without a re-authentication', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    await page.goto('/admin/notifications/log?status=failed');

    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page
        .getByRole('button', { name: /Try again/i })
        .first()
        .click(),
    ]);

    // `notification.send` is sensitive, and the API is what decides that.
    await expect(page.getByText(/Confirm your password to continue/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('email templates', () => {
  test('lists a template for every transactional email', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/notification-templates');
    await expect(page.getByRole('heading', { level: 1, name: 'Email templates' })).toBeVisible();

    // §4.21: "every transactional email has a template".
    for (const slug of [
      'donation.confirmation',
      'donor.login_code',
      'volunteer.approved',
      'volunteer.certificate.issued',
    ]) {
      await expect(page.getByText(slug, { exact: true })).toBeVisible();
    }
  });

  test('previews a draft with the SAME renderer the worker uses', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/notification-templates');
    await page.getByRole('link', { name: 'Volunteer approved' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Volunteer approved' })).toBeVisible();
    // The editor is told what the sender actually supplies.
    await expect(page.getByText('{{volunteerName}}').first()).toBeVisible();

    await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes('/preview') || response.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: /^Preview$/ }).click(),
    ]);

    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible({ timeout: 20_000 });
    // Rendered inside a sandboxed frame, not injected into the admin DOM.
    await expect(page.locator('iframe[title="Rendered email"]')).toBeVisible();
  });

  test('saves a new VERSION rather than overwriting', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    await page.goto('/admin/notification-templates');
    await page.getByRole('link', { name: 'Volunteer application received' }).click();

    const before = await withDatabase(async (client) => {
      const rows = await client.query<{ version: number }>(
        `SELECT version FROM notification_templates WHERE slug = 'volunteer.application.received'`,
      );
      return rows.rows[0]!.version;
    });

    await page.locator('input[name="subject"]').fill(`We have your application ${STAMP}`);
    await page.locator('input[name="note"]').fill('An end-to-end edit.');

    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() !== 'GET' && response.status() < 400,
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: /Save as version/ }).click(),
    ]);

    const after = await withDatabase(async (client) => {
      const rows = await client.query<{ version: number; subject: string }>(
        `SELECT version, subject FROM notification_templates WHERE slug = 'volunteer.application.received'`,
      );
      return rows.rows[0]!;
    });

    expect(after.version).toBe(before + 1);
    expect(after.subject).toBe(`We have your application ${STAMP}`);

    // And the previous wording is recoverable.
    const revisions = await withDatabase(async (client) => {
      const rows = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM notification_template_revisions r
         JOIN notification_templates t ON t.id = r.template_id
         WHERE t.slug = 'volunteer.application.received'`,
      );
      return Number(rows.rows[0]!.n);
    });
    expect(revisions).toBeGreaterThan(0);
  });
});

test.describe('notifications are staff-only', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects a signed-out visitor away from every screen', async ({ page }) => {
    for (const path of [
      '/admin/notifications',
      '/admin/notifications/log',
      '/admin/notification-templates',
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });
});
