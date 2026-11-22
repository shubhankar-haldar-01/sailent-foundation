import {
  Extension,
  textblockTypeInputRule,
  type AnyExtension,
  type Editor,
  type JSONContent,
} from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import { ListItem } from '@tiptap/extension-list-item';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import type { ResolvedPos } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';

import { safeUrl } from './markdown';

/**
 * The blog editor's document model, and how it is written back to Markdown.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE EDITOR CAN ONLY HOLD WHAT THE PUBLIC PAGE CAN SHOW.
 *
 * Articles are stored as Markdown and published by `lib/blog/markdown.tsx`,
 * which turns it into React elements and never into HTML — that renderer is
 * the safety boundary, and it is unchanged. The editor (Tiptap, owner
 * 2026-11-22) is a nicer way to WRITE that Markdown, so its schema is cut to
 * the renderer's exact dialect:
 *
 *   • headings h2–h4 (`#`, `##`, `###` — the page title is the h1);
 *   • paragraphs, **bold**, *italic*, `inline code`, links;
 *   • bulleted and numbered lists of single paragraphs (no nesting);
 *   • quotes of a single paragraph;
 *   • images, inline as the renderer treats them.
 *
 * No code blocks, strikethrough, underline, rules or line breaks: the page
 * cannot show them, so the editor does not offer them, and pasting them in
 * keeps the words and drops the formatting.
 *
 * AND THE MARKDOWN IS WRITTEN BY HAND, not by a general converter, because the
 * renderer has no escapes (a `\*` would reach readers as a backslash) and
 * reads bold as `__…__` when italic sits inside it. Existing posts are loaded
 * by reading them with the renderer itself (`markdown-to-editor.ts`), so what the
 * editor shows is exactly what readers see. A round-trip test holds the two
 * together.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * `#` is the page's h2 (see `renderMarkdown`), so the editor's headings are
 * h2–h4 and typing `# `, `## ` or `### ` gives the heading that Markdown will
 * publish — not Tiptap's default reading of `##` as an h2.
 */
const ArticleHeading = Heading.extend({
  addInputRules() {
    return [1, 2, 3].map((hashes) =>
      textblockTypeInputRule({
        find: new RegExp(`^(#{${hashes}})\\s$`),
        type: this.type,
        getAttributes: { level: hashes + 1 },
      }),
    );
  },
}).configure({ levels: [2, 3, 4] });

function inQuote($pos: ResolvedPos): boolean {
  return $pos.depth >= 2 && $pos.node(-1).type.name === 'blockquote';
}

/**
 * Enter inside a quote. The quote can hold only one paragraph, so the editor's
 * usual Enter (split the paragraph) is refused there — left alone, Enter would
 * do nothing and the writer could not get out of the quote. Instead it behaves
 * as it does in a heading:
 *   • at the end, an ordinary paragraph starts after the quote;
 *   • in the middle, the quote splits into two;
 *   • at the start, an empty paragraph opens above it;
 *   • in an empty quote, the quote becomes an ordinary paragraph.
 */
function enterInQuote(editor: Editor): boolean {
  return editor.commands.command(({ tr, dispatch }) => {
    if (!inQuote(tr.selection.$from)) return false;
    if (!dispatch) return true;

    if (tr.selection instanceof TextSelection && !tr.selection.empty) tr.deleteSelection();
    const $cursor = tr.selection.$from;
    if (!inQuote($cursor)) return true;

    const paragraph = $cursor.parent;
    const before = $cursor.before(-1);
    const after = $cursor.after(-1);
    const plain = tr.doc.type.schema.nodes.paragraph!;

    if (paragraph.content.size === 0) {
      tr.replaceWith(before, after, plain.create());
      tr.setSelection(TextSelection.create(tr.doc, before + 1));
    } else if ($cursor.parentOffset === 0) {
      tr.insert(before, plain.create());
    } else if ($cursor.parentOffset === paragraph.content.size) {
      tr.insert(after, plain.create());
      tr.setSelection(TextSelection.create(tr.doc, after + 1));
    } else {
      // Paragraph and quote both split: the cursor starts the second quote.
      tr.split($cursor.pos, 2);
      tr.setSelection(TextSelection.create(tr.doc, $cursor.pos + 4));
    }
    tr.scrollIntoView();
    return true;
  });
}

/** A quote is one paragraph on the page (`> ` lines join into one). */
const ArticleBlockquote = Blockquote.extend({
  content: 'paragraph',
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: ({ editor }) => enterInQuote(editor),
    };
  },
});

/**
 * The page has no line breaks — every line is a paragraph — so Shift+Enter,
 * which breaks the line in a word processor, does what Enter does (a new
 * paragraph or list item) instead of quietly typing a space.
 */
const ShiftEnterIsEnter = Extension.create({
  name: 'articleShiftEnter',
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': ({ editor }) => {
        const { view } = editor;
        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        return Boolean(view.someProp('handleKeyDown', (handle) => handle(view, enter)));
      },
    };
  },
});

/** A list item is one line on the page: no second paragraph, no nested list. */
const ArticleListItem = ListItem.extend({ content: 'paragraph' });

/** Links only to what the renderer will link: http(s), mailto, site paths. */
function allowedHref(url: string): boolean {
  return safeUrl(url) !== null;
}

export function articleExtensions(placeholder = 'Write your article…'): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      listItem: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      hardBreak: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        isAllowedUri: (url, ctx) => Boolean(ctx.defaultValidate(url)) && allowedHref(url),
        shouldAutoLink: allowedHref,
      },
    }),
    ArticleHeading,
    ArticleBlockquote,
    ArticleListItem,
    ShiftEnterIsEnter,
    // Inline, as the renderer reads `![alt](src)` inside a line. No data: URLs —
    // the renderer would drop them, and they would bloat the article.
    Image.configure({ inline: true, allowBase64: false }),
    Placeholder.configure({ placeholder }),
    CharacterCount,
  ];
}

// ---------------------------------------------------------------------------
// Editor document → Markdown
// ---------------------------------------------------------------------------

type Node = JSONContent;

/** A URL as the renderer's link pattern needs it: no spaces, no parentheses. */
function encodeUrl(url: string): string {
  return url.trim().replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/** Text the renderer reads inside `[…]`: no square brackets. */
function bracketSafe(text: string): string {
  return text.replace(/[[\]]/g, '');
}

function hasMark(node: Node, type: string): boolean {
  return (node.marks ?? []).some((mark) => mark.type === type);
}

function linkHref(node: Node): string | null {
  if (node.type !== 'text') return null;
  const link = (node.marks ?? []).find((mark) => mark.type === 'link');
  const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : null;
  return href && safeUrl(href) ? href : null;
}

function imageMarkdown(node: Node): string {
  const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
  if (!safeUrl(src)) return '';
  const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
  return `![${bracketSafe(alt).replace(/\s+/g, ' ').trim()}](${encodeUrl(src)})`;
}

/** The marks that nest: a link, bold, italic. (Code excludes the others.) */
type NestingMark = 'link' | 'bold' | 'italic';
const NESTING: NestingMark[] = ['link', 'bold', 'italic'];

/** Which run of `mark` a node belongs to: a key, or null when it has none. */
function runKey(node: Node, mark: NestingMark): string | null {
  if (mark === 'link') return linkHref(node);
  return node.type === 'text' && hasMark(node, mark) ? mark : null;
}

/**
 * Inline content as Markdown, with emphasis NESTED as the editor holds it.
 *
 * Read left to right: at each point, the mark whose run reaches furthest
 * becomes the outer one and the rest nest inside it — "bold with *italic*
 * inside" is one bold span around an italic one, and "italic with **bold**
 * inside" the other way round, not a string of fragments. On a tie a link
 * wraps bold, and bold wraps italic.
 *
 * The renderer reads italic as `*…*` or `_…_` and bold as `**…**` or `__…__`,
 * each with no copy of its own marker inside, and has no escapes. So each mark
 * takes whichever marker its content leaves free (`__*both*__` for bold
 * italic); content that leaves none keeps its words and loses that emphasis.
 */
function inlineRun(nodes: Node[], marks: NestingMark[]): string {
  if (nodes.length === 0) return '';
  if (marks.length === 0) {
    return nodes
      .map((node) => {
        if (node.type === 'image') return imageMarkdown(node);
        if (node.type !== 'text') return '';
        const text = node.text ?? '';
        return hasMark(node, 'code') && text !== '' ? `\`${text.replace(/`/g, '')}\`` : text;
      })
      .join('');
  }

  let out = '';
  let index = 0;
  while (index < nodes.length) {
    let best: { mark: NestingMark; end: number } | null = null;
    for (const mark of marks) {
      const key = runKey(nodes[index]!, mark);
      if (key === null) continue;
      let end = index + 1;
      while (end < nodes.length && runKey(nodes[end]!, mark) === key) end += 1;
      if (!best || end > best.end) best = { mark, end };
    }

    if (!best) {
      out += inlineRun([nodes[index]!], []);
      index += 1;
      continue;
    }

    const rest = marks.filter((mark) => mark !== best.mark);
    out += wrap(best.mark, inlineRun(nodes.slice(index, best.end), rest), nodes[index]!);
    index = best.end;
  }
  return out;
}

function wrap(mark: NestingMark, inner: string, first: Node): string {
  if (inner.trim() === '') return inner;
  if (mark === 'link') return `[${bracketSafe(inner)}](${encodeUrl(linkHref(first)!)})`;
  if (mark === 'italic') {
    if (!inner.includes('*')) return `*${inner}*`;
    if (!inner.includes('_')) return `_${inner}_`;
    return inner;
  }
  if (!inner.includes('_')) return `__${inner}__`;
  if (!inner.includes('*')) return `**${inner}**`;
  return inner;
}

function inlineMarkdown(nodes: Node[] = []): string {
  return inlineRun(nodes, NESTING).trim();
}

/** The text of a container's paragraphs, as one line. */
function paragraphsLine(node: Node): string {
  return (node.content ?? [])
    .map((child) => inlineMarkdown(child.content))
    .filter((line) => line !== '')
    .join(' ');
}

function blockMarkdown(node: Node): string {
  switch (node.type) {
    case 'paragraph':
      return inlineMarkdown(node.content);
    case 'heading': {
      const text = inlineMarkdown(node.content);
      const level = Number(node.attrs?.level ?? 2);
      const hashes = Math.min(3, Math.max(1, level - 1));
      return text ? `${'#'.repeat(hashes)} ${text}` : '';
    }
    case 'bulletList':
    case 'orderedList': {
      const items = (node.content ?? []).map(paragraphsLine).filter((line) => line !== '');
      return items
        .map((item, position) =>
          node.type === 'orderedList' ? `${position + 1}. ${item}` : `- ${item}`,
        )
        .join('\n');
    }
    case 'blockquote': {
      const text = paragraphsLine(node);
      return text ? `> ${text}` : '';
    }
    default:
      // Nothing else exists in this schema; keep any text rather than lose it.
      return paragraphsLine(node);
  }
}

/** The editor's document as the Markdown the renderer publishes. */
export function articleMarkdown(doc: JSONContent | null | undefined): string {
  return (doc?.content ?? [])
    .map(blockMarkdown)
    .filter((block) => block !== '')
    .join('\n\n');
}

/** Words in a Markdown article, for "512 words · 3 min read". */
export function readingStats(words: number): { words: number; minutes: number } {
  return { words, minutes: Math.max(1, Math.round(words / 200)) };
}
