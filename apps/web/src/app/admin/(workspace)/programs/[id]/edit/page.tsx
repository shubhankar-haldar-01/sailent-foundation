import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Eye } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatDate,
  PageHeader,
} from '@sailent/ui';

import { ProgramForm } from '@/components/admin/program-form';
import { StatusActions } from '@/components/admin/status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { changeProgramStatus } from '@/lib/admin/actions';
import { CoverImagePanel } from '@/components/admin/campaign-media';
import { can, currentActor } from '@/lib/auth/session';
import {
  AdminApiError,
  adminFetch,
  listMedia,
  type AdminCategory,
  type AdminMedia,
} from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

interface ProgramDetail {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  shortDescription: string | null;
  description: string | null;
  problem: string | null;
  approach: string | null;
  beneficiaries: string | null;
  categoryId: string | null;
  category: string | null;
  status: 'draft' | 'published' | 'archived';
  displayOrder: number;
  publishedAt: string | null;
  updatedAt: string;
  campaigns: { id: string; title: string; slug: string; status: string }[];
  slugHistory: { slug: string; changedAt: string }[];
}

const PROGRAM_LABELS = {
  published: { endpoint: 'publish', label: 'Publish' },
  draft: { endpoint: 'unpublish', label: 'Take back to draft' },
  archived: { endpoint: 'archive', label: 'Archive' },
};

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let program: ProgramDetail;
  let transitions: { program: Record<string, string[]> };
  let categories: { items: AdminCategory[] };

  try {
    [program, transitions, categories] = await Promise.all([
      adminFetch<ProgramDetail>(`admin/programs/${id}`),
      adminFetch<{ program: Record<string, string[]> }>('admin/campaigns/transitions'),
      adminFetch<{ items: AdminCategory[] }>('admin/categories', { query: { kind: 'program' } }),
    ]);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const actor = await currentActor();
  const mediaOptions: AdminMedia[] = can(actor, 'media.read')
    ? (await listMedia({ visibility: 'public', limit: 60 })).items
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={program.title}
        breadcrumb={
          <Link
            href="/admin/programs"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to programs
          </Link>
        }
        description={`/${program.slug} · Updated ${formatDate(program.updatedAt)}`}
        status={<StatusPill status={program.status} />}
        actions={
          <div className="flex items-center gap-2">
            {program.status === 'published' ? (
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <Link href={`/programs/${program.slug}`} target="_blank">
                  View on site
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <Link href={`/admin/preview/program/${program.slug}`}>
                  <Eye className="size-3.5" aria-hidden="true" />
                  Preview draft
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Lifecycle Transitions Card */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Publication Lifecycle</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            {program.status === 'published'
              ? 'This program is currently visible on the public website.'
              : 'Draft status. Visible to administrators only.'}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <StatusActions
            entityId={program.id}
            current={program.status}
            allowed={transitions.program[program.status] ?? []}
            action={changeProgramStatus}
            labels={PROGRAM_LABELS}
            confirmRequired={['archived']}
          />
        </CardContent>
      </Card>

      {/* Program Details Card */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Program Information & Focus</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Core description, problem context, strategic approach, and target communities.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ProgramForm categories={categories.items.filter((c) => c.isActive)} program={program} />
        </CardContent>
      </Card>

      {/* Cover Image Panel */}
      {can(actor, 'program.update') ? (
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-base font-semibold">Hero Cover Image</CardTitle>
            <p className="text-caption text-muted-foreground mt-1">
              Banner image displayed on the program page and promotional program cards. Public media
              library assets only.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <CoverImagePanel
              kind="program"
              id={program.id}
              slug={program.slug}
              current={program.coverImage}
              options={mediaOptions}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Attached Campaigns Card */}
      {program.campaigns.length > 0 ? (
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-base font-semibold">Associated Campaigns</CardTitle>
            <p className="text-caption text-muted-foreground mt-1">
              Active and completed fundraising campaigns organized under this programmatic umbrella.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-border divide-y">
              {program.campaigns.map((campaign) => (
                <li
                  key={campaign.id}
                  className="hover:bg-muted/20 flex items-center justify-between gap-3 px-6 py-3.5 transition-colors"
                >
                  <Link
                    href={`/admin/campaigns/${campaign.id}/edit`}
                    className="text-body-sm hover:text-primary text-foreground font-medium hover:underline"
                  >
                    {campaign.title}
                  </Link>
                  <StatusPill status={campaign.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Slug History Card */}
      {program.slugHistory.length > 0 ? (
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-base font-semibold">Permanent URL Redirects</CardTitle>
            <p className="text-caption text-muted-foreground mt-1">
              Historical URLs preserved as permanent 301 redirects to ensure external links do not
              break.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <ul className="text-body-sm text-muted-foreground space-y-2">
              {program.slugHistory.map((entry) => (
                <li key={entry.slug} className="flex items-center gap-2">
                  <code className="text-caption bg-muted text-foreground rounded px-2 py-0.5">
                    /programs/{entry.slug}
                  </code>
                  <span>— retired on {formatDate(entry.changedAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
