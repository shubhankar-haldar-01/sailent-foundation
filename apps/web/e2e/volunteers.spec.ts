import { test, expect } from '@playwright/test';
import pg from 'pg';

import { e2eStack } from '../playwright.config';

/**
 * The public volunteer application, in a browser.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS SUITE EXISTS BECAUSE THE FORM SUBMITTED ALMOST NOTHING AND EVERYTHING
 * ELSE PASSED.
 *
 * Only the current step is mounted, so the `FormData(form)` read on the final
 * submit saw the review step and nothing before it — the application arrived
 * as `{"availability":{}}`. Every API test passed, because the API was handed
 * a valid payload directly. Every unit test passed, because the validation
 * schema was correct. It needs a real browser walking real steps.
 *
 * DESKTOP ONLY, deliberately. The apply endpoint is throttled to three
 * submissions an hour per address — a real control on an unauthenticated
 * write, not a nuisance. Four viewport projects would spend the hour's budget
 * on one run and fail the next three on the limiter rather than on the code.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Unique per run, and recognisable to the teardown below. */
const EMAIL = `e2e-volunteer-${Date.now().toString(36)}@example.test`;
const PHONE = `98${String(Date.now()).slice(-8)}`;

test.afterAll(async () => {
  // A real row in the real database. Leaving it behind would put a fictional
  // person in the admin review queue, which is the sort of test residue that
  // gets actioned by somebody who does not know it is a fixture.
  // The E2E database, not the application's. This deletes rows.
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM volunteer_applications
             WHERE volunteer_id IN (SELECT id FROM volunteers WHERE email LIKE 'e2e-volunteer-%')`,
    );
    await client.query(`DELETE FROM volunteers WHERE email LIKE 'e2e-volunteer-%'`);
  } finally {
    await client.end();
  }
});

test('an application survives all six steps and reaches the database', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Throttled to 3/hour — one project is enough.');

  await page.goto('/volunteer#apply');

  // ---- Step 1: personal details -----------------------------------------
  await expect(page.getByRole('heading', { name: 'Personal details' })).toBeVisible();
  await page.getByLabel('Full name').fill('Playwright Applicant');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mobile number').fill(PHONE);
  await page.getByLabel('City or district').fill('Pune');
  await page.getByRole('button', { name: 'Continue' }).click();

  // ---- Step 2: skills ----------------------------------------------------
  await expect(page.getByText('What can you help with?')).toBeVisible();
  await page.getByLabel('Teaching or tutoring').check();
  await page.getByLabel('Relevant experience').fill('Two years of weekend tutoring.');
  await page.getByRole('button', { name: 'Continue' }).click();

  // ---- Step 3: interests -------------------------------------------------
  await page.getByRole('button', { name: 'Continue' }).click();

  // ---- Step 4: availability ---------------------------------------------
  // A Radix select, not a native one — it renders a combobox button and a
  // listbox, and a hidden input carries the value into the form.
  await page.getByRole('combobox', { name: 'Which days suit you?' }).click();
  await page.getByRole('option', { name: 'Weekends' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // ---- Step 5: emergency contact ----------------------------------------
  await page.getByLabel('Emergency contact name').fill('Named Sibling');
  await page.getByLabel('Emergency contact number').fill('9876543210');
  await page.getByLabel('Relationship to you').fill('Sister');
  await page.getByRole('button', { name: 'Continue' }).click();

  // ---- Step 6: review and submit ----------------------------------------
  await expect(page.getByText('Teaching or tutoring')).toBeVisible();
  await page.getByRole('button', { name: 'Submit application' }).click();

  // The page must say so plainly, and must NOT promise a decision date the
  // organisation has not committed to.
  await expect(page.getByText('Thank you — we have your application')).toBeVisible({
    timeout: 20000,
  });

  /*
    THE ASSERTION THE BUG WOULD HAVE FAILED. A confirmation on screen is not
    evidence the answers arrived — the broken version rendered exactly this
    screen while storing an empty object. So this reads the row back and checks
    a field from the FIRST step, which is the one furthest from the submit.
  */
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    const stored = await client.query<{
      first_name: string;
      phone: string;
      city: string | null;
      emergency_contact_name: string | null;
      emergency_contact_relation: string | null;
      volunteer_id: string | null;
      status: string;
    }>(
      `SELECT first_name, phone, city, emergency_contact_name,
              emergency_contact_relation, volunteer_id, status
         FROM volunteers WHERE lower(email) = lower($1)`,
      [EMAIL],
    );

    expect(stored.rows).toHaveLength(1);
    const row = stored.rows[0]!;

    // Step 1, four steps before the submit.
    expect(row.first_name).toBe('Playwright');
    expect(row.phone).toBe(PHONE);
    expect(row.city).toBe('Pune');
    // Step 5.
    expect(row.emergency_contact_name).toBe('Named Sibling');
    expect(row.emergency_contact_relation).toBe('Sister');

    // Decision A13: applying is not being approved.
    expect(row.status).toBe('applied');
    expect(row.volunteer_id).toBeNull();

    // And the frozen snapshot of what they actually answered, which is the
    // record the reviewer reads.
    const application = await client.query<{ form_data: Record<string, unknown> }>(
      `SELECT a.form_data
         FROM volunteer_applications a
         JOIN volunteers v ON v.id = a.volunteer_id
        WHERE lower(v.email) = lower($1)`,
      [EMAIL],
    );
    expect(application.rows).toHaveLength(1);
    const formData = application.rows[0]!.form_data;
    // Step 2's free text — the field that made the empty payload obvious.
    expect(JSON.stringify(formData)).toContain('weekend tutoring');
  } finally {
    await client.end();
  }
});

test('a certificate code that does not exist says so, without suggesting a forgery', async ({
  page,
}) => {
  await page.goto('/verify/NOSUCHCODE12345');

  // Public, unauthenticated, and reachable by anybody holding a document.
  await expect(page.getByText(/could not|no certificate|not found/i).first()).toBeVisible();

  // Verification URLs contain the code itself, so they must never be indexed.
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute('content', /noindex/);
});
