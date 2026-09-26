'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Button, Input, cn } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import {
  markAllNotificationsRead,
  markNotificationRead,
  previewTemplate,
  retryNotification,
  revertNotificationTemplate,
  updateNotificationTemplate,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminTemplate } from '@/lib/admin/api';

/**
 * The pieces of the notifications screens an administrator interacts with.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE PREVIEW IS RENDERED BY THE SERVER, WITH THE WORKER'S OWN RENDERER.
 *
 * It would be easy to interpolate `{{name}}` in the browser and call that a
 * preview. It would also, eventually, reassure somebody about an email that
 * goes out looking different — which is the one failure a preview exists to
 * prevent. So the draft is posted, rendered by the same function the worker
 * calls, and what comes back is what would be sent.
 *
 * The rendered HTML is shown INSIDE AN IFRAME with no scripts allowed, not
 * injected into this page. It is a body somebody is editing and may well have
 * broken; letting it into the admin DOM would let a mistake in an email
 * template become a mistake in the admin interface.
 * ══════════════════════════════════════════════════════════════════════════
 */

export function StatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <CheckCircle2 className="text-success size-4" aria-hidden="true" />;
  if (status === 'failed')
    return <XCircle className="text-destructive size-4" aria-hidden="true" />;
  if (status === 'read')
    return <CheckCircle2 className="text-muted-foreground size-4" aria-hidden="true" />;
  return <Clock className="text-muted-foreground size-4" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export function MarkReadButton({ id }: { id: string }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    markNotificationRead,
    {},
  );
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? 'Marking…' : 'Mark read'}
      </Button>
    </form>
  );
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
    >
      {pending ? 'Marking…' : 'Mark all read'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Send log
// ---------------------------------------------------------------------------

/**
 * Try a failed send again.
 *
 * `@Sensitive()` on the API: without a fresh re-authentication this comes back
 * as `REAUTH_REQUIRED` and the message says so. The button does not try to
 * predict that — the API is the thing that decides.
 */
export function RetryButton({ id, retryCount }: { id: string; retryCount: number }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    retryNotification,
    {},
  );
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? 'Queueing…' : 'Try again'}
        </Button>
      </form>
      {retryCount > 0 ? (
        <span className="text-caption text-muted-foreground">
          {retryCount} {retryCount === 1 ? 'attempt' : 'attempts'} so far
        </span>
      ) : null}
      {state.error ? (
        <span role="alert" className="text-caption text-destructive max-w-56">
          {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span role="status" className="text-caption text-success">
          Queued.
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template editor
// ---------------------------------------------------------------------------

export function TemplateEditor({ template }: { template: AdminTemplate }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    updateNotificationTemplate,
    {},
  );
  const router = useRouter();

  const [subject, setSubject] = React.useState(template.subject);
  const [bodyHtml, setBodyHtml] = React.useState(template.bodyHtml);
  const [bodyText, setBodyText] = React.useState(template.bodyText);

  const [preview, setPreview] = React.useState<{
    subject?: string;
    html?: string;
    text?: string;
    missing?: string[];
    error?: string;
  } | null>(null);
  const [previewing, startPreview] = React.useTransition();

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={template.id} />
        <FormStatus state={state} />

        <Field
          label="Subject"
          name="subject"
          required
          errors={state.fieldErrors}
          hint="Plain text. It is not HTML-escaped, so an ampersand stays an ampersand."
        >
          <Input
            id="subject"
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            maxLength={320}
          />
        </Field>

        <Field
          label="HTML body"
          name="bodyHtml"
          required
          errors={state.fieldErrors}
          hint="Variables are written {{likeThis}} and are escaped when substituted."
        >
          {/*
            UNCONTROLLED, with `onChange` only listening. The preview needs the
            current draft, but taking ownership of every keystroke in a
            fourteen-row textarea buys nothing and costs a re-render per
            character.
          */}
          <TextArea
            name="bodyHtml"
            rows={14}
            defaultValue={template.bodyHtml}
            onChange={setBodyHtml}
            className="font-mono text-xs"
          />
        </Field>

        <Field label="Plain-text body" name="bodyText" required errors={state.fieldErrors}>
          <TextArea
            name="bodyText"
            rows={10}
            defaultValue={template.bodyText}
            onChange={setBodyText}
            className="font-mono text-xs"
          />
        </Field>

        <Field
          label="Note"
          name="note"
          errors={state.fieldErrors}
          hint="Why this changed. Kept with the version and on the audit log."
        >
          <Input id="note" name="note" maxLength={500} />
        </Field>

        <label className="text-body-sm flex items-center gap-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={template.isActive}
            className="size-4"
          />
          Active — when off, the built-in wording is used instead
        </label>

        <div className="flex gap-2">
          <SubmitButton pending={pending}>Save as version {template.version + 1}</SubmitButton>
          <Button
            type="button"
            variant="ghost"
            disabled={previewing}
            onClick={() =>
              startPreview(async () => {
                setPreview(await previewTemplate(template.id, { subject, bodyHtml, bodyText }));
              })
            }
          >
            {previewing ? 'Rendering…' : 'Preview'}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        <section className="border-border rounded-lg border p-5">
          <h2 className="text-h4 font-semibold">Variables the sender supplies</h2>
          <p className="text-body-sm text-muted-foreground mt-1">
            Anything else you write as <code>{'{{name}}'}</code> will render empty.
          </p>
          <dl className="mt-3 space-y-2">
            {Object.entries(template.expectedVariables).map(([name, description]) => (
              <div key={name} className="text-body-sm">
                <dt className="font-mono font-semibold">{`{{${name}}}`}</dt>
                <dd className="text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        {preview ? (
          <section className="border-border rounded-lg border p-5">
            <h2 className="text-h4 font-semibold">Preview</h2>
            {preview.error ? (
              <p role="alert" className="text-body-sm text-destructive mt-2">
                {preview.error}
              </p>
            ) : (
              <>
                <p className="text-body-sm mt-2">
                  <span className="text-muted-foreground">Subject:</span> {preview.subject}
                </p>
                {preview.missing && preview.missing.length > 0 ? (
                  <p
                    role="status"
                    className="border-warning/40 bg-warning/5 text-body-sm mt-3 flex gap-2 rounded-lg border p-3"
                  >
                    <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Nothing supplies {preview.missing.map((name) => `{{${name}}}`).join(', ')} —
                      it will render empty.
                    </span>
                  </p>
                ) : null}
                {/*
                  SANDBOXED, and with no `allow-scripts`. This is a body
                  somebody is editing and may have broken; letting it into the
                  admin DOM would make a mistake in an email a mistake in the
                  admin interface.
                */}
                <iframe
                  title="Rendered email"
                  sandbox=""
                  srcDoc={preview.html ?? ''}
                  className="border-border mt-3 h-80 w-full rounded-lg border bg-white"
                />
              </>
            )}
          </section>
        ) : null}

        <TemplateRevisions template={template} />
      </div>
    </div>
  );
}

function TemplateRevisions({ template }: { template: AdminTemplate }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    revertNotificationTemplate,
    {},
  );
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (template.revisions.length === 0) return null;

  return (
    <section className="border-border rounded-lg border p-5">
      <h2 className="text-h4 font-semibold">History</h2>
      <p className="text-body-sm text-muted-foreground mt-1">
        Going back writes a new version, so nothing is lost by doing it.
      </p>
      <FormStatus state={state} />
      <ul className="divide-border mt-3 divide-y">
        {template.revisions.map((revision) => (
          <li key={revision.version} className="flex items-center justify-between gap-3 py-2">
            <span className="text-body-sm">
              <span className="font-semibold">Version {revision.version}</span>
              {revision.note ? (
                <span className="text-muted-foreground"> — {revision.note}</span>
              ) : null}
            </span>
            <form action={action}>
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="version" value={revision.version} />
              <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                Restore
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ActivePill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'text-caption rounded-full px-2 py-0.5 font-semibold',
        isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
      )}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}
