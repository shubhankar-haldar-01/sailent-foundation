import * as React from 'react';

/**
 * Markdown → React ELEMENTS. Never HTML.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THERE IS NO SANITISER HERE, AND WHY THAT IS THE SAFER CHOICE.
 *
 * The usual shape is: store HTML, run it through a sanitiser, hand the result
 * to `dangerouslySetInnerHTML`. That makes safety a DENYLIST — it has to stay
 * ahead of every parser quirk, every new attribute and every mutation-XSS
 * trick for the life of the product. Get it wrong once and an editor's article
 * executes script in a reader's browser.
 *
 * This produces React elements instead. There is no point at which a string
 * from the database becomes markup: text becomes `children`, which React
 * escapes, and every element and attribute here is one this file wrote. An
 * article containing a script tag renders those characters as words, because
 * that is all they can be.
 *
 * `dangerouslySetInnerHTML` does not appear in this file, and must not.
 *
 * URLS ARE STILL CHECKED, because a URL is the one place an author-supplied
 * string reaches an attribute React cannot make safe for us: a `javascript:`
 * href executes on click. `safeUrl` allows http, https, mailto and
 * site-relative paths, and drops everything else.
 *
 * SUPPORTED, because it is what an NGO article needs and no more: headings,
 * paragraphs, bold, italic, links, ordered and unordered lists, blockquotes,
 * images and inline code. No tables, no raw HTML, no embeds. A page builder is
 * explicitly not what this is.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * Characters a browser ignores inside a scheme, which a naive regex does not.
 *
 * `no-control-regex` is disabled deliberately and narrowly. The rule exists to
 * catch control characters that got into a pattern by accident; here they are
 * the entire subject — `java<TAB>script:` and `java<NUL>script:` are read by a
 * browser as a `javascript:` scheme, so a check that cannot see them is a check
 * that can be walked around.
 */
// eslint-disable-next-line no-control-regex
const IGNORED_IN_SCHEME = /[\u0000-\u0020]/g;

/**
 * A URL we are willing to put in an attribute.
 *
 * Normalised before the scheme is read: entity- and control-character tricks
 * such as `java&#09;script:` reach the browser as a scheme even though they do
 * not match a plain `^javascript:` test.
 */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;

  // Site-relative and fragment links carry no scheme and are always fine.
  if (value.startsWith('/') || value.startsWith('#')) return value;

  const normalised = value.replace(/&#?[a-z0-9]+;?/gi, '').replace(IGNORED_IN_SCHEME, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalised)?.[1]?.toLowerCase();

  if (!scheme) return value.includes(':') ? null : value;
  return ['http', 'https', 'mailto'].includes(scheme) ? value : null;
}

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

/**
 * Images, links, bold, italic and inline code.
 *
 * A SOURCE STRING, compiled afresh on every call rather than shared.
 *
 * `renderInline` recurses — link text and bold runs are themselves inline
 * markdown — and a `/g` regex carries `lastIndex` on the object itself. Sharing
 * one instance meant the inner call rewound the outer call's cursor, so the
 * outer `while` re-matched the same span forever. It did not fail a test: it
 * hung the worker.
 */
const INLINE_SOURCE =
  String.raw`(!?)\[([^\]]*)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|` +
  '`([^`]+)`';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = new RegExp(INLINE_SOURCE, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-i${index++}`;

    const [full, bang, linkText, url, strongA, strongB, emA, emB, code] = match;

    if (url !== undefined) {
      const href = safeUrl(url);

      if (bang === '!') {
        // An image with no usable source is dropped rather than rendered
        // broken — a broken image tells a reader nothing.
        if (href) {
          nodes.push(
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={href}
              alt={linkText ?? ''}
              loading="lazy"
              className="my-6 w-full rounded-lg"
            />,
          );
        }
      } else if (href) {
        const external = /^https?:/i.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            className="underline underline-offset-2"
            // `noopener` on every external link: without it the opened page can
            // reach back through `window.opener`.
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInline(linkText ?? '', key)}
          </a>,
        );
      } else {
        // A refused URL keeps its visible text. Silently deleting an editor's
        // words is worse than showing them unlinked.
        nodes.push(linkText ?? '');
      }
    } else if (strongA ?? strongB) {
      nodes.push(<strong key={key}>{renderInline((strongA ?? strongB)!, key)}</strong>);
    } else if (emA ?? emB) {
      nodes.push(<em key={key}>{renderInline((emA ?? emB)!, key)}</em>);
    } else if (code) {
      nodes.push(
        <code key={key} className="bg-muted rounded px-1.5 py-0.5 text-[0.9em]">
          {code}
        </code>,
      );
    } else {
      nodes.push(full);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const HEADING_CLASS: Record<number, string> = {
  1: 'text-h2 mt-10 mb-3 font-semibold',
  2: 'text-h3 mt-10 mb-3 font-semibold',
  3: 'text-h4 mt-8 mb-2 font-semibold',
};

/**
 * Render an article body.
 *
 * A line-oriented block pass, then the inline pass above. Deliberately small:
 * every construct it understands is one this codebase can reason about, and
 * anything it does not understand renders as the text the author typed.
 */
export function renderMarkdown(source: string | null | undefined): React.ReactNode {
  if (!source || source.trim() === '') return null;

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    blocks.push(
      <p key={`p${key}`} className="text-body text-muted-foreground my-4 leading-relaxed">
        {renderInline(text, `p${key}`)}
      </p>,
    );
    key += 1;
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const className = `text-body text-muted-foreground my-4 ml-6 space-y-2 ${
      ordered ? 'list-decimal' : 'list-disc'
    }`;
    const children = items.map((item, itemIndex) => (
      <li key={itemIndex}>{renderInline(item, `l${key}-${itemIndex}`)}</li>
    ));
    blocks.push(
      ordered ? (
        <ol key={`l${key}`} className={className}>
          {children}
        </ol>
      ) : (
        <ul key={`l${key}`} className={className}>
          {children}
        </ul>
      ),
    );
    key += 1;
    list = null;
  };

  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push(
      <blockquote
        key={`q${key}`}
        className="border-primary text-body text-muted-foreground my-6 border-l-4 py-1 pl-5 italic"
      >
        {renderInline(quote.join(' '), `q${key}`)}
      </blockquote>,
    );
    key += 1;
    quote = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushAll();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = heading[1]!.length;
      /*
        An article's own `#` starts at h2. The page title is the h1, and a
        document with two h1s is both a heading-order failure for a screen
        reader and a muddled signal for a crawler.
      */
      const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
      blocks.push(
        <Tag key={`h${key}`} className={HEADING_CLASS[level]}>
          {renderInline(heading[2]!, `h${key}`)}
        </Tag>,
      );
      key += 1;
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(trimmed);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]!);
      continue;
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    const unordered = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (ordered ?? unordered) {
      flushParagraph();
      flushQuote();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push((ordered ?? unordered)![1]!);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }

  flushAll();
  return blocks;
}

/**
 * A plain-text summary, for a meta description when none was written.
 *
 * Strips the markers rather than rendering them, because a `<meta>` attribute
 * takes text and nothing else.
 */
export function plainTextFrom(source: string | null | undefined, limit = 160): string {
  if (!source) return '';

  const text = source
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= limit) return text;
  // Cut on a word boundary: a description ending mid-word looks broken in a
  // search result.
  const cut = text.lastIndexOf(' ', limit);
  return `${text.slice(0, cut > 0 ? cut : limit).trimEnd()}…`;
}
