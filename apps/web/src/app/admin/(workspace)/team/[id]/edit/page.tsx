import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { StatusActions } from '@/components/admin/status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { TeamForm } from '@/components/admin/team-form';
import { changeTeamStatus } from '@/lib/admin/actions';
import { adminFetch, AdminApiError, type AdminTeamMember } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';
import { PROGRAM_TRANSITIONS } from '@sailent/validation';

export const dynamic = 'force-dynamic';

const LABELS = {
  published: { endpoint: 'published', label: 'Publish' },
  draft: { endpoint: 'draft', label: 'Unpublish' },
  archived: { endpoint: 'archived', label: 'Archive' },
} as const;

export default async function EditTeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        breadcrumb={
          <Link
            href="/admin/team"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to team
          </Link>
        }
        description={`${member.designation}${member.department ? ` · ${member.department}` : ''}`}
        status={<StatusPill status={member.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Left: Form */}
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-base font-semibold">Team Member Profile</CardTitle>
            <p className="text-caption text-muted-foreground mt-1">
              Update name, designation, or biography.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <TeamForm member={member} />
          </CardContent>
        </Card>

        {/* Right: Publication controls */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <CardTitle className="text-base font-semibold">Publication Lifecycle</CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                {member.status === 'published'
                  ? 'Currently visible on the public About page directory.'
                  : 'Draft state. Hidden from public website view.'}
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {can(actor, 'team.manage') ? (
                <StatusActions
                  entityId={member.id}
                  slug={member.slug}
                  current={member.status}
                  allowed={PROGRAM_TRANSITIONS[member.status] ?? []}
                  action={changeTeamStatus}
                  labels={LABELS}
                  reasonRequired={['archived']}
                  confirmRequired={['archived']}
                />
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
