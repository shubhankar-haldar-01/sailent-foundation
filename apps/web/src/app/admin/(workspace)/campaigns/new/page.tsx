import { PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
import { CampaignForm } from '@/components/admin/campaign-form';
import type { CatalogueProduct } from '@/components/products/types';
import { can, currentActor } from '@/lib/auth/session';
import {
  adminFetch,
  listMedia,
  type AdminMedia,
  type AdminProgram,
  type Paginated,
} from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const actor = await currentActor();
  const [programs, mediaOptions, catalogue] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', {
      query: { status: 'all', limit: 100, sort: 'title' },
    }),
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
        breadcrumb={<AdminBackButton href="/admin/campaigns">Back to campaigns</AdminBackButton>}
        description="Created initially as a draft. It accepts no public donations until it is published and explicitly activated."
      />

      <CampaignForm
        programs={programs.items.filter((p) => p.status !== 'archived')}
        mediaOptions={mediaOptions}
        catalogue={catalogue}
      />
    </div>
  );
}
