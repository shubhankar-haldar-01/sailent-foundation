import { test, expect, type Page } from '@playwright/test';
import pg from 'pg';

import { STAFF_STATE } from './global-setup';
import { e2eStack } from '../playwright.config';

/**
 * The blog editor in a real browser (Tiptap over Markdown, owner 2026-11-22).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT ONLY A BROWSER SHOWS.
 *
 * The unit tests hold the schema, the Markdown writer, the round trip and the
 * key handling (`lib/blog/__tests__/article-editor-schema.test.ts`). This
 * holds the rest: typing with Markdown shortcuts and ⌘ commands, leaving a
 * quote with Enter, the menu on selected text, pasting from Word, a draft that
 * reopens exactly as written, and the toolbar staying under the admin header.
 * Each of those once failed in a browser while every unit test passed.
 *
 * Publishing is not repeated here: it is `@Sensitive()` and belongs to the
 * lifecycle test in `admin-blog.spec.ts`.
 * ══════════════════════════════════════════════════════════════════════════
 */
test.use({ storageState: STAFF_STATE });

const STAMP = Date.now().toString(36);
const TITLE = `E2E editor ${STAMP}`;
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

/** The article as the form submits it: Markdown, in a hidden field. */
const markdownField = (page: Page) => page.locator('input[type="hidden"][name="content"]');

test.afterAll(async () => {
  // The draft is a real row; left behind it would look like somebody's work.
  const client = new pg.Client({ connectionString: e2eStack.databaseUrl });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM slug_history WHERE entity_id IN (SELECT id FROM blog_posts WHERE title = $1)`,
      [TITLE],
    );
    await client.query(`DELETE FROM blog_posts WHERE title = $1`, [TITLE]);
  } finally {
    await client.end();
  }
});

test.describe('admin blog editor', () => {
  test('writes with shortcuts and Markdown, and the draft reopens exactly as written', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Writes a row — one project only.');

    await page.goto('/admin/blog/new');
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(TITLE);
    await page.getByLabel('Summary').fill('Written by the editor test.');

    const editor = page.getByRole('textbox', { name: 'Article' });
    await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();
    await editor.click();

    // Markdown as you type: "# " is the page's h2.
    await page.keyboard.type('# Why the kit matters');
    await page.keyboard.press('Enter');
    await page.keyboard.type('A kit is ');
    await page.keyboard.press(`${MOD}+b`);
    await page.keyboard.type('more than paper');
    await page.keyboard.press(`${MOD}+b`);
    await page.keyboard.type(' and pencils.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Notebooks');
    await page.keyboard.press('Enter');
    await page.keyboard.type('A bag');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    /*
      A quote is ONE paragraph on the page, so the editor's usual Enter (split
      the paragraph) is refused inside it. Enter must still leave the quote: it
      once did nothing, and everything typed next stayed quoted.
    */
    await page.keyboard.type('> We learnt this the hard way.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Read');
    // The page has no line breaks, so Shift+Enter starts a paragraph too.
    await page.keyboard.press('Shift+Enter');

    // ⌘K in the article is the link dialog, not the admin header's Quick jump.
    await page.keyboard.press(`${MOD}+k`);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add a link' })).toBeVisible();
    await dialog.getByLabel('Address').fill('example.org/report');
    await dialog.getByLabel('Text to show').fill('our full report');
    await dialog.getByRole('button', { name: 'Add link' }).click();
    await expect(dialog).toBeHidden();

    /*
      The menu on selected text has its own buttons. Wait for THEM: the
      toolbar's Italic is always there, so asserting on "an Italic button"
      passes before the menu has appeared.
    */
    await page.getByText('more than paper').dblclick();
    const italic = page.getByRole('button', { name: 'Italic' });
    await expect(italic).toHaveCount(2);
    await italic.nth(1).click();

    const written = [
      '# Why the kit matters',
      'A kit is __more *than* paper__ and pencils.',
      '- Notebooks\n- A bag',
      '> We learnt this the hard way.',
      'Read',
      '[our full report](https://example.org/report)',
    ].join('\n\n');
    await expect(markdownField(page)).toHaveValue(written);

    await page.getByRole('button', { name: 'Create draft' }).click();
    await page.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}/, { timeout: 20_000 });

    const reopened = page.getByRole('textbox', { name: 'Article' });
    await expect(
      reopened.getByRole('heading', { level: 2, name: 'Why the kit matters' }),
    ).toBeVisible();
    await expect(reopened.locator('blockquote')).toHaveText('We learnt this the hard way.');
    /*
      A browser submits a form field's line breaks as CRLF (the textarea this
      editor replaced did too), and the public renderer reads either.
    */
    const saved = await markdownField(page).inputValue();
    expect(saved.replace(/\r\n/g, '\n')).toBe(written);
  });

  test('pasting from Word keeps the words and drops what the page cannot show', async ({
    page,
  }) => {
    await page.goto('/admin/blog/new');
    const editor = page.getByRole('textbox', { name: 'Article' });
    await editor.click();
    await editor.evaluate((element) => {
      const data = new DataTransfer();
      data.setData(
        'text/html',
        '<table><tr><td>Cell</td></tr></table><p><u>under</u> <s>struck</s> <span style="color:red">red</span></p>',
      );
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    });

    await expect(markdownField(page)).toHaveValue('Cell\n\nunder struck red');
    await expect(editor.locator('table, u, s, span[style]')).toHaveCount(0);
  });

  test('opens an existing article as readers see it, with the toolbar under the admin header', async ({
    page,
  }) => {
    await page.goto('/admin/blog');
    await page
      .getByRole('link', { name: /What a school kit actually costs/ })
      .first()
      .click();

    const editor = page.getByRole('textbox', { name: 'Article' });
    await expect(editor.getByRole('heading', { name: 'What is in a kit' })).toBeVisible();
    await expect(editor.locator('li')).toHaveCount(3);
    await expect(editor.locator('blockquote')).toHaveCount(1);

    /*
      The toolbar sticks only while the article is taller than the screen, so
      make it long (nothing is saved): thirty new lines at the end.
    */
    await editor.focus();
    await editor.evaluate((element) => {
      const end = document.createRange();
      end.selectNodeContents(element);
      end.collapse(false);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(end);
    });
    for (let line = 0; line < 30; line += 1) await page.keyboard.press('Enter');

    /*
      Scrolled until the article's text meets the top of the screen, the
      toolbar's own place is above the screen: it is seen only if it sticks,
      and it must stick BELOW the sticky admin header, not behind it.
    */
    await editor.evaluate((element) =>
      window.scrollBy(0, element.getBoundingClientRect().top - 10),
    );
    const header = (await page.locator('header').first().boundingBox())!;
    const toolbar = page.getByRole('toolbar', { name: 'Formatting' });
    await expect
      .poll(async () => Math.abs((await toolbar.boundingBox())!.y - (header.y + header.height)))
      .toBeLessThanOrEqual(1);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
