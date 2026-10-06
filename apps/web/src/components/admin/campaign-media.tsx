'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button, Input, Label, Textarea } from '@sailent/ui';

import { FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { MediaPicker } from '@/components/admin/media-picker';
import { StatusPill } from '@/components/admin/status-pill';
import {
  addGalleryImage,
  createCampaignUpdate,
  removeGalleryImage,
  reorderGallery,
  setCampaignUpdateStatus,
  setCoverImage,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminCampaignUpdate, AdminGalleryItem, AdminMedia } from '@/lib/admin/api';

/**
 * Campaign and programme media (Phase 13): cover, gallery, progress updates.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE UPLOADS. Images come from the media library, which sniffs the
 * type from the bytes and removes EXIF/GPS on upload; the API refuses a cover
 * or a gallery image that is not a library image. Uploading stays on
 * /admin/media, the one path to storage.
 *
 * The public Campaign Gallery on the campaign page (approved, AGENTS.md §11
 * item 9) shows the PUBLIC items below, in this order.
 * ══════════════════════════════════════════════════════════════════════════
 */

function useRefresh(state: ActionState) {
  const router = useRouter();
  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
}

// ── cover ────────────────────────────────────────────────────────────────

export function CoverImagePanel({
  kind,
  id,
  slug,
  current,
  options,
}: {
  kind: 'campaign' | 'program';
  id: string;
  slug: string;
  current: string | null;
  options: AdminMedia[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(setCoverImage, {});
  useRefresh(state);
  const initial = options.find((item) => item.url === current) ?? null;
  const [selected, setSelected] = React.useState<AdminMedia | null>(initial);
  const changed = (selected?.url ?? null) !== current;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="coverImage" value={selected?.url ?? ''} />
      <FormStatus state={state} />
      {current && !initial ? (
        <p className="text-body-sm text-muted-foreground">
          The current cover is not one of the images listed below. Choosing one replaces it; “Save
          cover” with nothing chosen removes it.
        </p>
      ) : null}
      <MediaPicker
        options={options}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        label="Cover image"
      />
      <p className="text-caption text-muted-foreground">
        With no cover, the public page shows its placeholder illustration.
      </p>
      {changed ? <SubmitButton pending={pending}>Save cover</SubmitButton> : null}
    </form>
  );
}

// ── gallery ──────────────────────────────────────────────────────────────

export function GalleryPanel({
  campaignId,
  slug,
  items,
  options,
}: {
  campaignId: string;
  slug: string;
  items: AdminGalleryItem[];
  options: AdminMedia[];
}) {
  const [addState, addAction, addPending] = React.useActionState<ActionState, FormData>(
    addGalleryImage,
    {},
  );
  const [orderState, orderAction, orderPending] = React.useActionState<ActionState, FormData>(
    reorderGallery,
    {},
  );
  const [removeState, removeAction, removePending] = React.useActionState<ActionState, FormData>(
    removeGalleryImage,
    {},
  );
  useRefresh(addState);
  useRefresh(orderState);
  useRefresh(removeState);

  const [choice, setChoice] = React.useState<AdminMedia | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);
  const inGallery = new Set(items.map((item) => item.mediaId));
  const available = options.filter((item) => !inGallery.has(item.id));

  /** The full order with one item moved one place. */
  const moved = (index: number, delta: -1 | 1) => {
    const ids = items.map((item) => item.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    return ids.join(',');
  };

  return (
    <div className="space-y-5">
      <FormStatus state={orderState} />
      <FormStatus state={removeState} />

      {items.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-6">
          No gallery images yet. The gallery section is hidden on the public page until there is at
          least one public image.
        </p>
      ) : (
        <ol className="border-border divide-border divide-y rounded-lg border">
          {items.map((item, index) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt=""
                  className="border-border h-14 w-20 shrink-0 rounded border object-cover"
                />
              ) : (
                <span className="bg-muted text-caption text-muted-foreground grid h-14 w-20 shrink-0 place-items-center rounded">
                  {item.visibility === 'private' ? 'Private' : 'No file'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-body-sm truncate font-medium">{item.altText}</p>
                <p className="text-caption text-muted-foreground">
                  {index + 1}.{' '}
                  {item.visibility === 'public' ? 'Shown publicly' : 'Private — staff only'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(
                  [
                    [-1, ArrowUp, 'Move up'],
                    [1, ArrowDown, 'Move down'],
                  ] as const
                ).map(([delta, Icon, label]) => {
                  const disabled = index + delta < 0 || index + delta >= items.length;
                  return (
                    <form key={label} action={orderAction}>
                      <input type="hidden" name="campaignId" value={campaignId} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="ids" value={disabled ? '' : moved(index, delta)} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={disabled || orderPending}
                        aria-label={`${label}: ${item.altText}`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                  );
                })}
                {confirmRemove === item.id ? (
                  <form action={removeAction} className="flex items-center gap-1">
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <SubmitButton pending={removePending}>Remove</SubmitButton>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmRemove(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmRemove(item.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-caption text-muted-foreground">
        Removing takes the image out of this gallery only; it stays in the media library.
      </p>

      <form action={addAction} className="border-border space-y-3 rounded-lg border p-4">
        <h3 className="text-body font-semibold">Add an image</h3>
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="mediaId" value={choice?.id ?? ''} />
        <FormStatus state={addState} />
        <MediaPicker
          options={available}
          selectedId={choice?.id ?? null}
          onSelect={setChoice}
          label="Choose from the media library"
        />
        <div className="space-y-1.5">
          <Label htmlFor="gallery-visibility">Who can see it</Label>
          <select
            id="gallery-visibility"
            name="visibility"
            defaultValue="public"
            className="border-input bg-surface text-body h-11 w-full max-w-xs rounded-lg border px-3"
          >
            <option value="public">Everyone — shown on the campaign page</option>
            <option value="private">Staff only</option>
          </select>
        </div>
        <SubmitButton pending={addPending}>Add to gallery</SubmitButton>
      </form>
    </div>
  );
}

// ── progress updates ─────────────────────────────────────────────────────

export function CampaignUpdatesPanel({
  campaignId,
  slug,
  updates,
  canCreate,
  canPublish,
}: {
  campaignId: string;
  slug: string;
  updates: AdminCampaignUpdate[];
  canCreate: boolean;
  canPublish: boolean;
}) {
  const [createState, createAction, createPending] = React.useActionState<ActionState, FormData>(
    createCampaignUpdate,
    {},
  );
  const [statusState, statusAction, statusPending] = React.useActionState<ActionState, FormData>(
    setCampaignUpdateStatus,
    {},
  );
  useRefresh(createState);
  useRefresh(statusState);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (createState.ok) setOpen(false);
  }, [createState]);

  const statusButton = (update: AdminCampaignUpdate, status: string, label: string) => (
    <form action={statusAction}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="updateId" value={update.id} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status} />
      <Button
        type="submit"
        variant={status === 'archived' ? 'ghost' : 'secondary'}
        size="sm"
        disabled={statusPending}
      >
        {label}
      </Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <FormStatus state={statusState} />
      {updates.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-6">
          No progress updates yet.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {updates.map((update) => (
            <li key={update.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-sm font-semibold">
                  {update.title}{' '}
                  <span className="text-muted-foreground font-normal">· {update.impactDate}</span>
                </p>
                <StatusPill status={update.status} />
              </div>
              <p className="text-body-sm text-muted-foreground line-clamp-2">
                {update.description}
              </p>
              {canPublish ? (
                <div className="flex flex-wrap gap-2">
                  {update.status !== 'published'
                    ? statusButton(update, 'published', 'Publish')
                    : null}
                  {update.status === 'published'
                    ? statusButton(update, 'draft', 'Unpublish')
                    : null}
                  {update.status !== 'archived'
                    ? statusButton(update, 'archived', 'Archive')
                    : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">
        Published updates appear with the campaign’s impact records under /impact. Updates are
        records: they are archived rather than deleted.
      </p>

      {canCreate ? (
        open ? (
          <form action={createAction} className="border-border space-y-3 rounded-lg border p-4">
            <h3 className="text-body font-semibold">New progress update (saved as a draft)</h3>
            <input type="hidden" name="campaignId" value={campaignId} />
            <FormStatus state={createState} />
            <div className="space-y-1.5">
              <Label htmlFor="update-title">Title</Label>
              <Input id="update-title" name="title" required maxLength={240} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="update-date">Date it happened</Label>
              <Input id="update-date" name="impactDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="update-description">What happened</Label>
              <Textarea id="update-description" name="description" rows={4} required />
            </div>
            <div className="flex gap-2">
              <SubmitButton pending={createPending}>Save draft</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            Add a progress update
          </Button>
        )
      ) : null}
    </div>
  );
}
