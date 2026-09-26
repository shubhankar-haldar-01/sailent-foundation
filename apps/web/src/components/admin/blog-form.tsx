'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { MediaPicker } from '@/components/admin/media-picker';
import {
  createBlogPost,
  setBlogStatus,
  updateBlogPost,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminBlogPost, AdminCategory, AdminMedia } from '@/lib/admin/api';

/**
 * The blog editor.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A TEXTAREA AND MARKDOWN, NOT A RICH-TEXT EDITOR.
 *
 * The repository had no editor dependency and no markdown renderer — success
 * stories render plain text in fixed sections. Rather than introduce a
 * WYSIWYG, the body is markdown in a textarea with a small toolbar that
 * inserts the markers.
 *
 * That choice is mostly about SAFETY. A rich-text editor produces HTML, and
 * storing HTML means either trusting it or sanitising it on the way out — a
 * denylist that has to stay ahead of every parser quirk forever. Markdown is
 * rendered to React ELEMENTS by `lib/blog/markdown.tsx`, which never produces
 * markup from stored text at all, so there is no injection point to defend.
 *
 * It is also about scope: the brief asks for headings, bold, italic, links,
 * lists, quotes and images, and explicitly not a page builder. This is exactly
 * that list and nothing else.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function BlogForm({
  post,
  mediaOptions = [],
  categories = [],
}: {
  post?: AdminBlogPost;
  mediaOptions?: AdminMedia[];
  categories?: AdminCategory[];
}) {
  const action = post ? updateBlogPost : createBlogPost;
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(action, {});
  const router = useRouter();

  const [title, setTitle] = React.useState(post?.title ?? '');
  const [slug, setSlug] = React.useState(post?.slug ?? '');
  const [slugTouched, setSlugTouched] = React.useState(Boolean(post));
  const [featured, setFeatured] = React.useState<string | null>(post?.featuredMediaId ?? null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
    else if (state.ok) router.refresh();
  }, [state.ok, state.redirectTo, router]);

  /*
    THE SLUG FOLLOWS THE TITLE ONLY UNTIL SOMEBODY EDITS IT.

    A generated slug is a convenience while drafting. Once an editor has typed
    one — or once the post exists at all — it is an address, and quietly
    rewriting it as the title is polished is how a URL changes without anybody
    deciding to change it.
  */
  const derivedSlug = React.useMemo(
    () =>
      title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 200),
    [title],
  );
  const effectiveSlug = slugTouched ? slug : derivedSlug;

  const isPublished = post?.status === 'published';
  const blockers = post?.publishBlockers ?? [];

  /** Wrap or insert a marker at the cursor. */
  const applyMarker = (before: string, after = before, placeholder = 'text') => {
    const field = bodyRef.current;
    if (!field) return;

    const { selectionStart: start, selectionEnd: end, value } = field;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;

    field.value = next;
    field.focus();
    // Leave the inserted text selected, so typing replaces the placeholder.
    field.setSelectionRange(start + before.length, start + before.length + selected.length);
  };

  const TOOLBAR: { label: string; title: string; apply: () => void }[] = [
    { label: 'H2', title: 'Heading', apply: () => applyMarker('\n## ', '', 'Heading') },
    { label: 'B', title: 'Bold', apply: () => applyMarker('**', '**', 'bold text') },
    { label: 'I', title: 'Italic', apply: () => applyMarker('*', '*', 'italic text') },
    { label: 'Link', title: 'Link', apply: () => applyMarker('[', '](https://)', 'link text') },
    { label: 'List', title: 'Bulleted list', apply: () => applyMarker('\n- ', '', 'item') },
    { label: '1.', title: 'Numbered list', apply: () => applyMarker('\n1. ', '', 'item') },
    { label: '❝', title: 'Quotation', apply: () => applyMarker('\n> ', '', 'quotation') },
  ];

  return (
    <form action={formAction} className="space-y-8">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      {post ? <input type="hidden" name="previousSlug" value={post.slug} /> : null}
      <input type="hidden" name="featuredMediaId" value={featured ?? ''} />

      {/*
        THE BLOCKERS STAND AT THE TOP whenever there are any, rather than
        appearing when publish is pressed. Discovering that an article cannot
        be published after writing it is the failure this avoids.
      */}
      {blockers.length > 0 ? (
        <Alert variant="warning" title="Not ready to publish">
          <ul className="list-disc space-y-1 pl-5">
            {blockers.map((blocker) => (
              <li key={blocker.code}>{blocker.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <FormStatus state={state} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Field label="Title" name="title" required errors={state.fieldErrors}>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <Field
            label="URL"
            name="slug"
            hint={
              isPublished
                ? 'This post is live. Changing the URL redirects the old one permanently — it will not break.'
                : 'Generated from the title until you edit it.'
            }
            errors={state.fieldErrors}
          >
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-muted-foreground shrink-0">/blog/</span>
              <Input
                id="slug"
                name="slug"
                maxLength={200}
                value={effectiveSlug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
              />
            </div>
          </Field>

          <Field
            label="Summary"
            name="excerpt"
            hint="Shown on the listing and used as the search-result description."
            errors={state.fieldErrors}
          >
            <TextArea name="excerpt" rows={3} maxLength={500} defaultValue={post?.excerpt ?? ''} />
          </Field>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {TOOLBAR.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.apply}
                  title={item.title}
                  aria-label={item.title}
                  className="border-border text-caption hover:bg-muted min-w-9 rounded-md border px-2 py-1 font-medium"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <Field
              label="Article"
              name="content"
              hint="Markdown: ## heading, **bold**, *italic*, [link](url), - list, > quote."
              errors={state.fieldErrors}
            >
              <TextArea
                ref={bodyRef}
                name="content"
                rows={20}
                maxLength={100_000}
                defaultValue={post?.content ?? ''}
                className="font-mono"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Category" name="categoryId" errors={state.fieldErrors}>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={post?.categoryId ?? ''}
              className="border-border bg-background text-body-sm w-full rounded-md border px-3 py-2"
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Tags"
            name="tags"
            hint="Comma separated. Spelling and case are normalised, so one tag is stored once."
            errors={state.fieldErrors}
          >
            <Input
              id="tags"
              name="tags"
              defaultValue={(post?.tags ?? []).map((tag) => tag.name).join(', ')}
            />
          </Field>

          <MediaPicker
            options={mediaOptions}
            selectedId={featured}
            onSelect={(media) => setFeatured(media?.id ?? null)}
          />

          <fieldset className="border-border space-y-4 rounded-lg border p-4">
            <legend className="text-body-sm px-1 font-medium">Search appearance</legend>

            <Field
              label="SEO title"
              name="metaTitle"
              hint="Defaults to the article title."
              errors={state.fieldErrors}
            >
              <Input
                id="metaTitle"
                name="metaTitle"
                maxLength={240}
                defaultValue={post?.metaTitle ?? ''}
              />
            </Field>

            <Field
              label="SEO description"
              name="metaDescription"
              hint="Defaults to the summary."
              errors={state.fieldErrors}
            >
              <TextArea
                name="metaDescription"
                rows={3}
                maxLength={400}
                defaultValue={post?.metaDescription ?? ''}
              />
            </Field>

            <Field
              label="Canonical URL"
              name="canonicalUrl"
              hint="Only if this article was first published somewhere else. Leave empty otherwise."
              errors={state.fieldErrors}
            >
              <Input
                id="canonicalUrl"
                name="canonicalUrl"
                type="url"
                defaultValue={post?.canonicalUrl ?? ''}
              />
            </Field>
          </fieldset>
        </div>
      </div>

      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
        <SubmitButton pending={pending}>{post ? 'Save changes' : 'Create draft'}</SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/admin/blog">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

/**
 * Publish, unpublish and archive.
 *
 * A SEPARATE FORM from the editor above, because it is a separate decision
 * with a separate permission and a re-authentication behind it. Putting a
 * publish control inside the save form invites publishing by reflex while
 * saving a half-finished edit.
 */
export function BlogStatusControls({ post }: { post: AdminBlogPost }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(
    setBlogStatus,
    {},
  );
  const router = useRouter();
  const [target, setTarget] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (state.ok) {
      setTarget(null);
      router.refresh();
    }
  }, [state.ok, router]);

  const blocked = post.publishBlockers.length > 0;

  /*
    TWO STEPS, AND THE STATUS TRAVELS IN A HIDDEN INPUT.

    The first version put `name="status" value="published"` on the submit
    buttons, which is standard HTML and did not work: the shared `Button`
    does not forward those attributes to the element it renders, so the action
    received no status and answered "The submitted data is not valid" — after
    the re-authentication had already been done, which made it look like the
    re-auth had failed.

    The confirmation step is what `story-form.tsx` does, and it is right on its
    own terms: publishing puts the organisation's name behind an article and
    archiving takes down something that may already be linked, so neither
    should happen on a single click. It also carries the optional reason that
    lands on the audit row.
  */
  if (!target) {
    return (
      <div className="border-border space-y-3 rounded-lg border p-4">
        <p className="text-body-sm font-medium">
          Status: <span className="capitalize">{post.status}</span>
        </p>

        <FormStatus state={state} />

        <div className="flex flex-wrap gap-2">
          {post.status !== 'published' ? (
            <Button type="button" onClick={() => setTarget('published')} disabled={blocked}>
              Publish
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setTarget('draft')}>
              Unpublish
            </Button>
          )}

          {post.status !== 'archived' ? (
            <Button type="button" variant="destructive" onClick={() => setTarget('archived')}>
              Archive
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setTarget('draft')}>
              Restore as draft
            </Button>
          )}
        </div>

        {blocked ? (
          <p className="text-body-sm text-muted-foreground">
            Publishing is unavailable until the problems above are resolved.
          </p>
        ) : null}

        <p className="text-caption text-muted-foreground">
          Publishing and archiving ask you to confirm your password.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="border-border space-y-4 rounded-lg border p-5">
      <input type="hidden" name="id" value={post.id} />
      <input type="hidden" name="slug" value={post.slug} />
      <input type="hidden" name="status" value={target} />

      <FormStatus state={state} />

      <h3 className="text-h4 font-semibold">
        {target === 'published'
          ? 'Publish this post?'
          : target === 'archived'
            ? 'Archive this post?'
            : 'Take this post off the site?'}
      </h3>
      <p className="text-body-sm text-muted-foreground">
        {target === 'published'
          ? 'It becomes visible to everybody, under the organisation’s name, and is listed in the sitemap.'
          : 'It disappears from the public site and from the sitemap. Nothing is deleted.'}
      </p>

      <Field
        label="Reason"
        name="reason"
        errors={state.fieldErrors}
        hint="Optional, and recorded on the audit entry."
      >
        <Input id="reason" name="reason" minLength={3} />
      </Field>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>Confirm</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setTarget(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
