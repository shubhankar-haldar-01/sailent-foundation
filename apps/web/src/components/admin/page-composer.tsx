'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Alert, Button, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import {
  createPage,
  revertPage,
  setPageStatus,
  updatePage,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminPage, PageSectionValue } from '@/lib/admin/api';

/**
 * The section composer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AN ORDERED LIST, NOT A CANVAS.
 *
 * docs/product-requirements.md §4.17 asks for a composer "for the homepage and
 * marketing pages only" — an editor picks which approved sections appear and
 * in what order. There is no drag-to-position, no columns, no free text: those
 * are the affordances of a page builder, and a page builder is what
 * `docs/database-architecture.md` says this must not become.
 *
 * MOVE BUTTONS RATHER THAN DRAG AND DROP. Reordering has to work with a
 * keyboard and a screen reader, and "press Move up" does that with no library,
 * no pointer events and no announcement to write. Drag-and-drop would need all
 * three to reach the same place.
 *
 * The list is kept in React state and submitted as JSON in one hidden field.
 * The API re-validates it against the approved registry regardless — this form
 * offering only approved sections is a convenience, not the control.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** The sections an editor may add, with a human name for each. */
const AVAILABLE: { type: string; label: string; description: string }[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'The opening band, with the verified headline figures.',
  },
  {
    type: 'campaigns',
    label: 'Campaigns',
    description: 'Campaign cards with the focus-area filter.',
  },
  { type: 'impact', label: 'Impact figures', description: 'The verified numbers strip.' },
  { type: 'about', label: 'Who we are', description: 'The standing explanatory band.' },
  {
    type: 'storiesAndEvents',
    label: 'Stories and events',
    description: 'Recent stories beside what is coming up.',
  },
  { type: 'testimonials', label: 'Testimonials', description: 'What people have said.' },
  { type: 'community', label: 'Community', description: 'The community call to action.' },
  { type: 'partners', label: 'Partners', description: 'Partner logos.' },
  { type: 'newsletter', label: 'Newsletter', description: 'The sign-up band.' },
];

const labelFor = (type: string) => AVAILABLE.find((item) => item.type === type)?.label ?? type;

export function PageComposer({ page }: { page?: AdminPage }) {
  const action = page ? updatePage : createPage;
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(action, {});
  const router = useRouter();

  const [sections, setSections] = React.useState<PageSectionValue[]>(page?.sections ?? []);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setSections(next);
  };

  return (
    <form action={formAction} className="space-y-8">
      {page ? <input type="hidden" name="id" value={page.id} /> : null}
      {page ? <input type="hidden" name="slug" value={page.slug} /> : null}
      {/*
        The composition, as JSON. One field rather than many, because the order
        IS the value — a set of numbered inputs would make reordering a matter
        of rewriting every one of them.
      */}
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />

      <FormStatus state={state} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!page ? (
            <Field
              label="Route"
              name="slug"
              required
              hint="The page this composes: home, about. It does not create a route."
              errors={state.fieldErrors}
            >
              <Input id="slug" name="slug" required maxLength={120} placeholder="home" />
            </Field>
          ) : null}

          <Field label="Title" name="title" required errors={state.fieldErrors}>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={page?.title ?? ''}
            />
          </Field>

          <section aria-labelledby="sections-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="sections-heading" className="text-body-sm font-medium">
                Sections ({sections.length})
              </h2>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setAdding(!adding)}
              >
                <Plus className="mr-1 size-4" aria-hidden="true" />
                Add a section
              </Button>
            </div>

            {adding ? (
              <ul className="border-border mb-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                {AVAILABLE.map((item) => (
                  <li key={item.type}>
                    <button
                      type="button"
                      onClick={() => {
                        setSections([...sections, { type: item.type, props: {} }]);
                        setAdding(false);
                      }}
                      className="border-border hover:border-primary w-full rounded-md border p-3 text-left"
                    >
                      <span className="text-body-sm block font-medium">{item.label}</span>
                      <span className="text-caption text-muted-foreground">{item.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {sections.length === 0 ? (
              <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                No sections yet. A page needs at least one before it can be published.
              </p>
            ) : (
              <ol className="space-y-2">
                {sections.map((section, index) => (
                  <li
                    key={`${section.type}-${index}`}
                    className="border-border flex items-center gap-3 rounded-md border p-3"
                  >
                    <span className="text-caption text-muted-foreground w-6 shrink-0 text-center">
                      {index + 1}
                    </span>
                    <span className="text-body-sm flex-1 font-medium">
                      {labelFor(section.type)}
                    </span>

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, index - 1)}
                        disabled={index === 0}
                        aria-label={`Move ${labelFor(section.type)} up`}
                        className="border-border hover:bg-muted rounded-md border p-1.5 disabled:opacity-40"
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, index + 1)}
                        disabled={index === sections.length - 1}
                        aria-label={`Move ${labelFor(section.type)} down`}
                        className="border-border hover:bg-muted rounded-md border p-1.5 disabled:opacity-40"
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSections(sections.filter((_, i) => i !== index))}
                        aria-label={`Remove ${labelFor(section.type)}`}
                        className="border-border hover:bg-muted rounded-md border p-1.5"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {page ? (
            <Field
              label="What changed"
              name="note"
              hint="Recorded on this version, so the history reads as a story rather than a list of dates."
              errors={state.fieldErrors}
            >
              <Input id="note" name="note" maxLength={300} />
            </Field>
          ) : null}
        </div>

        {page ? (
          <div className="space-y-6">
            <fieldset className="border-border space-y-4 rounded-lg border p-4">
              <legend className="text-body-sm px-1 font-medium">Search appearance</legend>

              <Field label="SEO title" name="metaTitle" errors={state.fieldErrors}>
                <Input
                  id="metaTitle"
                  name="metaTitle"
                  maxLength={240}
                  defaultValue={page.metaTitle ?? ''}
                />
              </Field>

              <Field label="SEO description" name="metaDescription" errors={state.fieldErrors}>
                <TextArea
                  name="metaDescription"
                  rows={3}
                  maxLength={400}
                  defaultValue={page.metaDescription ?? ''}
                />
              </Field>
            </fieldset>
          </div>
        ) : null}
      </div>

      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
        <SubmitButton pending={pending}>{page ? 'Save changes' : 'Create page'}</SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/admin/pages">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

/**
 * Publish, schedule, unpublish and archive.
 *
 * A separate form from the composer, and a two-step confirmation, for the
 * reason `blog-form.tsx` sets out: the shared `Button` does not forward
 * `name`/`value`, and publishing the homepage should not happen on one click.
 */
export function PageStatusControls({ page }: { page: AdminPage }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(
    setPageStatus,
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

  const empty = page.sections.length === 0;

  if (!target) {
    return (
      <div className="border-border space-y-3 rounded-lg border p-4">
        <p className="text-body-sm font-medium">
          Status: <span className="capitalize">{page.status}</span>
          {page.scheduledAt && !page.isLive ? (
            <span className="text-warning ml-2 font-normal">
              scheduled for {new Date(page.scheduledAt).toLocaleString('en-IN')}
            </span>
          ) : null}
        </p>

        <FormStatus state={state} />

        <div className="flex flex-wrap gap-2">
          {page.status !== 'published' ? (
            <Button type="button" onClick={() => setTarget('published')} disabled={empty}>
              Publish
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setTarget('draft')}>
              Unpublish
            </Button>
          )}

          {page.status !== 'archived' ? (
            <Button type="button" variant="destructive" onClick={() => setTarget('archived')}>
              Archive
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setTarget('draft')}>
              Restore as draft
            </Button>
          )}
        </div>

        {empty ? (
          <p className="text-body-sm text-muted-foreground">
            A page needs at least one section before it can be published.
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
      <input type="hidden" name="id" value={page.id} />
      <input type="hidden" name="slug" value={page.slug} />
      <input type="hidden" name="status" value={target} />

      <FormStatus state={state} />

      <h3 className="text-h4 font-semibold">
        {target === 'published'
          ? 'Publish this page?'
          : target === 'archived'
            ? 'Archive this page?'
            : 'Take this page off the site?'}
      </h3>

      {target === 'published' ? (
        <>
          <p className="text-body-sm text-muted-foreground">
            It replaces what visitors see at <code>/{page.slug === 'home' ? '' : page.slug}</code>.
          </p>
          <Field
            label="Go live at"
            name="scheduledAt"
            hint="Leave empty to publish now. A future time keeps the page hidden until then."
            errors={state.fieldErrors}
          >
            <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
          </Field>
        </>
      ) : (
        <p className="text-body-sm text-muted-foreground">
          The route falls back to its built-in order. Nothing is deleted, and every version is kept.
        </p>
      )}

      <Field
        label="Reason"
        name="reason"
        errors={state.fieldErrors}
        hint="Optional, and recorded on the audit entry."
      >
        <Input id="reason" name="reason" />
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

/** Restore an earlier version. */
export function PageRevisions({ page }: { page: AdminPage }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(revertPage, {});
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (page.revisions.length <= 1) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Only one version so far. Every save adds another.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <FormStatus state={state} />

      {/*
        Restoring is a NEW save of old content, said plainly — an editor should
        not have to guess whether reverting loses what is being replaced.
      */}
      <Alert variant="info">
        Restoring keeps everything: it saves the older composition as a new version.
      </Alert>

      <ul className="space-y-2">
        {page.revisions.map((revision) => (
          <li
            key={revision.version}
            className="border-border flex items-center gap-3 rounded-md border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-medium">
                Version {revision.version}
                {revision.version === page.version ? (
                  <span className="text-muted-foreground font-normal"> — current</span>
                ) : null}
              </p>
              <p className="text-caption text-muted-foreground truncate">
                {revision.note ?? 'No note'} ·{' '}
                {new Date(revision.createdAt).toLocaleString('en-IN')}
              </p>
            </div>

            {revision.version !== page.version ? (
              <form action={formAction} className="shrink-0">
                <input type="hidden" name="id" value={page.id} />
                <input type="hidden" name="slug" value={page.slug} />
                <input type="hidden" name="version" value={revision.version} />
                <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                  Restore
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
