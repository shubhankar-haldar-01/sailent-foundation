'use client';

import * as React from 'react';

import { Alert, Badge, Button, Input, Label } from '@sailent/ui';

import { FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { decideVolunteer, type ActionState } from '@/lib/admin/actions';

/**
 * The decision.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A REJECTION REQUIRES A REASON, AND THE FORM SAYS WHO WILL SEE IT.
 *
 * The API refuses a rejection with no reason, so the field is required here
 * too — but the sentence under it is the part that matters. A reviewer who
 * believes the applicant will read their note writes something diplomatic and
 * useless; one who knows it is internal writes what actually happened, which
 * is what makes the record worth keeping when the same person applies again.
 *
 * APPROVAL IS SEPARATED FROM ACTIVATION by the transition table, not by this
 * form: approving allocates the permanent VOL- number, and activating is the
 * later act that follows induction. Both buttons appear when both are legal.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function VolunteerReview({
  volunteerId,
  status,
  allowed,
}: {
  volunteerId: string;
  status: string;
  /** From `GET /admin/volunteers/transitions` — the server's own table. */
  allowed: string[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(decideVolunteer, {});
  const [target, setTarget] = React.useState<string | null>(null);

  const LABELS: Record<string, string> = {
    under_review: 'Mark under review',
    approved: 'Approve',
    active: 'Activate',
    inactive: 'Make inactive',
    suspended: 'Suspend',
    rejected: 'Reject',
    archived: 'Archive',
  };

  // A reason is required for these, and merely useful for the rest.
  const needsReason = new Set(['rejected', 'suspended', 'archived']);
  const options = allowed.filter((value) => LABELS[value]);

  if (options.length === 0) {
    return (
      <p className="text-caption text-muted-foreground">
        {status === 'rejected'
          ? 'This application was rejected. A new application would be a new record.'
          : 'There is nothing further to do with this record.'}
      </p>
    );
  }

  if (!target) {
    return (
      <div className="space-y-3">
        <FormStatus state={state} />
        <div className="flex flex-wrap gap-2">
          {options.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={value === 'rejected' || value === 'suspended' ? 'destructive' : 'secondary'}
              onClick={() => setTarget(value)}
            >
              {LABELS[value]}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={volunteerId} />
      <input type="hidden" name="action" value={target} />
      <FormStatus state={state} />

      <p className="text-body-sm font-medium">{LABELS[target]}?</p>

      {target === 'approved' ? (
        <Alert variant="info">
          This allocates a permanent volunteer number. It is never reused and never changes.
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="reason">
          Reason
          {needsReason.has(target) ? (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
        <Input
          id="reason"
          name="reason"
          required={needsReason.has(target)}
          autoFocus
          placeholder={target === 'rejected' ? 'Why this application was declined' : 'Optional'}
        />
        <p className="text-caption text-muted-foreground">
          {/* The sentence this whole component exists for. */}
          <strong>Internal only.</strong> The applicant is told the outcome and never this.
        </p>
      </div>

      {target === 'rejected' ? (
        <div className="space-y-1.5">
          <Label htmlFor="coolingPeriodDays">Cannot re-apply for (days)</Label>
          <Input
            id="coolingPeriodDays"
            name="coolingPeriodDays"
            type="number"
            min={0}
            max={3650}
            className="max-w-32"
            placeholder="0"
          />
          <p className="text-caption text-muted-foreground">
            Leave blank to let them apply again whenever they like.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending}>Confirm</SubmitButton>
        <Button type="button" variant="secondary" size="sm" onClick={() => setTarget(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The status chip, shared by the detail header and the list. */
export function VolunteerStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'active' || status === 'approved'
      ? 'success'
      : status === 'suspended' || status === 'rejected'
        ? 'destructive'
        : status === 'applied' || status === 'under_review'
          ? 'warning'
          : 'neutral';
  return <Badge variant={tone}>{status.replace('_', ' ')}</Badge>;
}

/** Issue a certificate for a period of verified work. */
export function IssueCertificate({
  volunteerId,
  verifiedHours,
  action,
}: {
  volunteerId: string;
  verifiedHours: number;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(action, {});
  const [open, setOpen] = React.useState(false);

  if (verifiedHours < 1) {
    return (
      <p className="text-caption text-muted-foreground">
        {/* The API refuses this too. Saying so here saves a round trip and a
            confusing error on a screen where the operator can see the zero. */}
        No verified hours yet, so there is nothing to certify. Verify some attendance first.
      </p>
    );
  }

  if (!open) {
    return (
      <>
        <FormStatus state={state} />
        <Button size="sm" onClick={() => setOpen(true)}>
          Issue a certificate
        </Button>
      </>
    );
  }

  const year = new Date().getFullYear();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={volunteerId} />
      <FormStatus state={state} />

      <p className="text-caption text-muted-foreground">
        The hours are counted from VERIFIED attendance inside the period and frozen on the
        certificate. Anything unverified is left out.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="periodStart">From</Label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={`${year}-01-01`}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodEnd">To</Label>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending}>Issue</SubmitButton>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
