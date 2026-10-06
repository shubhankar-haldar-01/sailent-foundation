import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  EditUserForm,
  GrantRoleForm,
  ResendInvitationForm,
  UserStatusControls,
} from '@/components/admin/user-admin';
import { AdminApiError, getUser, type AdminUser } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One staff account.
 *
 * Reading a user is `@Sensitive()`, so a 403 `REAUTH_REQUIRED` here is an
 * EXPECTED outcome rather than an error — it renders the re-auth panel in
 * place of the record, the same way the volunteer detail screen does.
 */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let user: AdminUser | null = null;
  let needsReauth = false;

  try {
    user = await getUser(id);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      needsReauth = true;
    } else if (error instanceof AdminApiError && error.status === 404) {
      notFound();
    } else {
      throw error;
    }
  }

  if (needsReauth || !user) {
    return (
      <ReauthPanel
        returnTo={`/admin/users/${id}`}
        what="A staff account controls who can administer this platform."
      />
    );
  }

  /*
    Nobody changes their own roles or status, whatever permissions they hold —
    the API refuses it, and the UI should not offer a button that will fail.
    Self-elevation and self-suspension defeat every other control here.
  */
  const isSelf = actor?.id === user.id;

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/users" className="hover:text-foreground">
          Staff accounts
        </Link>
        <span aria-hidden="true"> / </span>
        <span>
          {user.firstName} {user.lastName ?? ''}
        </span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">
            {user.firstName} {user.lastName ?? ''}
          </h1>
          <p className="text-body-sm text-muted-foreground mt-1">{user.email}</p>
        </div>
        <StatusPill status={user.status} />
      </header>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-h3 font-semibold">Details</h2>
          <dl className="border-border text-body-sm divide-border divide-y rounded-lg border">
            <Row label="Role">
              {user.roles.length > 0 ? (
                user.roles.map((role) => role.key).join(', ')
              ) : (
                <span className="text-warning">
                  No role — this account cannot administer anything
                </span>
              )}
            </Row>
            <Row label="Second factor">
              {/* Enrolment only. The secret is never returned by the API. */}
              {user.totpEnabled ? 'Enrolled' : 'Not enrolled'}
            </Row>
            <Row label="Last signed in">
              {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
            </Row>
            <Row label="Added">{formatDate(user.createdAt)}</Row>
            <Row label="Phone">{user.phone ?? '—'}</Row>
          </dl>

          {user.roles.length === 0 && can(actor, 'user.assign_role') && !isSelf ? (
            <div className="border-border rounded-lg border p-5">
              <h3 className="text-h4 mb-3 font-semibold">Grant the administrative role</h3>
              <GrantRoleForm user={user} />
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-h3 font-semibold">Edit</h2>
          {can(actor, 'user.update') ? (
            <EditUserForm user={user} />
          ) : (
            <p className="text-body-sm text-muted-foreground">
              You do not have permission to edit staff accounts.
            </p>
          )}
        </div>
      </section>

      {user.status === 'invited' && can(actor, 'user.invite') ? (
        <section className="space-y-3">
          <h2 className="text-h3 font-semibold">Invitation</h2>
          <ResendInvitationForm user={user} />
        </section>
      ) : null}

      {can(actor, 'user.suspend') ? (
        <section className="space-y-3">
          <h2 className="text-h3 font-semibold">Access</h2>
          {isSelf ? (
            <p className="text-body-sm text-muted-foreground border-border rounded-lg border border-dashed p-5">
              You cannot suspend your own account. Somebody locking themselves out is the one
              failure this control cannot recover from.
            </p>
          ) : (
            <UserStatusControls user={user} />
          )}
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
