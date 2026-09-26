import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { plainTextFrom, renderMarkdown, safeUrl } from '../markdown';

/**
 * The renderer, and the reason it exists.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THESE ASSERT ON RENDERED DOM, which is the only place the question can
 * actually be settled. A test that inspected the React tree would prove the
 * shape of an object; what matters is what reaches a browser — so each case
 * renders and reads the resulting `innerHTML` back.
 * ══════════════════════════════════════════════════════════════════════════
 */
const html = (markdown: string) => render(<>{renderMarkdown(markdown)}</>).container.innerHTML;
const dom = (markdown: string) => render(<>{renderMarkdown(markdown)}</>).container;

describe('blog markdown — security', () => {
  it('renders a script tag as TEXT, with no script element created', () => {
    const container = dom('Hello <script>alert(1)</script> world');

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  /*
    ASSERTED ON THE DOM, not on the HTML string.

    The rendered markup contains the characters `onerror=` — as escaped TEXT
    inside a paragraph. A substring check on `innerHTML` cannot tell that apart
    from a live attribute, so it would fail on safe output and, worse, could
    pass on unsafe output that spelled the attribute differently. What actually
    matters is whether an ELEMENT exists and whether it carries the handler.
  */
  it('renders an img onerror payload as inert text, with no element created', () => {
    const container = dom('<img src=x onerror="alert(1)">');

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    // The characters are present only in escaped form.
    expect(container.innerHTML).toContain('&lt;img');
  });

  it('refuses a javascript: link but keeps the words', () => {
    const output = html('[click me](javascript:alert(1))');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('<a');
    // The author's text is not silently deleted.
    expect(output).toContain('click me');
  });

  it.each([
    ['javascript:alert(1)', 'plain'],
    ['JaVaScRiPt:alert(1)', 'mixed case'],
    ['java\tscript:alert(1)', 'tab inside the scheme'],
    ['java&#09;script:alert(1)', 'entity inside the scheme'],
    ['data:text/html;base64,PHNjcmlwdD4=', 'data URL'],
    ['vbscript:msgbox(1)', 'vbscript'],
  ])('safeUrl rejects %s (%s)', (url) => {
    expect(safeUrl(url)).toBeNull();
  });

  it.each([
    'https://example.org/article',
    'http://example.org',
    'mailto:hello@sailentfoundation.com',
    '/campaigns/school-kits',
    '#section',
  ])('safeUrl allows %s', (url) => {
    expect(safeUrl(url)).toBe(url);
  });

  it('refuses a javascript: image source and drops the image', () => {
    const output = html('![alt](javascript:alert(1))');
    expect(output).not.toContain('<img');
    expect(output).not.toContain('javascript:');
  });

  it('puts noopener on external links only', () => {
    expect(html('[out](https://example.org)')).toContain('rel="noopener noreferrer"');
    expect(html('[in](/about)')).not.toContain('noopener');
  });

  it('never creates an element from HTML in the source, in any block', () => {
    const container = dom('> <b onclick="steal()">quoted</b>\n\n- <i>item</i>');

    // No element the author wrote was created — only the ones this renderer
    // chose (a blockquote and a list).
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('i')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(container.querySelector('ul')).not.toBeNull();
  });
});

describe('blog markdown — rendering', () => {
  it('renders the constructs an NGO article needs', () => {
    const output = html(
      [
        '# Heading',
        '',
        'A paragraph with **bold**, *italic* and a [link](https://example.org).',
        '',
        '- first',
        '- second',
        '',
        '1. one',
        '2. two',
        '',
        '> a quotation',
      ].join('\n'),
    );

    expect(output).toContain('<h2');
    expect(output).toContain('<strong>bold</strong>');
    expect(output).toContain('<em>italic</em>');
    expect(output).toContain('<a href="https://example.org"');
    expect(output).toContain('<ul');
    expect(output).toContain('<ol');
    expect(output).toContain('<blockquote');
  });

  it('starts an article heading at h2, so the page keeps one h1', () => {
    const output = html('# Title\n\n## Sub\n\n### Deeper');
    expect(output).not.toContain('<h1');
    expect(output).toContain('<h2');
    expect(output).toContain('<h3');
    expect(output).toContain('<h4');
  });

  it('renders an image with its alt text', () => {
    const output = html('![A classroom](https://cdn.example.org/a.jpg)');
    expect(output).toContain('alt="A classroom"');
    expect(output).toContain('loading="lazy"');
  });

  it('returns null for empty content rather than an empty element', () => {
    expect(renderMarkdown('')).toBeNull();
    expect(renderMarkdown(null)).toBeNull();
    expect(renderMarkdown('   ')).toBeNull();
  });
});

describe('plainTextFrom', () => {
  it('strips markers for use in a meta description', () => {
    expect(plainTextFrom('# Title\n\nSome **bold** text with a [link](https://x.org).')).toBe(
      'Title Some bold text with a link.',
    );
  });

  it('cuts on a word boundary', () => {
    const summary = plainTextFrom('a '.repeat(200), 50);
    expect(summary.length).toBeLessThanOrEqual(51);
    expect(summary.endsWith('…')).toBe(true);
    expect(summary).not.toContain('  ');
  });

  it('drops images entirely — their markup is not a description', () => {
    expect(plainTextFrom('![alt text](https://x.org/a.jpg) Real words')).toBe('Real words');
  });
});
