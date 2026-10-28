import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

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
      <PageHeader
        title="New event"
        breadcrumb={
          <Link
            href="/admin/events"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to events
          </Link>
        }
        description="Creates an event or workshop. Initially saved as a draft with registration closed. Publish and open registration when details are finalized."
      />

      <Card className="border-border max-w-3xl">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Event Setup & Schedule</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Specify venue or virtual link, seat capacity, registration deadlines, and thematic
            program association.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <EventForm programs={programs.items} campaigns={campaigns.items} />
        </CardContent>
      </Card>
    </div>
  );
}
