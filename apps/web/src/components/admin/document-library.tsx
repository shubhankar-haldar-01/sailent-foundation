'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Lock, ShieldAlert } from 'lucide-react';

import { Button, Input, cn } from '@sailent/ui';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import {
  changeDocumentVisibility,
  getDocumentLink,
  updateDocument,
  uploadDocument,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminDocument } from '@/lib/admin/api';
import { DOCUMENT_TYPE_LABELS, VISIBILITY_LABELS, VISIBILITY_MEANING } from '@/lib/admin/documents';

/**
 * Reports & documents — the pieces an administrator touches.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE UI'S JOB HERE IS TO MAKE VISIBILITY IMPOSSIBLE TO CHANGE BY ACCIDENT.
 *
 * Everything else in this module is ordinary CRUD. The one action that can
 * disclose something gets its own form, its own confirmation, a required
 * reason, and a warning that names what will happen in words rather than
 * showing a state name. The API refuses it without a fresh re-authentication
 * regardless of what this component does — this is the part that stops
 * somebody meaning to do it.
 * ══════════════════════════════════════════════════════════════════════════
 */

const ACCEPTED = 'application/pdf,image/jpeg,image/png,image/webp';

export function VisibilityBadge({ visibility }: { visibility: string }) {
  const isPublic = visibility === 'public';
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold',
        isPublic ? 'bg-warning/15 text-warning-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      {isPublic ? (
        <ShieldAlert className="size-3" aria-hidden="true" />
      ) : (
        <Lock className="size-3" aria-hidden="true" />
      )}
      {VISIBILITY_LABELS[visibility] ?? visibility}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export function UploadPanel({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(uploadDocument, {});
  const [open, setOpen] = React.useState(false);
  const [visibility, setVisibility] = React.useState('private');
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
        Upload a document
      </Button>
    );
  }

  return (
    <form action={action} className="border-border w-full max-w-lg space-y-4 rounded-lg border p-5">
      <h2 className="text-h4 font-semibold">Upload a document</h2>
      <FormStatus state={state} />

      <Field
        label="File"
        name="file"
        required
        errors={state.fieldErrors}
        hint="PDF, or a JPEG, PNG or WebP scan, up to 25MB. The file is checked by its contents, not its name."
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

      <Field label="Title" name="title" required errors={state.fieldErrors}>
        <Input id="title" name="title" required maxLength={240} />
      </Field>

      <Field label="Description" name="description" errors={state.fieldErrors}>
        <Input id="description" name="description" maxLength={2000} />
      </Field>

      <Field label="Type" name="documentType" errors={state.fieldErrors}>
        <select
          id="documentType"
          name="documentType"
          defaultValue="other"
          className="border-input bg-surface text-body h-11 w-full rounded-lg border px-3"
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Financial year"
        name="financialYear"
        errors={state.fieldErrors}
        hint="As 2025-2026, if this belongs to one."
      >
        <Input id="financialYear" name="financialYear" placeholder="2025-2026" maxLength={9} />
      </Field>

      <Field
        label="Visibility"
        name="visibility"
        errors={state.fieldErrors}
        hint={VISIBILITY_MEANING[visibility]}
      >
        <select
          id="visibility"
          name="visibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          className="border-input bg-surface text-body h-11 w-full rounded-lg border px-3"
        >
          {/* Private is first AND the default: the closed state is the one you
              land on without making a choice. */}
          <option value="private">Private</option>
          <option value="admin_only">Admin only</option>
          <option value="public">Public</option>
        </select>
      </Field>

      <Field
        label="Attach to a campaign"
        name="relatedId"
        errors={state.fieldErrors}
        hint="A public document is only shown to visitors on the campaign it is attached to. Nothing else publishes documents."
      >
        <select
          id="relatedId"
          name="relatedId"
          defaultValue=""
          className="border-input bg-surface text-body h-11 w-full rounded-lg border px-3"
        >
          <option value="">Not attached</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.title}
            </option>
          ))}
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

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Fetch a link at the moment it is wanted.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE URL IS NOT IN THE PAGE. IT IS ASKED FOR ON CLICK.
 *
 * A signed URL lasts five minutes. Rendering one into the HTML means it is
 * already expiring while the page is being read, and it means every listing
 * mints a credential for every row whether or not anybody opens one — each of
 * which is an audit entry claiming an access that never happened.
 *
 * So the button asks, and only then opens what comes back.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function DownloadButton({ id, visibility }: { id: string; visibility: string }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const link = await getDocumentLink(id);
      if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer');
      else setError(link.error ?? 'Could not open that document. Try again.');
    } catch {
      setError('Could not open that document. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={open} disabled={busy}>
        <Download className="size-4" aria-hidden="true" />
        {busy ? 'Opening…' : 'Open'}
      </Button>
      {visibility !== 'public' ? (
        <span className="text-caption text-muted-foreground">Link expires in five minutes.</span>
      ) : null}
      {error ? (
        <span role="alert" className="text-caption text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export function DocumentDetailsForm({ document }: { document: AdminDocument }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(updateDocument, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={document.id} />
      <FormStatus state={state} />

      <Field label="Title" name="title" required errors={state.fieldErrors}>
        <Input id="title" name="title" defaultValue={document.title} required maxLength={240} />
      </Field>

      <Field label="Description" name="description" errors={state.fieldErrors}>
        <Input
          id="description"
          name="description"
          defaultValue={document.description ?? ''}
          maxLength={2000}
        />
      </Field>

      <Field label="Type" name="documentType" errors={state.fieldErrors}>
        <select
          id="documentType"
          name="documentType"
          defaultValue={document.documentType}
          className="border-input bg-surface text-body h-11 w-full rounded-lg border px-3"
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Financial year" name="financialYear" errors={state.fieldErrors}>
        <Input
          id="financialYear"
          name="financialYear"
          defaultValue={document.financialYear ?? ''}
          placeholder="2025-2026"
          maxLength={9}
        />
      </Field>

      <SubmitButton pending={pending}>Save changes</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Visibility — the sensitive one
// ---------------------------------------------------------------------------

/**
 * Change a document's visibility.
 *
 * Two steps, and the second one says what will happen in plain words. The
 * first version of this was a `<select>` that submitted on change, which is
 * exactly the shape of the accident §4.20 is written to prevent.
 */
export function VisibilityControls({ document }: { document: AdminDocument }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    changeDocumentVisibility,
    {},
  );
  const [target, setTarget] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) {
      setTarget(null);
      router.refresh();
    }
  }, [state.ok, router]);

  const options = Object.keys(VISIBILITY_LABELS).filter((key) => key !== document.visibility);

  return (
    <div className="border-border space-y-4 rounded-lg border p-5">
      <div>
        <h2 className="text-h4 font-semibold">Visibility</h2>
        <p className="text-body-sm text-muted-foreground mt-1">
          Currently <VisibilityBadge visibility={document.visibility} />.{' '}
          {VISIBILITY_MEANING[document.visibility]}
        </p>
      </div>

      <FormStatus state={state} />

      {target === null ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button key={option} type="button" variant="ghost" onClick={() => setTarget(option)}>
              Make {VISIBILITY_LABELS[option]?.toLowerCase()}
            </Button>
          ))}
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={document.id} />
          <input type="hidden" name="visibility" value={target} />

          <div
            className={cn(
              'rounded-lg border p-4',
              target === 'public' ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/40',
            )}
          >
            <p className="text-body-sm font-semibold">
              {target === 'public'
                ? 'This will publish the file to the public bucket.'
                : 'This will move the file to the private bucket.'}
            </p>
            <p className="text-body-sm text-muted-foreground mt-1">
              {target === 'public'
                ? 'Anyone with the link will be able to open it, and it will appear on the campaign it is attached to. Make sure it contains nothing internal.'
                : 'The existing public link will stop working. The file stays in the library and its history is kept.'}
            </p>
          </div>

          <Field
            label="Why is this changing?"
            name="reason"
            required
            errors={state.fieldErrors}
            hint="Recorded on the audit log beside who did it and when. At least ten characters."
          >
            <Input id="reason" name="reason" required minLength={10} maxLength={500} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton pending={pending}>Confirm</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function DocumentIcon({ mimeType }: { mimeType: string }) {
  return (
    <FileText
      className={cn('size-5 shrink-0', mimeType === 'application/pdf' ? 'text-primary' : '')}
      aria-hidden="true"
    />
  );
}
