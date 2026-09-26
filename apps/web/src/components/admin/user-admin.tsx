'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import {
  assignUserRoles,
  inviteUser,
  reactivateUser,
  suspendUser,
  updateUser,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminUser } from '@/lib/admin/api';

/**
 * Staff administration forms.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS ONE ADMINISTRATIVE ROLE AND THIS SCREEN NEVER PRETENDS OTHERWISE.
 *
 * No role picker appears anywhere below. Phase 8 collapsed Finance, Campaign,
 * Volunteer and Content managers into SUPER_ADMIN; offering a dropdown with
 * one entry would imply a choice that does not exist, and offering one with
 * more would name roles the application deliberately retired.
 *
 * `roleKeys` is therefore fixed in the server action, not read from the form.
 * A stale page or a crafted request cannot ask for a role that no longer
 * exists — the API would refuse it, but the UI should not be the thing
 * suggesting it.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Every write here is `@Sensitive()`; the API answers REAUTH_REQUIRED itself. */
function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();
  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
}

export function InviteUserForm() {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(inviteUser, {});
  const [open, setOpen] = React.useState(false);
  useRefreshOnSuccess(state);

  React.useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} type="button">
        Invite a staff member
      </Button>
    );
  }

  return (
    <form action={action} className="border-border w-full max-w-lg space-y-4 rounded-lg border p-5">
      <h2 className="text-h4 font-semibold">Invite a staff member</h2>
      <FormStatus state={state} />

      {/*
        Said plainly rather than discovered afterwards. The invite creates an
        account with no usable password and there is no delivery or
        password-set flow yet, so somebody has to finish this out of band.
      */}
      <Alert>
        This creates the account in an <strong>invited</strong> state with no usable password. There
        is no invitation email yet — the account cannot sign in until its password is set with{' '}
        <code>db:create-admin</code>.
      </Alert>

      <Field label="Email" name="email" required errors={state.fieldErrors}>
        <Input id="email" name="email" type="email" autoComplete="off" required />
      </Field>
      <Field label="First name" name="firstName" required errors={state.fieldErrors} />
      <Field label="Last name" name="lastName" errors={state.fieldErrors} />
      <Field label="Phone" name="phone" errors={state.fieldErrors} />

      <p className="text-caption text-muted-foreground">
        They will be granted <strong>SUPER_ADMIN</strong>, the only administrative role.
      </p>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>Send invitation</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function EditUserForm({ user }: { user: AdminUser }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(updateUser, {});
  useRefreshOnSuccess(state);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={user.id} />
      <FormStatus state={state} />

      <Field label="First name" name="firstName" required errors={state.fieldErrors}>
        <Input id="firstName" name="firstName" defaultValue={user.firstName} required />
      </Field>
      <Field label="Last name" name="lastName" errors={state.fieldErrors}>
        <Input id="lastName" name="lastName" defaultValue={user.lastName ?? ''} />
      </Field>
      <Field label="Phone" name="phone" errors={state.fieldErrors}>
        <Input id="phone" name="phone" defaultValue={user.phone ?? ''} />
      </Field>

      {/*
        The email is shown, not edited. It is the identity every audit row is
        snapshotted against, and the API does not accept a change to it.
      */}
      <Field label="Email" name="email" hint="Cannot be changed here — it is the account identity.">
        <Input id="email" name="email" defaultValue={user.email} disabled readOnly />
      </Field>

      <SubmitButton pending={pending}>Save changes</SubmitButton>
    </form>
  );
}

/**
 * Suspend and reactivate, each behind a typed confirmation.
 *
 * Suspending revokes every session that account holds in the same transaction,
 * so it takes effect now rather than when a token expires. That is worth being
 * deliberate about, and a reason is required by the API — it goes on the audit
 * row, and "who did it" is not the same as "why".
 */
export function UserStatusControls({ user }: { user: AdminUser }) {
  const suspended = user.status === 'suspended' || user.status === 'inactive';
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    suspended ? reactivateUser : suspendUser,
    {},
  );
  const [confirming, setConfirming] = React.useState(false);
  useRefreshOnSuccess(state);

  React.useEffect(() => {
    if (state.ok) setConfirming(false);
  }, [state.ok]);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <FormStatus state={state} />
        <Button
          type="button"
          variant={suspended ? 'primary' : 'destructive'}
          onClick={() => setConfirming(true)}
        >
          {suspended ? 'Reactivate this account' : 'Suspend this account'}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="border-border space-y-4 rounded-lg border p-5">
      <input type="hidden" name="id" value={user.id} />
      <FormStatus state={state} />

      <h3 className="text-h4 font-semibold">
        {suspended ? 'Reactivate' : 'Suspend'} {user.email}?
      </h3>
      <p className="text-body-sm text-muted-foreground">
        {suspended
          ? 'They will be able to sign in again. They will need their password; this does not set one.'
          : 'They will be signed out everywhere immediately and will not be able to sign in. Nothing is deleted.'}
      </p>

      <Field
        label="Reason"
        name="reason"
        required
        errors={state.fieldErrors}
        hint="Recorded on the audit entry. At least three characters."
      >
        <Input id="reason" name="reason" required minLength={3} />
      </Field>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>
          {suspended ? 'Reactivate' : 'Suspend'} the account
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Restores the single role to an account that somehow holds none. */
export function GrantRoleForm({ user }: { user: AdminUser }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(assignUserRoles, {});
  useRefreshOnSuccess(state);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={user.id} />
      <FormStatus state={state} />
      <Field
        label="Reason"
        name="reason"
        errors={state.fieldErrors}
        hint="Optional. Goes on the audit entry."
      >
        <Input id="reason" name="reason" />
      </Field>
      <SubmitButton pending={pending}>Grant SUPER_ADMIN</SubmitButton>
    </form>
  );
}
