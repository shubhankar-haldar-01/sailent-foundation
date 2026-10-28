'use client';

import * as React from 'react';

import { Button, ConfirmationDialog } from '@sailent/ui';

import { FormStatus } from '@/components/admin/form-shell';
import type { ActionState } from '@/lib/admin/actions';

/**
 * Lifecycle buttons.
 *
 * Which buttons appear is decided by the transition table the API also
 * enforces, fetched from it rather than duplicated here — so the UI cannot
 * offer a move the server will refuse, and adding a transition is one change
 * in one place.
 *
 * Transitions that need a reason ask for one BEFORE submitting, because the
 * alternative is a validation error explaining that a field the operator was
 * never shown is missing.
 */
export function StatusActions({
  entityId,
  slug,
  current,
  allowed,
  action,
  labels,
  reasonRequired = [],
  confirmRequired = [],
  deleteAction,
  canDelete = false,
}: {
  entityId: string;
  slug?: string;
  current: string;
  allowed: string[];
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  /** Maps a target status onto the endpoint segment and the button label. */
  labels: Record<string, { endpoint: string; label: string }>;
  reasonRequired?: string[];
  confirmRequired?: string[];
  deleteAction?: (prev: ActionState, form: FormData) => Promise<ActionState>;
  canDelete?: boolean;
}) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(action, {});
  const [deleteState, deleteFormAction, deletePending] = React.useActionState<
    ActionState,
    FormData
  >(deleteAction ?? (async () => ({ ok: false })), {});
  const [reasonFor, setReasonFor] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const options = allowed.filter((target) => labels[target]);

  const handleConfirmStatus = async () => {
    if (!confirmTarget) return;
    const formData = new FormData();
    formData.append('id', entityId);
    if (slug) formData.append('slug', slug);
    formData.append('action', labels[confirmTarget]!.endpoint);
    await formAction(formData);
    setConfirmTarget(null);
  };

  const handleConfirmDelete = async () => {
    const formData = new FormData();
    formData.append('id', entityId);
    if (slug) formData.append('slug', slug);
    await deleteFormAction(formData);
    setConfirmDeleteOpen(false);
  };

  return (
    <div className="space-y-3">
      <FormStatus state={state} />
      <FormStatus state={deleteState} />

      {reasonFor ? (
        <form
          action={formAction}
          className="border-border bg-surface-sunken space-y-3 rounded-lg border p-4"
        >
          <input type="hidden" name="id" value={entityId} />
          {slug ? <input type="hidden" name="slug" value={slug} /> : null}
          <input type="hidden" name="action" value={labels[reasonFor]!.endpoint} />

          <label htmlFor="reason" className="text-body-sm block font-medium">
            Why are you {labels[reasonFor]!.label.toLowerCase()}?
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            required
            minLength={3}
            autoFocus
            className="border-input bg-surface text-body-sm w-full rounded-md border px-3 py-2"
            placeholder="This is recorded in the audit log."
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Working…' : labels[reasonFor]!.label}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReasonFor(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              No further status changes are available from “{current}”.
            </p>
          ) : null}

          {options.map((target) => {
            const meta = labels[target]!;
            const needsReason = reasonRequired.includes(target);
            const needsConfirm = confirmRequired.includes(target);

            if (needsReason) {
              return (
                <Button
                  key={target}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setReasonFor(target)}
                >
                  {meta.label}
                </Button>
              );
            }

            if (needsConfirm) {
              return (
                <Button
                  key={target}
                  type="button"
                  size="sm"
                  variant={target === 'archived' ? 'secondary' : 'primary'}
                  disabled={pending}
                  onClick={() => setConfirmTarget(target)}
                >
                  {meta.label}
                </Button>
              );
            }

            return (
              <form key={target} action={formAction}>
                <input type="hidden" name="id" value={entityId} />
                {slug ? <input type="hidden" name="slug" value={slug} /> : null}
                <input type="hidden" name="action" value={meta.endpoint} />
                <Button
                  type="submit"
                  size="sm"
                  variant={target === 'archived' ? 'secondary' : 'primary'}
                  disabled={pending}
                >
                  {meta.label}
                </Button>
              </form>
            );
          })}

          {canDelete && deleteAction ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={deletePending || pending}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              {deletePending ? 'Deleting…' : 'Delete campaign'}
            </Button>
          ) : null}
        </div>
      )}

      {/* Branded confirmation dialog for status transitions (e.g. archiving) */}
      <ConfirmationDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget ? `${labels[confirmTarget]?.label}?` : ''}
        description="This can be undone, but the page and record will be removed from public view immediately."
        confirmLabel={confirmTarget ? labels[confirmTarget]?.label : 'Confirm'}
        variant={confirmTarget === 'archived' ? 'secondary' : 'primary'}
        icon="warning"
        loading={pending}
        onConfirm={handleConfirmStatus}
        error={state.error}
      />

      {/* Branded confirmation dialog for deletion */}
      <ConfirmationDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this campaign permanently?"
        description="This campaign and its configuration will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete campaign"
        variant="destructive"
        icon="danger"
        loading={deletePending}
        onConfirm={handleConfirmDelete}
        error={deleteState.error}
      />
    </div>
  );
}
