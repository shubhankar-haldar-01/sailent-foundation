import * as React from 'react';
import type { JSONContent } from '@tiptap/core';

import { renderMarkdown } from './markdown';

/**
 * An article's Markdown as the blog editor's document — read by the PUBLIC
 * RENDERER, so the editor opens on exactly what readers see.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE PARSER, NOT TWO. `renderMarkdown` already turns Markdown into React
 * elements: paragraphs, h2–h4, lists, quotes, and inline bold, italic, code,
 * links and images, with unsafe URLs already dropped (a refused link keeps its
 * words). This walks those elements into the editor's schema
 * (`article-editor-schema.ts`) instead of parsing the Markdown a second time —
 * a second parser would one day disagree with the first, and the editor would
 * show something readers do not see.
 *
 * No HTML is produced or parsed on the way: elements in, editor nodes out.
 * (`react-dom/server` is not allowed in App Router code, and is not needed.)
 * ══════════════════════════════════════════════════════════════════════════
 */

type Mark = NonNullable<JSONContent['marks']>[number];

interface ElementProps {
  children?: React.ReactNode;
  href?: string;
  src?: string;
  alt?: string;
}

function childrenOf(node: React.ReactNode): React.ReactNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  return [node];
}

function asElement(node: React.ReactNode): React.ReactElement<ElementProps> | null {
  return React.isValidElement<ElementProps>(node) ? node : null;
}

/** Inline elements → text and image nodes carrying their marks. */
function inlineNodes(children: React.ReactNode, marks: Mark[] = []): JSONContent[] {
  const out: JSONContent[] = [];

  for (const child of childrenOf(children)) {
    if (typeof child === 'string' || typeof child === 'number') {
      const text = String(child);
      // The editor allows no empty text nodes.
      if (text !== '') out.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
      continue;
    }

    const element = asElement(child);
    if (!element) continue;
    const { props } = element;

    switch (element.type) {
      case 'strong':
        out.push(...inlineNodes(props.children, [...marks, { type: 'bold' }]));
        break;
      case 'em':
        out.push(...inlineNodes(props.children, [...marks, { type: 'italic' }]));
        break;
      case 'code':
        // Code stands alone, as in the editor: no emphasis or link around it.
        out.push(...inlineNodes(props.children, [{ type: 'code' }]));
        break;
      case 'a':
        out.push(
          ...inlineNodes(props.children, [...marks, { type: 'link', attrs: { href: props.href } }]),
        );
        break;
      case 'img':
        out.push({ type: 'image', attrs: { src: props.src, alt: props.alt ?? '' } });
        break;
      default:
        out.push(...inlineNodes(props.children, marks));
    }
  }

  return out;
}

function paragraph(children: React.ReactNode): JSONContent {
  const content = inlineNodes(children);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

/** The article as the editor's document. Empty Markdown is an empty document. */
export function markdownToEditorJson(markdown: string | null | undefined): JSONContent {
  const blocks: JSONContent[] = [];

  for (const block of childrenOf(renderMarkdown(markdown))) {
    const element = asElement(block);
    if (!element) continue;
    const { props } = element;

    switch (element.type) {
      case 'h2':
      case 'h3':
      case 'h4':
        blocks.push({
          type: 'heading',
          attrs: { level: Number(String(element.type).slice(1)) },
          content: inlineNodes(props.children),
        });
        break;
      case 'ul':
      case 'ol':
        blocks.push({
          type: element.type === 'ul' ? 'bulletList' : 'orderedList',
          content: childrenOf(props.children)
            .map(asElement)
            .filter((item): item is React.ReactElement<ElementProps> => item !== null)
            .map((item) => ({ type: 'listItem', content: [paragraph(item.props.children)] })),
        });
        break;
      case 'blockquote':
        blocks.push({ type: 'blockquote', content: [paragraph(props.children)] });
        break;
      default:
        blocks.push(paragraph(props.children));
    }
  }

  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] };
}
