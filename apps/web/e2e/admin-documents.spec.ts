import { test, expect } from '@playwright/test';
import pg from 'pg';

import { E2E_STAFF_FOURTH } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * Reports & documents, end to end.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE UPLOAD JOURNEY IS NOT HERE, AND THAT IS DELIBERATE.
 *
 * `playwright.config.ts` blanks the R2 credentials on purpose, so the browser
 * suite can never write into the real buckets. `StorageService.isConfigured`
 * is therefore false and every upload is refused with a 503 — which is a real
 * deployment state and worth asserting, and which `admin-media.spec.ts`
 * already asserts for images.
 *
 * So the storage half of this module is covered where it can be covered
 * honestly: `apps/api/test/documents.spec.ts` runs the whole lifecycle —
 * upload, publish, withdraw — against `fakeStorage()`, which models the two
 * buckets as separate namespaces and proves the object MOVES and leaves
 * exactly one copy behind.
 *
 * What is left for a browser is the part a browser is the only witness to:
 * that the screen tells the truth about what it does, that the sensitive
 * action really is gated on re-authentication, and — the §4.20 property —
 * that a private document has no public route at all.
 * ══════════════════════════════════════════════════════════════════════════
 */

/*
  ITS OWN STAFF ACCOUNT AND SESSION, minted in `global-setup.ts`.

  Changing visibility needs a re-authentication, which opens a five-minute
  window on the SESSION. Sharing one would open that window for `admin-blog`,
  `admin-stories` and `admin-pages`, each of which asserts that its own
  sensitive action is refused without one.
*/
test.use({ storageState: E2E_STAFF_FOURTH.state });
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now().toString(36);
const TITLE = `E2E document ${STAMP}`;

/** A real, minimal PDF — the upload path checks the bytes, not the name. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'ascii',
);

async function withDatabase<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * A private document, inserted directly.
 *
 * Going through the upload route would need a bucket. The row is what the
 * assertions below are about — whether a private document can be reached, and
 * whether the screen governing it is gated — and none of that depends on bytes
 * existing anywhere.
 */
async function seedPrivateDocument(): Promise<string> {
  return withDatabase(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO documents
         (title, description, file_key, file_name, mime_type, size_bytes,
          document_type, visibility, financial_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'private', $8)
       RETURNING id`,
      [
        TITLE,
        'An audited statement that must not be reachable.',
        `documents/2026/09/e2e-${STAMP}.pdf`,
        'audited-statement.pdf',
        'application/pdf',
        PDF.byteLength,
        'financial',
        '2025-2026',
      ],
    );
    return result.rows[0]!.id;
  });
}

test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query(`DELETE FROM documents WHERE title LIKE $1`, ['E2E document %']);
  });
});

test.describe('the document library', () => {
  test('opens, and says what it is NOT', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/documents');
    await expect(
      page.getByRole('heading', { level: 1, name: /Reports & documents/i }),
    ).toBeVisible();

    /*
      The screen has to say this. §4.20 removed the public library outright, so
      an editor arriving here would otherwise reasonably assume that uploading
      an annual report publishes it — and the cost of that assumption is a
      document on the internet nobody meant to put there.
    */
    await expect(page.getByText(/no public document library/i)).toBeVisible();
  });

  test('offers only the formats the validator actually accepts', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/documents');
    await page.getByRole('button', { name: 'Upload a document' }).click();

    // Word and Excel are absent because the inspector refuses them; a picker
    // that offered them would be an invitation to a 422.
    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      'accept',
      'application/pdf,image/jpeg,image/png,image/webp',
    );
  });

  test('DEFAULTS the visibility control to private', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/documents');
    await page.getByRole('button', { name: 'Upload a document' }).click();

    // The closed state is the one an editor lands on without making a choice.
    await expect(page.locator('select[name="visibility"]')).toHaveValue('private');
  });

  test('refuses an upload clearly when storage is not configured', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One project is enough.');

    await page.goto('/admin/documents');
    await page.getByRole('button', { name: 'Upload a document' }).click();

    /*
      Located by NAME, not by label. This repo's `Label` appends a visually
      hidden "(required)", so `getByLabel('Title', { exact: true })` matches
      nothing — the same trap `admin-blog` documents for its password field.
    */
    await page.locator('input[name="title"]').fill(`${TITLE} refused`);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'annual-report.pdf',
      mimeType: 'application/pdf',
      buffer: PDF,
    });

    await page.getByRole('button', { name: /^Upload$/ }).click();

    /*
      A 503 that NAMES the cause, not a 500 and not a silent failure. An
      administrator whose upload fails needs to know it is a deployment problem
      rather than something wrong with their file, or they will re-export the
      PDF half a dozen times before asking anybody.
    */
    await expect(page.getByText(/storage is not configured/i)).toBeVisible({ timeout: 20_000 });

    // And nothing was recorded: the object is written first, so a failure
    // there leaves no row behind.
    const count = await withDatabase(async (client) => {
      const rows = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM documents WHERE title = $1`,
        [`${TITLE} refused`],
      );
      return Number(rows.rows[0]!.n);
    });
    expect(count).toBe(0);
  });

  test('a private document has NO public route', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    const id = await seedPrivateDocument();

    // It is in the admin library, where it belongs.
    await page.goto('/admin/documents');
    await expect(page.getByRole('link', { name: TITLE })).toBeVisible({ timeout: 15_000 });

    /*
      ══════════════════════════════════════════════════════════════════════
      THE §4.20 PROPERTY. "Nothing in this module is publicly reachable."

      Checked against the API directly, ABSOLUTE against `e2eStack.apiUrl` —
      the `request` fixture is based at the WEB server, where `/api/v1/...`
      does not exist, so a relative path would answer 404 whatever the truth
      was and this would pass for the wrong reason.
      ══════════════════════════════════════════════════════════════════════
    */
    for (const path of ['/documents', `/documents/${id}`, '/reports', '/transparency']) {
      const response = await request.get(`${e2eStack.apiUrl}/api/v1${path}`);
      expect(response.status()).toBe(404);
    }
  });

  test('publishing is REFUSED without a re-authentication', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    const id = await withDatabase(async (client) => {
      const rows = await client.query<{ id: string }>(
        `SELECT id FROM documents WHERE title = $1 LIMIT 1`,
        [TITLE],
      );
      return rows.rows[0]?.id ?? null;
    }).then(async (found) => found ?? (await seedPrivateDocument()));

    await page.goto(`/admin/documents/${id}`);
    await expect(page.getByRole('heading', { name: 'Visibility' })).toBeVisible();

    await page.getByRole('button', { name: /Make public/i }).click();
    await page.locator('input[name="reason"]').fill('Approved for release by the board.');
    await page.getByRole('button', { name: /^Confirm$/ }).click();

    /*
      The acceptance criterion's second clause, in a browser: "changing a
      document's visibility requires re-authentication". The guard runs before
      the controller, so this is refused before the service ever looks at
      storage — which is why it is assertable here while the successful move is
      not.
    */
    await expect(page.getByText(/Confirm your password to continue/i)).toBeVisible({
      timeout: 20_000,
    });

    // And it did not change.
    const visibility = await withDatabase(async (client) => {
      const rows = await client.query<{ visibility: string }>(
        `SELECT visibility FROM documents WHERE id = $1`,
        [id],
      );
      return rows.rows[0]!.visibility;
    });
    expect(visibility).toBe('private');
  });

  test('warns when a public document is attached to nothing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes rows — one project only.');

    /*
      A public document attached to nothing is reachable by nobody, because the
      campaign page is the only public surface. That is not an error — it is a
      state an editor can reach and be puzzled by, so the screen says so.
    */
    const id = await withDatabase(async (client) => {
      const rows = await client.query<{ id: string }>(
        `INSERT INTO documents
           (title, file_key, file_name, mime_type, size_bytes, document_type,
            visibility, published_at, file_url)
         VALUES ($1, $2, $3, 'application/pdf', $4, 'policy', 'public', now(), $5)
         RETURNING id`,
        [
          `${TITLE} orphan`,
          `documents/2026/09/e2e-orphan-${STAMP}.pdf`,
          'policy.pdf',
          PDF.byteLength,
          `https://media.invalid/documents/2026/09/e2e-orphan-${STAMP}.pdf`,
        ],
      );
      return rows.rows[0]!.id;
    });

    await page.goto(`/admin/documents/${id}`);
    await expect(page.getByText(/attached to nothing, so no visitor can reach it/i)).toBeVisible();
  });
});

test.describe('documents are staff-only', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects a signed-out visitor away from the library', async ({ page }) => {
    await page.goto('/admin/documents');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
