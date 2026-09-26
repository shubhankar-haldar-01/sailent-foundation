import { EventForm } from '@/components/admin/event-form';
import { adminFetch, type AdminCampaign, type AdminProgram, type Paginated } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const [programs, campaigns] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', { query: { status: 'all', limit: 100 } }),
    adminFetch<Paginated<AdminCampaign>>('admin/campaigns', {
      query: { status: 'all', limit: 100 },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">New event</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Created as a draft with registration closed. Check the date and the venue, then publish
          and open it — in that order.
        </p>
      </header>
      <EventForm programs={programs.items} campaigns={campaigns.items} />
    </div>
  );
}
