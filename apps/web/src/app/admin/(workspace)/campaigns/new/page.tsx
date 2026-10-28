import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { CampaignForm } from '@/components/admin/campaign-form';
import { can, currentActor } from '@/lib/auth/session';
import {
  adminFetch,
  listMedia,
  type AdminCategory,
  type AdminMedia,
  type AdminProgram,
  type Paginated,
} from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const actor = await currentActor();
  const [programs, categories, mediaOptions] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', {
      query: { status: 'all', limit: 100, sort: 'title' },
    }),
    adminFetch<{ items: AdminCategory[] }>('admin/categories', { query: { kind: 'campaign' } }),
    can(actor, 'media.read')
      ? listMedia({ visibility: 'public', limit: 100 }).then((page) => page.items)
      : Promise.resolve([] as AdminMedia[]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New campaign"
        breadcrumb={
          <Link
            href="/admin/campaigns"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to campaigns
          </Link>
        }
        description="Created initially as a draft. It accepts no public donations until it is published and explicitly activated."
      />

      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Campaign Details & Goals</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Every campaign funds a specific piece of a program. Program association is required
            before publishing.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <CampaignForm
            programs={programs.items.filter((p) => p.status !== 'archived')}
            categories={categories.items.filter((c) => c.isActive)}
            mediaOptions={mediaOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
