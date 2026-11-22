'use client';

import * as React from 'react';
import Link from 'next/link';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  Code,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@sailent/ui';

import type { AdminMedia } from '@/lib/admin/api';
import { articleExtensions, articleMarkdown, readingStats } from '@/lib/blog/article-editor-schema';
import { markdownToEditorJson } from '@/lib/blog/markdown-to-editor';
import { safeUrl } from '@/lib/blog/markdown';

/**
 * The article editor on /admin/blog (Tiptap, owner 2026-11-22).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT YOU WRITE IS WHAT READERS SEE, AND IT IS STILL SAVED AS MARKDOWN.
 *
 * The schema (`lib/blog/article-editor-schema.ts`) holds only what the public
 * page can draw, so nothing written here disappears or turns into stray
 * symbols on publish; pasted Word or Google Docs text keeps its words and the
 * formatting the page supports. Every change is written to a hidden `content`
 * field as Markdown — the form, the server action, the API and the public
 * renderer are unchanged, and the renderer stays the only path to the page.
 *
 * EASY TO USE: a toolbar that stays in view while you write (block style,
 * bold, italic, code, link, lists, quote, image from the Media library,
 * undo/redo), a small menu on selected text, the usual shortcuts (⌘B, ⌘I,
 * ⌘K for a link, ⌘Z) and Markdown as you type (`# `, `- `, `1. `, `> `).
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * The article's look inside the editor: the public page's own classes
 * (`renderMarkdown` in `lib/blog/markdown.tsx`), so the writer sees the page.
 * The editor's only addition is no gap above the first block.
 */
const CONTENT_CLASS = cn(
  'min-h-[28rem] px-5 py-5 sm:px-8 sm:py-6 focus:outline-none',
  'text-body-lg text-foreground/90 leading-[1.75]',
  '[&>:first-child]:mt-0',
  '[&_p]:my-5',
  '[&_h2]:text-h2 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-semibold [&_h2]:text-foreground',
  '[&_h3]:text-h3 [&_h3]:mb-3 [&_h3]:mt-10 [&_h3]:font-semibold [&_h3]:text-foreground',
  '[&_h4]:text-h4 [&_h4]:mb-2 [&_h4]:mt-8 [&_h4]:font-semibold [&_h4]:text-foreground',
  '[&_ul]:text-body [&_ul]:text-muted-foreground [&_ul]:my-4 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2',
  '[&_ol]:text-body [&_ol]:text-muted-foreground [&_ol]:my-4 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-2',
  '[&_li_p]:my-0',
  '[&_blockquote]:border-primary [&_blockquote]:text-foreground/80 [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:py-1 [&_blockquote]:pl-5 [&_blockquote]:italic',
  '[&_blockquote_p]:my-0',
  '[&_a]:underline [&_a]:underline-offset-2',
  '[&_code]:bg-muted [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]',
  '[&_img]:my-6 [&_img]:block [&_img]:w-full [&_img]:rounded-lg',
  '[&_img.ProseMirror-selectednode]:ring-primary [&_img.ProseMirror-selectednode]:ring-2',
  // The placeholder, on the first empty paragraph only.
  '[&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
);

type BlockStyle = 'paragraph' | '2' | '3' | '4';

const BLOCK_STYLES: { value: BlockStyle; label: string }[] = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: '2', label: 'Heading' },
  { value: '3', label: 'Subheading' },
  { value: '4', label: 'Small heading' },
];

/** What the toolbar shows as on or off, read from the editor. */
function readToolbarState(current: Editor) {
  const level = [2, 3, 4].find((value) => current.isActive('heading', { level: value }));
  return {
    block: (level ? String(level) : 'paragraph') as BlockStyle,
    bold: current.isActive('bold'),
    italic: current.isActive('italic'),
    code: current.isActive('code'),
    link: current.isActive('link'),
    bulletList: current.isActive('bulletList'),
    orderedList: current.isActive('orderedList'),
    blockquote: current.isActive('blockquote'),
    canUndo: current.can().undo(),
    canRedo: current.can().redo(),
    words: (current.storage.characterCount?.words() as number | undefined) ?? 0,
  };
}

type ToolbarState = ReturnType<typeof readToolbarState>;

/**
 * The toolbar's state, kept current on every edit and selection change.
 *
 * `useEditorState` re-runs on the editor's transactions only — and a freshly
 * created editor has had none, so on its own it would report "no editor"
 * until the first keystroke, and the toolbar (and the editor behind its
 * placeholder) would never appear. Until then the state is read directly.
 */
function useToolbarState(editor: Editor | null): ToolbarState | null {
  const tracked = useEditorState({
    editor,
    selector: ({ editor: current }) => (current ? readToolbarState(current) : null),
  });
  return tracked ?? (editor ? readToolbarState(editor) : null);
}

/**
 * A link as it should be stored: `example.org` gains `https://`; anything the
 * public page would refuse (a `javascript:` URL) is refused here first.
 */
function normaliseHref(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  const withScheme =
    /^(https?:|mailto:|\/|#)/i.test(value) || !value.includes('.') ? value : `https://${value}`;
  return safeUrl(withScheme);
}

export function ArticleEditor({
  name,
  labelId,
  describedBy,
  initialMarkdown,
  media,
  onDirty,
}: {
  /** The form field the Markdown is submitted as. */
  name: string;
  /** The id of the visible label, for `aria-labelledby`. */
  labelId: string;
  describedBy?: string;
  /** The article as stored. The editor opens on it as the public page draws it. */
  initialMarkdown: string;
  media: AdminMedia[];
  /** Called on every edit, for the unsaved-changes guard. */
  onDirty?: () => void;
}) {
  const [markdown, setMarkdown] = React.useState(initialMarkdown);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [imageOpen, setImageOpen] = React.useState(false);
  const extensions = React.useMemo(() => articleExtensions(), []);
  // Read once, by the public renderer (`markdown-to-editor.ts`).
  const [initialContent] = React.useState(() => markdownToEditorJson(initialMarkdown));

  const editor = useEditor({
    extensions,
    content: initialContent,
    // Rendered on the client only: the server has no editor to hydrate.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: CONTENT_CLASS,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        spellcheck: 'true',
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          // ⌘K in the article is "add a link" — kept from the admin header,
          // whose window-wide ⌘K opens Quick jump.
          event.preventDefault();
          event.stopPropagation();
          setLinkOpen(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      setMarkdown(articleMarkdown(current.getJSON()));
      onDirty?.();
    },
  });

  const state = useToolbarState(editor);
  const stats = readingStats(state?.words ?? 0);

  return (
    <div className="border-border bg-surface focus-within:border-primary focus-within:ring-primary/15 relative rounded-xl border transition-shadow focus-within:ring-4">
      {/* The article as Markdown — what the form saves. */}
      <input type="hidden" name={name} value={markdown} />

      {editor && state ? (
        <>
          <Toolbar
            editor={editor}
            state={state}
            onLink={() => setLinkOpen(true)}
            onImage={() => setImageOpen(true)}
          />

          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: current, state: view }) =>
              !view.selection.empty && !current.isActive('code') && !current.isActive('image')
            }
            className="border-border bg-surface flex items-center gap-0.5 rounded-lg border p-1 shadow-md"
          >
            <ToolButton
              icon={Bold}
              label="Bold"
              shortcut="⌘B"
              active={state.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolButton
              icon={Italic}
              label="Italic"
              shortcut="⌘I"
              active={state.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolButton
              icon={Link2}
              label="Link"
              shortcut="⌘K"
              active={state.link}
              onClick={() => setLinkOpen(true)}
            />
          </BubbleMenu>

          <EditorContent editor={editor} />

          <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs">
            <span>
              Type <kbd className="font-mono">#</kbd> for a heading,{' '}
              <kbd className="font-mono">-</kbd> for a list, <kbd className="font-mono">&gt;</kbd>{' '}
              for a quote.
            </span>
            <span data-numeric="" className="tabular-nums" aria-live="polite">
              {stats.words} {stats.words === 1 ? 'word' : 'words'} · {stats.minutes} min read
            </span>
          </div>

          <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
          <ImageDialog editor={editor} media={media} open={imageOpen} onOpenChange={setImageOpen} />
        </>
      ) : (
        // The editor's footprint while it loads, so nothing below it jumps.
        <div aria-hidden="true" className="h-[33rem] animate-pulse rounded-xl" />
      )}
    </div>
  );
}

function Toolbar({
  editor,
  state,
  onLink,
  onImage,
}: {
  editor: Editor;
  state: ToolbarState;
  onLink: () => void;
  onImage: () => void;
}) {
  const setBlock = (value: BlockStyle) => {
    const chain = editor.chain().focus();
    if (value === 'paragraph') chain.setParagraph().run();
    else chain.setHeading({ level: Number(value) as 2 | 3 | 4 }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      // Stays in view while a long article scrolls under it — just below the
      // admin header (`h-14`, sticky at the top), not behind it. Solid, so no
      // text shows through the buttons.
      className="border-border bg-surface sticky top-14 z-10 flex flex-wrap items-center gap-1 rounded-t-xl border-b px-2 py-1.5"
    >
      <label className="sr-only" htmlFor="article-block-style">
        Text style
      </label>
      <select
        id="article-block-style"
        value={state.block}
        onChange={(event) => setBlock(event.target.value as BlockStyle)}
        className="border-border bg-surface text-foreground hover:border-border-strong focus-visible:border-primary h-9 rounded-md border px-2 text-sm focus-visible:outline-none"
      >
        {BLOCK_STYLES.map((style) => (
          <option key={style.value} value={style.value}>
            {style.label}
          </option>
        ))}
      </select>

      <Divider />
      <ToolButton
        icon={Bold}
        label="Bold"
        shortcut="⌘B"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Italic"
        shortcut="⌘I"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={Code}
        label="Inline code"
        shortcut="⌘E"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolButton icon={Link2} label="Link" shortcut="⌘K" active={state.link} onClick={onLink} />

      <Divider />
      <ToolButton
        icon={List}
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        icon={Quote}
        label="Quote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton icon={ImagePlus} label="Image from the Media library" onClick={onImage} />

      <div className="ml-auto flex items-center gap-1">
        <ToolButton
          icon={Undo2}
          label="Undo"
          shortcut="⌘Z"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          icon={Redo2}
          label="Redo"
          shortcut="⇧⌘Z"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="bg-border mx-1 h-5 w-px" />;
}

function ToolButton({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      {...(active === undefined ? {} : { 'aria-pressed': active })}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        'text-muted-foreground-strong hover:bg-muted hover:text-foreground focus-visible:outline-ring grid size-9 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-accent text-primary hover:bg-accent',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}

function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [href, setHref] = React.useState('');
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const hasSelection = !editor.state.selection.empty;
  const editingLink = editor.isActive('link');

  React.useEffect(() => {
    if (!open) return;
    setHref((editor.getAttributes('link').href as string | undefined) ?? '');
    setText('');
    setError(null);
  }, [open, editor]);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const url = normaliseHref(href);
    if (!url) {
      setError(
        'Enter a web address (https://…), an email (mailto:…) or a page on this site (/about).',
      );
      return;
    }
    const chain = editor.chain().focus();
    if (hasSelection || editingLink) {
      chain.extendMarkRange('link').setLink({ href: url }).run();
    } else {
      chain
        .insertContent({
          type: 'text',
          text: text.trim() || url,
          marks: [{ type: 'link', attrs: { href: url } }],
        })
        .run();
    }
    onOpenChange(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={apply} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editingLink ? 'Edit link' : 'Add a link'}</DialogTitle>
            <DialogDescription>
              A web address, an email address or a page on this site.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="article-link-href">Address</Label>
            <Input
              id="article-link-href"
              value={href}
              onChange={(event) => {
                setHref(event.target.value);
                setError(null);
              }}
              placeholder="https://example.org or /programs"
              autoFocus
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'article-link-error' : undefined}
            />
            {error ? (
              <p id="article-link-error" className="text-destructive text-xs font-medium">
                {error}
              </p>
            ) : null}
          </div>
          {!hasSelection && !editingLink ? (
            <div className="space-y-1.5">
              <Label htmlFor="article-link-text">Text to show</Label>
              <Input
                id="article-link-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Leave empty to show the address"
              />
            </div>
          ) : null}
          <DialogFooter>
            {editingLink ? (
              <Button type="button" variant="outline" onClick={remove}>
                Remove link
              </Button>
            ) : null}
            <Button type="submit">{editingLink ? 'Update link' : 'Add link'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImageDialog({
  editor,
  media,
  open,
  onOpenChange,
}: {
  editor: Editor;
  media: AdminMedia[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Public images only: a private file has no address a reader could load.
  const images = media.filter(
    (item) => item.visibility === 'public' && item.url && item.mimeType.startsWith('image/'),
  );

  const insert = (item: AdminMedia) => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'paragraph',
        content: [{ type: 'image', attrs: { src: item.url, alt: item.altText } }],
      })
      .run();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add an image</DialogTitle>
          <DialogDescription>
            From the Media library. Its alt text goes with it, for readers who cannot see it.
          </DialogDescription>
        </DialogHeader>
        {images.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">
            No public images in the library yet.{' '}
            <Link href="/admin/media" className="hover:text-foreground underline">
              Upload one
            </Link>
            .
          </p>
        ) : (
          <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {images.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => insert(item)}
                  className="border-border hover:border-primary focus-visible:outline-ring group block w-full overflow-hidden rounded-lg border text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url!}
                    alt=""
                    className="bg-muted aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  <span className="text-caption text-muted-foreground block truncate px-2 py-1.5">
                    {item.altText || 'No alt text'}
                  </span>
                  <span className="sr-only">
                    Insert: {item.altText || 'image without alt text'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
