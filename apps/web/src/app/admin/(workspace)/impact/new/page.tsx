import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { ImpactForm } from '@/components/admin/impact-form';
import {
  adminFetch,
  type AdminCampaign,
  type AdminEvent,
  type AdminProgram,
  type Paginated,
} from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export default async function NewImpactRecordPage() {
  const [programs, campaigns, events] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', { query: { status: 'all', limit: 100 } }),
    adminFetch<Paginated<AdminCampaign>>('admin/campaigns', {
      query: { status: 'all', limit: 100 },
    }),
    adminFetch<Paginated<AdminEvent>>('admin/events', { query: { status: 'all', limit: 100 } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record Impact Metric"
        description="Saved as a draft. Claims of quantitative figures require method verification before publication."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metric & Verification Details</CardTitle>
          <CardDescription>
            Specify numbers, methodology, verification agent, and project associations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImpactForm programs={programs.items} campaigns={campaigns.items} events={events.items} />
        </CardContent>
      </Card>
    </div>
  );
}
