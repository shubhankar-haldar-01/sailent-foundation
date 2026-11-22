import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { articleExtensions, articleMarkdown } from '../article-editor-schema';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { renderMarkdown } from '../markdown';
import { markdownToEditorJson } from '../markdown-to-editor';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

/** Load content (pasted HTML, or the editor's own JSON) into the editor's schema. */
function load(content: string | JSONContent): Editor {
  const editor = new Editor({ extensions: articleExtensions(), content });
  editors.push(editor);
  return editor;
}

/** What readers see: the public renderer's output as HTML (tests may use react-dom/server). */
function published(markdown: string): string {
  return renderToStaticMarkup(createElement(Fragment, null, renderMarkdown(markdown)));
}

/** Markdown → (public renderer) → editor → Markdown, as opening and saving a post does. */
function roundTrip(markdown: string): string {
  return articleMarkdown(load(markdownToEditorJson(markdown)).getJSON());
}

/**
 * Articles in the renderer's dialect. The e2e fixture post is copied from
 * `e2e/global-setup.ts`; the rest cover each construct and its edges.
 */
const CORPUS: Record<string, string> = {
  'the e2e fixture post': [
    '## What is in a kit',
    '',
    'A kit holds notebooks, a slate, pencils and a bag. We buy them in one order',
    'so the unit price is what a school pays, not what a family pays.',
    '',
    '- Notebooks and a slate',
    '- Pencils, sharpener and eraser',
    '- A bag that survives a monsoon',
    '',
    '> The first year we bought bags that did not, and replaced them in March.',
  ].join('\n'),
  'three heading levels': '# Heading\n\nA paragraph.\n\n## Subheading\n\n### Small heading',
  'inline formatting':
    'A **bold** word, an *italic* one, `code`, and [a link](https://example.org).',
  'nested emphasis': '__bold with *italic* inside__ and *italic with __bold__ inside*',
  'bold italic': '__*both at once*__ and plain',
  'underscore emphasis': 'An _underscored_ word and __double underscored__ text.',
  lists: '- one\n- two with **bold**\n\n1. first\n2. second\n3. third',
  'a quote': '> A quoted line with *emphasis* and [a link](/about).',
  images:
    '![A child reading](/images/team-priya.webp)\n\nText with ![an inline picture](https://example.org/a.png) in it.',
  'link with emphasis inside':
    'Please [read **this** carefully](https://example.org/page_one) today.',
  'mailto and fragment links': '[Write to us](mailto:hello@example.org) or [jump](#section).',
  'heading with a link': '## See [our programs](/programs)',
  'stray markers stay text': 'Price is 5 * 3 and a lone _ underscore.',
  'unsafe urls are dropped like the page drops them':
    '[click me](javascript:alert(1)) and ![x](javascript:alert(1)) end.',
};

describe('article editor ↔ Markdown', () => {
  for (const [name, markdown] of Object.entries(CORPUS)) {
    it(`publishes the same article after an edit-and-save: ${name}`, () => {
      const before = published(markdown);
      const saved = roundTrip(markdown);
      // What readers see is unchanged…
      expect(published(saved)).toBe(before);
      // …and saving again changes nothing.
      expect(roundTrip(saved)).toBe(saved);
    });
  }

  it('writes headings as the page reads them: h2 is #, h3 is ##, h4 is ###', () => {
    const editor = load('<h2>Two</h2><h3>Three</h3><h4>Four</h4>');
    expect(articleMarkdown(editor.getJSON())).toBe('# Two\n\n## Three\n\n### Four');
  });

  it('writes bold around italic with underscores, the only nesting the renderer reads', () => {
    const editor = load('<p><strong><em>both</em></strong></p>');
    expect(articleMarkdown(editor.getJSON())).toBe('__*both*__');
  });

  it('never escapes a character — the renderer would show the backslash', () => {
    const editor = load('<p>5 * 3 = 15 and a_b</p>');
    expect(articleMarkdown(editor.getJSON())).toBe('5 * 3 = 15 and a_b');
  });
});

/** A key press, through the editor's own keyboard handlers. */
function press(editor: Editor, key: string, { shift = false } = {}) {
  const event = new KeyboardEvent('keydown', { key, shiftKey: shift, cancelable: true });
  editor.view.someProp('handleKeyDown', (handle) => handle(editor.view, event));
}

/** The cursor `offset` characters into the first text containing `needle`. */
function cursorIn(editor: Editor, needle: string, offset: number) {
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (position === -1 && node.isText && node.text!.includes(needle)) {
      position = pos + node.text!.indexOf(needle) + offset;
    }
  });
  editor.commands.setTextSelection(position);
}

/**
 * The document's blocks, less the empty paragraph Tiptap keeps at the very end
 * (StarterKit's trailing node, so there is always a line to click into below a
 * closing quote or list; the Markdown drops it).
 */
function blockTypes(editor: Editor): string[] {
  const blocks: JSONContent[] = [...(editor.getJSON().content ?? [])];
  const last = blocks.at(-1);
  if (last?.type === 'paragraph' && !last.content?.length) blocks.pop();
  return blocks.map((block) => block.type ?? '');
}

describe('Enter in a quote (one paragraph on the page) never leaves the writer stuck', () => {
  it('at the end, starts an ordinary paragraph after the quote', () => {
    const editor = load('<blockquote><p>We learnt this.</p></blockquote>');
    cursorIn(editor, 'We learnt this.', 'We learnt this.'.length);
    press(editor, 'Enter');
    editor.commands.insertContent('Next');
    expect(articleMarkdown(editor.getJSON())).toBe('> We learnt this.\n\nNext');
  });

  it('pressed twice at the end, still leaves the quote behind', () => {
    const editor = load('<blockquote><p>We learnt this.</p></blockquote>');
    cursorIn(editor, 'We learnt this.', 'We learnt this.'.length);
    press(editor, 'Enter');
    press(editor, 'Enter');
    editor.commands.insertContent('Next');
    expect(articleMarkdown(editor.getJSON())).toBe('> We learnt this.\n\nNext');
  });

  it('in the middle, splits the quote in two', () => {
    const editor = load('<blockquote><p>First half. Second half.</p></blockquote>');
    cursorIn(editor, 'First half. ', 'First half. '.length);
    press(editor, 'Enter');
    editor.commands.insertContent('And ');
    expect(blockTypes(editor)).toEqual(['blockquote', 'blockquote']);
    expect(articleMarkdown(editor.getJSON())).toBe('> First half.\n\n> And Second half.');
  });

  it('at the start, opens an empty paragraph above and keeps the quote', () => {
    const editor = load('<blockquote><p>Quoted</p></blockquote>');
    cursorIn(editor, 'Quoted', 0);
    press(editor, 'Enter');
    expect(blockTypes(editor)).toEqual(['paragraph', 'blockquote']);
    editor.commands.insertContent('Still ');
    expect(articleMarkdown(editor.getJSON())).toBe('> Still Quoted');
  });

  it('in an empty quote, turns it back into an ordinary paragraph', () => {
    const editor = load({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
        { type: 'blockquote', content: [{ type: 'paragraph' }] },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 2);
    press(editor, 'Enter');
    expect(blockTypes(editor)).toEqual(['paragraph', 'paragraph']);
    editor.commands.insertContent('After');
    expect(articleMarkdown(editor.getJSON())).toBe('Before\n\nAfter');
  });

  it('Shift+Enter starts a new paragraph or list item, as Enter does (the page has no line breaks)', () => {
    const paragraph = load('<p>Line one</p>');
    cursorIn(paragraph, 'Line one', 'Line one'.length);
    press(paragraph, 'Enter', { shift: true });
    paragraph.commands.insertContent('Line two');
    expect(articleMarkdown(paragraph.getJSON())).toBe('Line one\n\nLine two');

    const list = load('<ul><li><p>one</p></li></ul>');
    cursorIn(list, 'one', 3);
    press(list, 'Enter', { shift: true });
    list.commands.insertContent('two');
    expect(articleMarkdown(list.getJSON())).toBe('- one\n- two');
  });
});

describe('article editor schema: only what the page can show', () => {
  it('keeps the words of a pasted table, not the table', () => {
    const json = load('<table><tbody><tr><td>Cell text</td></tr></tbody></table>').getJSON();
    expect(JSON.stringify(json)).not.toContain('table');
    expect(articleMarkdown(json)).toContain('Cell text');
  });

  it('keeps a pasted code block as inline code, and strikethrough and underline as plain text', () => {
    const json = load('<pre><code>block</code></pre><p><s>struck</s> <u>under</u></p>').getJSON();
    const text = JSON.stringify(json);
    // No block types or marks the page cannot draw…
    expect(text).not.toMatch(/codeBlock|strike|underline/);
    // …while the words survive, and code stays code (the page shows inline code).
    expect(articleMarkdown(json)).toBe('`block`\n\nstruck under');
  });

  it('cannot nest a list: the page has flat lists only', () => {
    const json = load('<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>').getJSON();
    const items: JSONContent[] = (json.content ?? []).flatMap(
      (block: JSONContent) => block.content ?? [],
    );
    for (const item of items) {
      expect(JSON.stringify(item.content ?? [])).not.toContain('bulletList');
    }
    expect(articleMarkdown(json)).toContain('a');
    expect(articleMarkdown(json)).toContain('b');
  });

  it('drops a javascript: link and a data: image', () => {
    const json = load(
      '<p><a href="javascript:alert(1)">words stay</a> <img src="data:image/png;base64,AAAA" alt="x"></p>',
    ).getJSON();
    const markdown = articleMarkdown(json);
    expect(markdown).toBe('words stay');
    expect(markdown).not.toMatch(/javascript|data:/);
  });

  it('writes an empty document as an empty article', () => {
    expect(articleMarkdown(load('').getJSON())).toBe('');
  });
});
