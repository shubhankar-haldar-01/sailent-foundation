import Link from 'next/link';

import { CampaignForm } from '@/components/admin/campaign-form';
import { adminFetch, type AdminCategory, type AdminProgram, type Paginated } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const [programs, categories] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', {
      query: { status: 'published', limit: 100, sort: 'title' },
    }),
    adminFetch<{ items: AdminCategory[] }>('admin/categories', { query: { kind: 'campaign' } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/campaigns"
          className="text-body-sm text-muted-foreground hover:underline"
        >
          ← Campaigns
        </Link>
        <h1 className="font-display text-h1 mt-2 font-bold tracking-tight">New campaign</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Saved as a draft. It takes no donations until you publish and then activate it.
        </p>
      </div>

      <CampaignForm
        programs={programs.items}
        categories={categories.items.filter((c) => c.isActive)}
      />
    </div>
  );
}
