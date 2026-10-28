import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
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
      <PageHeader
        title={record.title}
        description={`Slug: /impact/${record.slug}`}
        status={<StatusPill status={record.status} />}
        actions={
          record.isPublic ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/impact/${record.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-4" />
                View live
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record Details & Metrics</CardTitle>
            <CardDescription>
              Quantitative numbers, methodology statements, and verification records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImpactForm
              record={record}
              programs={programs.items}
              campaigns={campaigns.items}
              events={events.items}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="text-primary size-4" />
                Publication Lifecycle
              </CardTitle>
              <CardDescription>Status workflow control</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {blocked ? (
                <div className="border-destructive/30 bg-destructive/5 text-caption text-destructive flex items-start gap-2.5 rounded-md border p-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    This record claims a figure with no stated verification method. Publication will
                    be refused by the API.
                  </span>
                </div>
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
                  You do not have permission to publish impact records.
                </p>
              )}

              {record.verifiedBy ? (
                <p className="text-caption text-muted-foreground border-border/60 border-t pt-3">
                  Publication stamps your staff identity as the verified authority behind this
                  figure.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
