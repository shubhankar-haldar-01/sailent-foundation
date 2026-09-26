import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusActions } from '@/components/admin/status-actions';
import { TeamForm } from '@/components/admin/team-form';
import { changeTeamStatus } from '@/lib/admin/actions';
import { adminFetch, AdminApiError, type AdminTeamMember } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';
import { PROGRAM_TRANSITIONS } from '@sailent/validation';

export const dynamic = 'force-dynamic';

/**
 * The three states a team member moves through are the same three a programme
 * moves through, with the same rules, so the same transition table drives both.
 * A second copy saying the same thing is a second copy to forget to update.
 */
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">{member.name}</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {member.designation}
            {member.isPublic ? (
              <>
                {' · '}
                <Link href={`/team/${member.slug}`} className="text-primary hover:underline">
                  View the public page
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <TeamForm member={member} />

        <aside className="border-border space-y-4 rounded-lg border p-4">
          <h2 className="text-body-sm font-semibold">Publication</h2>
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
              You do not have permission to change this.
            </p>
          )}

          {member.slugHistory?.length ? (
            <div className="border-border border-t pt-4">
              <h2 className="text-body-sm font-semibold">Previous addresses</h2>
              <ul className="text-caption text-muted-foreground mt-2 space-y-1">
                {member.slugHistory.map((entry) => (
                  <li key={entry.slug}>/team/{entry.slug} — redirects here</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
