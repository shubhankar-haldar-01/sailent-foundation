import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';

import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
import { StatusActions } from '@/components/admin/status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { DeleteTeamMemberButton } from '@/components/admin/delete-team-member';
import { IssueIdentityCardDialog } from '@/components/admin/identity-card-dialog';
import { TeamForm } from '@/components/admin/team-form';
import { changeTeamStatus } from '@/lib/admin/actions';
import { adminFetch, AdminApiError, type AdminTeamMember } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const LABELS = {
  published: { endpoint: 'published', label: 'Publish' },
  draft: { endpoint: 'draft', label: 'Unpublish' },
  archived: { endpoint: 'archived', label: 'Delete' },
} as const;

export default async function EditTeamMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const actor = await currentActor();

  let member: AdminTeamMember;
  try {
    member = await adminFetch<AdminTeamMember>(`admin/team/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.name}
        breadcrumb={<AdminBackButton href="/admin/team">Back to team</AdminBackButton>}
        description={`${member.designation}${member.department ? ` · ${member.department}` : ''}`}
        status={<StatusPill status={member.status} />}
        actions={
          <IssueIdentityCardDialog
            initialData={{
              id: member.id,
              name: member.name,
              designation: member.designation,
              department: member.department,
              email: member.emailPublic || member.linkedAccountEmail,
              phone: member.contactNumber,
              idNumber: member.aadharNumber || undefined,
              photoUrl: member.photoUrl,
              companyName: 'SAILENT FOUNDATION',
            }}
          />
        }
      />

      {created ? (
        <Alert variant="success" className="shadow-xs">
          <p className="text-success font-semibold">Team member profile created successfully!</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            The profile is saved in draft state. Review the details below or publish when ready.
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Left: Form */}
        <TeamForm member={member} initialSuccess={Boolean(created)} />

        {/* Right: Publication controls */}
        <div className="space-y-6">
          <Card className="border-border shadow-xs overflow-hidden">
            <CardHeader className="border-border bg-muted/20 border-b pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="border-border/80 bg-background text-foreground shadow-xs flex size-9 shrink-0 items-center justify-center rounded-lg border">
                    <Users className="text-primary size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Publication Lifecycle</CardTitle>
                    <p className="text-caption text-muted-foreground mt-1">
                      {member.status === 'published'
                        ? 'Currently visible on the public About page directory.'
                        : 'Draft state. Hidden from public website view.'}
                    </p>
                  </div>
                </div>
                <StatusPill status={member.status} />
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              {can(actor, 'team.manage') ? (
                <StatusActions
                  entityId={member.id}
                  slug={member.slug}
                  current={member.status}
                  allowed={
                    member.status === 'published'
                      ? ['draft']
                      : member.status === 'draft'
                        ? ['published']
                        : []
                  }
                  action={changeTeamStatus}
                  labels={LABELS}
                >
                  <DeleteTeamMemberButton
                    id={member.id}
                    name={member.name}
                    slug={member.slug}
                    variant="ghost"
                    className="h-8.5 border-destructive/30 bg-destructive/10 text-destructive shadow-xs hover:bg-destructive rounded-lg border px-3.5 text-xs font-semibold transition-colors hover:text-white"
                  />
                </StatusActions>
              ) : (
                <p className="text-caption text-muted-foreground">
                  You do not have permission to change publication state.
                </p>
              )}
            </CardContent>
          </Card>

          {member.slugHistory?.length ? (
            <Card className="border-border">
              <CardHeader className="border-border border-b pb-4">
                <CardTitle className="text-base font-semibold">Previous Addresses</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="text-caption text-muted-foreground space-y-1">
                  {member.slugHistory.map((entry) => (
                    <li key={entry.slug} className="font-mono text-xs">
                      /team/{entry.slug} — redirects here
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
