'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  EyeOff,
  Flame,
  Globe,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { Button, ConfirmationDialog, cn, Spinner } from '@sailent/ui';

import { FormStatus } from '@/components/admin/form-shell';
import type { ActionState } from '@/lib/admin/actions';

function getActionConfig(target: string) {
  switch (target) {
    case 'published':
      return {
        icon: Globe,
        className:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active border border-transparent shadow-xs',
      };
    case 'open':
      return {
        icon: Play,
        className:
          'bg-success text-success-foreground hover:bg-success active:bg-success border border-transparent shadow-xs',
      };
    case 'active':
      return {
        icon: Flame,
        className:
          'bg-success text-success-foreground hover:bg-success active:bg-success border border-transparent shadow-xs',
      };
    case 'draft':
      return {
        icon: EyeOff,
        className:
          'border border-border/90 bg-surface text-foreground hover:bg-muted active:bg-muted/80 shadow-xs',
      };
    case 'closed':
    case 'paused':
      return {
        icon: Pause,
        className:
          'border border-warning/30 bg-warning/10 text-warning-foreground hover:bg-warning/20 active:bg-warning/30 shadow-xs',
      };
    case 'completed':
      return {
        icon: CheckCircle2,
        className:
          'border border-info/30 bg-info/10 text-info hover:bg-info/20 active:bg-info/30 shadow-xs',
      };
    case 'cancelled':
      return {
        icon: Ban,
        className:
          'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/30 shadow-xs',
      };
    case 'archived':
    case 'delete':
      return {
        icon: Trash2,
        className:
          'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white active:bg-destructive/90 shadow-xs transition-colors',
      };
    default:
      return {
        icon: RotateCcw,
        className:
          'border border-border/90 bg-surface text-foreground hover:bg-muted active:bg-muted/80 shadow-xs',
      };
  }
}

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
  children,
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
  children?: React.ReactNode;
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
    <div className="w-full space-y-3">
      <FormStatus state={state} success="Status updated" />
      <FormStatus state={deleteState} success="Deleted" />

      {reasonFor ? (
        <form
          action={formAction}
          className="shadow-xs border-warning/30 bg-warning/5 space-y-3 rounded-xl border p-4"
        >
          <input type="hidden" name="id" value={entityId} />
          {slug ? <input type="hidden" name="slug" value={slug} /> : null}
          <input type="hidden" name="action" value={labels[reasonFor]!.endpoint} />

          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-warning-foreground mt-0.5 size-4 shrink-0" />
            <div className="flex-1 space-y-1">
              <label htmlFor="reason" className="text-foreground block text-xs font-semibold">
                {labels[reasonFor]!.label.toLowerCase() === 'delete'
                  ? 'Reason for deletion required'
                  : `Reason required to ${labels[reasonFor]!.label.toLowerCase()}`}
              </label>
              <p className="text-caption text-muted-foreground">
                This explanation is required and will be permanently recorded in the administrative
                audit log.
              </p>
            </div>
          </div>

          <textarea
            id="reason"
            name="reason"
            rows={2}
            required
            minLength={3}
            autoFocus
            className="border-input bg-surface text-body-sm focus-visible:outline-primary shadow-xs w-full rounded-lg border px-3 py-2 transition-colors"
            placeholder="Please enter a detailed explanation..."
          />
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              variant="ghost"
              className={cn(
                'h-8.5 gap-1.5 rounded-lg px-3.5 text-xs font-semibold',
                getActionConfig(reasonFor).className,
              )}
              disabled={pending}
            >
              {pending ? (
                <Spinner className="size-3.5" />
              ) : (
                React.createElement(getActionConfig(reasonFor).icon, { className: 'size-3.5' })
              )}
              <span>{pending ? 'Saving…' : `Confirm ${labels[reasonFor]!.label}`}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8.5 border-border bg-surface text-foreground hover:bg-muted rounded-lg border px-3.5 text-xs font-semibold"
              onClick={() => setReasonFor(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {options.length === 0 && !children ? (
            <div className="border-border/80 bg-muted/30 text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
              <CheckCircle2 className="text-success size-4 shrink-0" />
              <span>No further status transitions available from “{current}”.</span>
            </div>
          ) : null}

          {options.map((target) => {
            const meta = labels[target]!;
            const needsReason = reasonRequired.includes(target);
            const needsConfirm = confirmRequired.includes(target);
            const config = getActionConfig(target);
            const Icon = config.icon;

            if (needsReason) {
              return (
                <Button
                  key={target}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-8.5 gap-1.5 rounded-lg px-3.5 text-xs font-semibold',
                    config.className,
                  )}
                  onClick={() => setReasonFor(target)}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span>{meta.label}</span>
                </Button>
              );
            }

            if (needsConfirm) {
              return (
                <Button
                  key={target}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-8.5 gap-1.5 rounded-lg px-3.5 text-xs font-semibold',
                    config.className,
                  )}
                  disabled={pending}
                  onClick={() => setConfirmTarget(target)}
                >
                  {pending && confirmTarget === target ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <Icon className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{meta.label}</span>
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
                  variant="ghost"
                  className={cn(
                    'h-8.5 gap-1.5 rounded-lg px-3.5 text-xs font-semibold',
                    config.className,
                  )}
                  disabled={pending}
                >
                  {pending ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <Icon className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{meta.label}</span>
                </Button>
              </form>
            );
          })}

          {children}

          {canDelete && deleteAction ? (
            <Button
              type="button"
              variant="ghost"
              className="h-8.5 border-destructive/30 bg-destructive/10 text-destructive shadow-xs hover:bg-destructive rounded-lg border px-3.5 text-xs font-semibold transition-colors hover:text-white"
              disabled={deletePending || pending}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              {deletePending ? (
                <Spinner className="size-3.5" />
              ) : (
                <Trash2 className="size-3.5" aria-hidden="true" />
              )}
              <span>{deletePending ? 'Deleting…' : 'Delete campaign'}</span>
            </Button>
          ) : null}
        </div>
      )}

      {/* Branded confirmation dialog for status transitions (e.g. archiving) */}
      <ConfirmationDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={
          confirmTarget === 'archived'
            ? 'Delete this record?'
            : confirmTarget
              ? `${labels[confirmTarget]?.label}?`
              : ''
        }
        description={
          confirmTarget === 'archived'
            ? 'This record will be removed from all public listings.'
            : 'This can be undone, but the page and record will be removed from public view immediately.'
        }
        confirmLabel={
          confirmTarget === 'archived'
            ? 'Delete'
            : confirmTarget
              ? labels[confirmTarget]?.label
              : 'Confirm'
        }
        variant={confirmTarget === 'archived' ? 'destructive' : 'primary'}
        icon={confirmTarget === 'archived' ? 'danger' : 'warning'}
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
