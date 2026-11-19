import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
import { EventForm } from '@/components/admin/event-form';
import {
  adminFetch,
  listMedia,
  type AdminMedia,
  type AdminProgram,
  type Paginated,
} from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const actor = await currentActor();
  const [programs, mediaOptions] = await Promise.all([
    adminFetch<Paginated<AdminProgram>>('admin/programs', { query: { status: 'all', limit: 100 } }),
    can(actor, 'media.read')
      ? listMedia({ visibility: 'public', limit: 100 })
          .then((res) => res.items)
          .catch(() => [] as AdminMedia[])
      : Promise.resolve([] as AdminMedia[]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New event"
        breadcrumb={<AdminBackButton href="/admin/events">Back to events</AdminBackButton>}
        description="Creates an event or workshop. Initially saved as a draft with registration closed. Publish and open registration when details are finalized."
      />

      <Card className="border-border max-w-3xl">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Event Setup & Schedule</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Specify venue, seat capacity, registration deadlines, and thematic program association.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <EventForm programs={programs.items} mediaOptions={mediaOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
