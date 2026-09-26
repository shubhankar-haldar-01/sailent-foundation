'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { deleteMedia, updateMedia, uploadMedia, type ActionState } from '@/lib/admin/actions';
import type { AdminMedia, AdminMediaDetail } from '@/lib/admin/api';

/**
 * The media library.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ALT TEXT IS REQUIRED AT UPLOAD, NOT LATER.
 *
 * The column is NOT NULL in the database, and that is the right place for it
 * to be enforced — but the reason it is asked for HERE, before the file is
 * even sent, is that the moment somebody chooses an image is the only moment
 * they reliably know what it shows. "Add descriptions later" is the state
 * every media library ends up in permanently.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Not a DAM. No folders, no tags, no bulk operations, no editing.
 */
const ACCEPTED = 'image/jpeg,image/png,image/webp';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel() {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(uploadMedia, {});
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Upload an image
      </Button>
    );
  }

  return (
    <form action={action} className="border-border w-full max-w-lg space-y-4 rounded-lg border p-5">
      <h2 className="text-h4 font-semibold">Upload an image</h2>
      <FormStatus state={state} />

      <Field
        label="Image"
        name="file"
        required
        errors={state.fieldErrors}
        hint="JPEG, PNG or WebP, up to 10MB. The file is checked by its contents, not its name."
      >
        <input
          id="file"
          name="file"
          type="file"
          accept={ACCEPTED}
          required
          className="text-body-sm file:bg-muted file:text-foreground w-full file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2"
        />
      </Field>

      <Field
        label="Alt text"
        name="altText"
        required
        errors={state.fieldErrors}
        hint="What the image shows, for somebody who cannot see it. Required."
      >
        <Input id="altText" name="altText" required maxLength={300} />
      </Field>

      <Field label="Caption" name="caption" errors={state.fieldErrors}>
        <Input id="caption" name="caption" maxLength={500} />
      </Field>

      <Field
        label="Visibility"
        name="visibility"
        errors={state.fieldErrors}
        hint="Public images are served from a permanent URL. Private ones are only reachable through a link that expires."
      >
        <select
          id="visibility"
          name="visibility"
          defaultValue="public"
          className="border-input bg-surface text-body h-11 w-full rounded-lg border px-3"
        >
          <option value="public">Public — usable on the website</option>
          <option value="private">Private — admin only</option>
        </select>
      </Field>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>{pending ? 'Uploading…' : 'Upload'}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** A single tile. Uses the public URL, or the expiring signed one for private. */
export function MediaTile({ item }: { item: AdminMedia }) {
  const src = item.url ?? item.signedUrl ?? null;

  return (
    <li className="border-border overflow-hidden rounded-lg border">
      <div className="bg-surface-sunken relative aspect-[4/3]">
        {src ? (
          // Not `next/image`: the host is configured at runtime and an
          // unconfigured storage base would fail the build rather than the
          // request. These are admin thumbnails, not public page images.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.altText} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <p className="text-caption text-muted-foreground flex h-full items-center justify-center p-4 text-center">
            No preview — storage is not configured
          </p>
        )}
      </div>

      <div className="space-y-1 p-3">
        <p className="text-body-sm truncate font-medium" title={item.altText}>
          {item.altText}
        </p>
        <p className="text-caption text-muted-foreground">
          {item.mimeType.replace('image/', '').toUpperCase()} · {formatBytes(item.sizeBytes)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
        </p>
        <p className="text-caption">
          <span
            className={
              item.visibility === 'private' ? 'text-warning font-medium' : 'text-muted-foreground'
            }
          >
            {item.visibility === 'private' ? 'Private' : 'Public'}
          </span>
        </p>
      </div>
    </li>
  );
}

/** Edit metadata, and delete when nothing references it. */
export function MediaDetailPanel({ item }: { item: AdminMediaDetail }) {
  const [editState, editAction, editPending] = React.useActionState<ActionState, FormData>(
    updateMedia,
    {},
  );
  const [deleteState, deleteAction, deletePending] = React.useActionState<ActionState, FormData>(
    deleteMedia,
    {},
  );
  const [confirming, setConfirming] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (editState.ok) router.refresh();
  }, [editState.ok, router]);

  React.useEffect(() => {
    if (deleteState.redirectTo) router.push(deleteState.redirectTo);
  }, [deleteState.redirectTo, router]);

  const inUse = item.references.length > 0;

  return (
    <div className="space-y-8">
      <form action={editAction} className="max-w-lg space-y-4">
        <input type="hidden" name="id" value={item.id} />
        <FormStatus state={editState} />

        <Field label="Alt text" name="altText" required errors={editState.fieldErrors}>
          <Input id="altText" name="altText" defaultValue={item.altText} required maxLength={300} />
        </Field>

        <Field label="Caption" name="caption" errors={editState.fieldErrors}>
          <Input id="caption" name="caption" defaultValue={item.caption ?? ''} maxLength={500} />
        </Field>

        <Field
          label="Visibility"
          name="visibility"
          errors={editState.fieldErrors}
          hint="Changing this MOVES the file between storage buckets, so a private image stops being reachable from its old address."
        >
          <select
            id="visibility"
            name="visibility"
            defaultValue={item.visibility}
            className="border-input bg-surface text-body h-11 w-full rounded-lg border px-3"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </Field>

        <SubmitButton pending={editPending}>Save changes</SubmitButton>
      </form>

      <section className="space-y-3">
        <h2 className="text-h3 font-semibold">Delete</h2>
        <FormStatus state={deleteState} />

        {inUse ? (
          /*
            Said before the button is pressed. `campaign_gallery.media_id` is
            ON DELETE CASCADE, so the database would happily delete this and
            silently empty a gallery — the refusal lives in the API, and this
            explains it rather than letting somebody meet it as an error.
          */
          <Alert variant="destructive" role="status">
            <strong>This image is in use and cannot be deleted.</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {item.references.map((reference) => (
                <li key={reference.kind}>
                  {reference.count} {reference.kind}
                </li>
              ))}
            </ul>
            Remove it from those first.
          </Alert>
        ) : confirming ? (
          <form action={deleteAction} className="border-border space-y-4 rounded-lg border p-5">
            <input type="hidden" name="id" value={item.id} />
            <h3 className="text-h4 font-semibold">Delete this image?</h3>
            <p className="text-body-sm text-muted-foreground">
              The file is removed from storage as well. There is no archived copy and this cannot be
              undone.
            </p>
            <div className="flex gap-2">
              <SubmitButton pending={deletePending}>Delete permanently</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
            Delete this image
          </Button>
        )}
      </section>
    </div>
  );
}
