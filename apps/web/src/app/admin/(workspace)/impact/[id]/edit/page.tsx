import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ImpactForm } from '@/components/admin/impact-form';
import { StatusActions } from '@/components/admin/status-actions';
import { changeImpactStatus } from '@/lib/admin/actions';
import {
  AdminApiError,
  adminFetch,
  type AdminCampaign,
  type AdminEvent,
  type AdminImpactRecord,
  type AdminProgram,
  type Paginated,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';
import { PROGRAM_TRANSITIONS } from '@sailent/validation';

export const dynamic = 'force-dynamic';

const LABELS = {
  published: { endpoint: 'published', label: 'Publish' },
  draft: { endpoint: 'draft', label: 'Unpublish' },
  archived: { endpoint: 'archived', label: 'Archive' },
} as const;

export default async function EditImpactRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await currentActor();

  let record: AdminImpactRecord;
  try {
    record = await adminFetch<AdminImpactRecord>(`admin/impact/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const [programs, campaigns, events] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', { query: { status: 'all', limit: 100 } }),
    adminFetch<Paginated<AdminCampaign>>('admin/campaigns', {
      query: { status: 'all', limit: 100 },
    }),
    adminFetch<Paginated<AdminEvent>>('admin/events', { query: { status: 'all', limit: 100 } }),
  ]);

  const claimsFigure = record.metricValue !== null;
  const blocked = claimsFigure && !record.verificationMethod;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">{record.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          {record.isPublic ? (
            <Link href={`/impact/${record.slug}`} className="text-primary hover:underline">
              View the public page
            </Link>
          ) : (
            'Not published.'
          )}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <ImpactForm
          record={record}
          programs={programs.items}
          campaigns={campaigns.items}
          events={events.items}
        />

        <aside className="border-border space-y-4 rounded-lg border p-4">
          <h2 className="text-body-sm font-semibold">Publication</h2>

          {/*
            Said here as well as in the form, because this is the panel somebody
            is looking at when they press publish and it is refused. Decision
            A14: a figure nobody can check is a figure that should not be
            published.
          */}
          {blocked ? (
            <p className="text-caption text-destructive">
              This record claims a figure with no stated method, so publishing will be refused.
            </p>
          ) : null}

          {can(actor, 'impact.publish') ? (
            <StatusActions
              entityId={record.id}
              slug={record.slug}
              current={record.status}
              allowed={PROGRAM_TRANSITIONS[record.status] ?? []}
              action={changeImpactStatus}
              labels={LABELS}
              reasonRequired={['archived']}
              confirmRequired={['archived']}
            />
          ) : (
            <p className="text-caption text-muted-foreground">
              You do not have permission to publish.
            </p>
          )}

          {record.verifiedBy ? (
            <p className="text-caption text-muted-foreground border-border border-t pt-4">
              Publishing stamps you as the person who stood behind this figure.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
