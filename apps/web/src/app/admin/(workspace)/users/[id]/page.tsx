import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  PageHeader,
  Badge,
  formatDate,
} from '@sailent/ui';
import { Shield, Key, ArrowLeft } from 'lucide-react';

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
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
            Back to staff accounts
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${user.firstName} ${user.lastName ?? ''}`}
        description={user.email}
        status={<StatusPill status={user.status} />}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="text-primary h-4 w-4" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-border divide-y text-sm">
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="text-foreground font-medium">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <Badge key={role.key} variant="accent">
                          {role.key}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="warning">No role assigned</Badge>
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-muted-foreground">Second factor</dt>
                  <dd className="text-foreground font-medium">
                    {user.totpEnabled ? (
                      <span className="text-success inline-flex items-center gap-1.5 text-xs font-medium">
                        <Key className="h-3.5 w-3.5" /> Enrolled
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not enrolled</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-muted-foreground">Last signed in</dt>
                  <dd className="text-foreground font-medium">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-muted-foreground">Added on</dt>
                  <dd className="text-foreground font-medium">{formatDate(user.createdAt)}</dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-muted-foreground">Phone number</dt>
                  <dd className="text-foreground font-medium">{user.phone ?? '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {user.roles.length === 0 && can(actor, 'user.assign_role') && !isSelf ? (
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-warning text-base">Grant Administrative Role</CardTitle>
                <CardDescription>
                  This account currently has no active permissions and cannot manage any modules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GrantRoleForm user={user} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit Account</CardTitle>
              <CardDescription>Update name, email, or contact phone details.</CardDescription>
            </CardHeader>
            <CardContent>
              {can(actor, 'user.update') ? (
                <EditUserForm user={user} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  You do not have permission to edit staff accounts.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {user.status === 'invited' && can(actor, 'user.invite') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitation Management</CardTitle>
            <CardDescription>
              This user has been invited but has not yet accepted and activated their account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResendInvitationForm user={user} />
          </CardContent>
        </Card>
      ) : null}

      {can(actor, 'user.suspend') ? (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-base">Access & Account Status</CardTitle>
            <CardDescription>
              Suspend or reactivate staff access to the administration console.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSelf ? (
              <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-xs">
                You cannot suspend your own account. Somebody locking themselves out is the one
                failure this control cannot recover from.
              </p>
            ) : (
              <UserStatusControls user={user} />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
