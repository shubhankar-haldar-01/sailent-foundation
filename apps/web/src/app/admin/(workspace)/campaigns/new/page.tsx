import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@sailent/ui';

import { CampaignForm } from '@/components/admin/campaign-form';
import type { CatalogueProduct } from '@/components/products/types';
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
  const [programs, categories, mediaOptions, catalogue] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', {
      query: { status: 'all', limit: 100, sort: 'title' },
    }),
    adminFetch<{ items: AdminCategory[] }>('admin/categories', { query: { kind: 'campaign' } }),
    can(actor, 'media.read')
      ? listMedia({ visibility: 'public', limit: 100 }).then((page) => page.items)
      : Promise.resolve([] as AdminMedia[]),
    can(actor, 'product.view')
      ? adminFetch<Paginated<CatalogueProduct>>('admin/products', {
          query: { status: 'active', limit: 100, sort: 'name' },
        }).then((page) => page.items)
      : Promise.resolve([] as CatalogueProduct[]),
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

      <CampaignForm
        programs={programs.items.filter((p) => p.status !== 'archived')}
        categories={categories.items.filter((c) => c.isActive)}
        mediaOptions={mediaOptions}
        catalogue={catalogue}
      />
    </div>
  );
}
