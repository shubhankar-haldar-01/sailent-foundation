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
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Record an impact</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Saved as a draft. A record claiming a figure cannot be published until it says how the
          number was arrived at.
        </p>
      </header>
      <ImpactForm programs={programs.items} campaigns={campaigns.items} events={events.items} />
    </div>
  );
}
