'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { CoverImagePicker } from '@/components/admin/cover-image-picker';
import { useEditorGuard } from '@/lib/feedback/use-unsaved-changes-guard';
import { createStory, setStoryStatus, updateStory, type ActionState } from '@/lib/admin/actions';
import type { AdminMedia, AdminStory, PublishBlocker } from '@/lib/admin/api';

/**
 * The success story editor.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE CONSENT SECTION IS THE POINT OF THIS SCREEN, NOT A FOOTNOTE ON IT.
 *
 * A success story is somebody's account of their own life, published under the
 * organisation's name. The database has enforced a publish-time consent check
 * since Phase 3; the API now states it as a field error before the constraint
 * fires. This form's job is to say so BEFORE the editor writes two thousand
 * words and then discovers the publish button does not work.
 *
 * So the blockers are shown standing, at the top, whenever there are any — not
 * revealed by pressing publish.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Not a page builder. Fixed fields for the sections the public page renders
 * under fixed headings, and nothing that arranges them.
 */
export function StoryForm({
  story,
  mediaOptions = [],
}: {
  story?: AdminStory;
  /** Recent PUBLIC images, for the cover picker. Empty is fine. */
  mediaOptions?: AdminMedia[];
}) {
  const action = story ? updateStory : createStory;
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(action, {});
  // A long editor: leaving with unsaved edits asks first (docs/ui-feedback.md).
  const guard = useEditorGuard(state);
  const router = useRouter();

  const [namesSomebody, setNamesSomebody] = React.useState(Boolean(story?.subjectName));
  const [anonymised, setAnonymised] = React.useState(story?.isAnonymised ?? false);
  const [consent, setConsent] = React.useState(story?.consentObtained ?? false);

  React.useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
    else if (state.ok) router.refresh();
  }, [state.ok, state.redirectTo, router]);

  /*
    The same rule the API and the database apply, mirrored here ONLY to explain
    the button. The server decides; this just avoids a pointless round trip and
    tells the editor what to do about it.
  */
  const consentMissing = namesSomebody && !anonymised && !consent;

  return (
    <form action={formAction} onChange={guard.markDirty} className="max-w-3xl space-y-8">
      {guard.dialog}
      {story ? <input type="hidden" name="id" value={story.id} /> : null}
      {story ? <input type="hidden" name="slug" value={story.slug} /> : null}

      <FormStatus state={state} success="Story saved" />
      {story && story.publishBlockers.length > 0 ? (
        <BlockerNotice blockers={story.publishBlockers} status={story.status} />
      ) : null}

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">The story</h2>
        <Field label="Title" name="title" required errors={state.fieldErrors}>
          <Input id="title" name="title" defaultValue={story?.title} required />
        </Field>
        <Field
          label="Summary"
          name="excerpt"
          errors={state.fieldErrors}
          hint="One or two sentences. This is what appears on the stories listing."
        >
          <TextArea name="excerpt" rows={3} defaultValue={story?.excerpt ?? ''} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">What happened</h2>
        <p className="text-body-sm text-muted-foreground">
          These four appear on the public page under fixed headings. Leave any blank and its heading
          is simply not shown.
        </p>
        <Field label="The challenge" name="challenge" errors={state.fieldErrors}>
          <TextArea name="challenge" rows={4} defaultValue={story?.challenge ?? ''} />
        </Field>
        <Field label="What we did" name="intervention" errors={state.fieldErrors}>
          <TextArea name="intervention" rows={4} defaultValue={story?.intervention ?? ''} />
        </Field>
        <Field label="The journey" name="journey" errors={state.fieldErrors}>
          <TextArea name="journey" rows={4} defaultValue={story?.journey ?? ''} />
        </Field>
        <Field label="The outcome" name="outcome" errors={state.fieldErrors}>
          <TextArea name="outcome" rows={4} defaultValue={story?.outcome ?? ''} />
        </Field>
        <Field label="What it means" name="impact" errors={state.fieldErrors}>
          <TextArea name="impact" rows={3} defaultValue={story?.impact ?? ''} />
        </Field>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="border-warning/40 bg-warning/5 space-y-4 rounded-lg border p-5">
        <h2 className="text-h3 font-semibold">The person this is about</h2>
        <p className="text-body-sm text-muted-foreground">
          A story that names somebody must either record that they agreed to appear, or be marked
          anonymised. A story that names nobody needs neither.
        </p>

        <Field
          label="Name"
          name="subjectName"
          errors={state.fieldErrors}
          hint="Leave blank if the story names nobody."
        >
          <Input
            id="subjectName"
            name="subjectName"
            defaultValue={story?.subjectName ?? ''}
            onChange={(event) => setNamesSomebody(event.target.value.trim().length > 0)}
          />
        </Field>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="consentObtained"
            defaultChecked={story?.consentObtained}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-1"
          />
          <span className="text-body-sm">
            <strong>They agreed to appear.</strong>
            <span className="text-muted-foreground block">
              Consent recorded by staff counts — a signed form is not required.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="isAnonymised"
            defaultChecked={story?.isAnonymised}
            onChange={(event) => setAnonymised(event.target.checked)}
            className="mt-1"
          />
          <span className="text-body-sm">
            <strong>Anonymised.</strong>
            <span className="text-muted-foreground block">
              The name above is kept for your records and never shown publicly.
            </span>
          </span>
        </label>

        {consentMissing ? (
          <Alert variant="destructive" role="status">
            As it stands this story cannot be published: it names somebody, and neither consent nor
            anonymisation is recorded. You can still save it as a draft.
          </Alert>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">Location & photograph</h2>
        <Field label="Location" name="location" errors={state.fieldErrors}>
          <Input id="location" name="location" defaultValue={story?.location ?? ''} />
        </Field>

        <CoverImagePicker
          name="coverImage"
          label="Upload image"
          hint="Photograph displayed on the story page and promotional cards. Choose from the library or upload directly from your device."
          value={story?.coverImage}
          options={mediaOptions}
          error={state.fieldErrors?.coverImage}
          activeBadge="Selected cover image"
        />
      </section>

      <SubmitButton pending={pending}>{story ? 'Save changes' : 'Create draft'}</SubmitButton>
    </form>
  );
}

function BlockerNotice({ blockers, status }: { blockers: PublishBlocker[]; status: string }) {
  return (
    <Alert variant="destructive" role="status">
      <strong>
        {status === 'published' ? 'This story has a problem.' : 'Not ready to publish.'}
      </strong>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {blockers.map((blocker) => (
          <li key={blocker.field}>{blocker.message}</li>
        ))}
      </ul>
    </Alert>
  );
}

/**
 * Publish, unpublish and archive.
 *
 * Separate from the editor because it is a separate decision with a separate
 * permission, and because publishing is `@Sensitive()` — it asks for a
 * password again, and burying that inside a save button would be surprising.
 */
/**
 * `canArchive` (Phase 13): archiving, and bringing a story back out of the
 * archive, need `story.archive`; the API enforces it, and the buttons are not
 * offered to somebody who would only be refused.
 */
export function StoryStatusControls({
  story,
  canArchive,
}: {
  story: AdminStory;
  canArchive: boolean;
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(setStoryStatus, {});
  const [target, setTarget] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) {
      setTarget(null);
      router.refresh();
    }
  }, [state.ok, router]);

  const blocked = story.publishBlockers.length > 0;

  if (!target) {
    return (
      <div className="space-y-3">
        <FormStatus state={state} success="Status updated" />
        <div className="flex flex-wrap gap-2">
          {story.status === 'archived' && !canArchive ? (
            <p className="text-body-sm text-muted-foreground">
              Deleted. Restoring it needs the story.archive permission.
            </p>
          ) : story.status !== 'published' ? (
            <Button type="button" onClick={() => setTarget('published')} disabled={blocked}>
              Publish
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setTarget('draft')}>
              Unpublish
            </Button>
          )}
          {!canArchive ? null : story.status !== 'archived' ? (
            <Button type="button" variant="destructive" onClick={() => setTarget('archived')}>
              Delete
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setTarget('draft')}>
              Restore to draft
            </Button>
          )}
        </div>
        {blocked ? (
          <p className="text-body-sm text-muted-foreground">
            Publishing is unavailable until the problems above are resolved.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="border-border space-y-4 rounded-lg border p-5">
      <input type="hidden" name="id" value={story.id} />
      <input type="hidden" name="slug" value={story.slug} />
      <input type="hidden" name="status" value={target} />
      <FormStatus state={state} success="Status updated" />

      <h3 className="text-h4 font-semibold">
        {target === 'published'
          ? 'Publish this story?'
          : target === 'archived'
            ? 'Delete this story?'
            : 'Take this story off the site?'}
      </h3>
      <p className="text-body-sm text-muted-foreground">
        {target === 'published'
          ? 'It becomes visible to everybody, under the organisation’s name.'
          : 'It disappears from the public site. Nothing is deleted, and the consent record is kept.'}
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
        <SubmitButton pending={pending} variant={target === 'archived' ? 'destructive' : undefined}>
          Confirm
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setTarget(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
