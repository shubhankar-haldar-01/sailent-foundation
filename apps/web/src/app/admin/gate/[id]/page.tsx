import { notFound, redirect } from 'next/navigation';

import {
  AdminApiError,
  adminFetch,
  type AdminEvent,
  type AdminEventRegistration,
  type Paginated,
} from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';
import { GateKioskView } from '@/components/admin/gate-kiosk-view';

export const dynamic = 'force-dynamic';

export default async function GateEventKioskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  // If unauthenticated staff, redirect to login with next path
  if (!actor) {
    redirect(`/admin/login?next=/admin/gate/${id}`);
  }

  // Check if staff has attendance or manage permission
  if (!can(actor, 'event.attendance') && !can(actor, 'event.manage')) {
    redirect(`/admin/events/${id}/registrations`);
  }

  let event: AdminEvent;
  try {
    event = await adminFetch<AdminEvent>(`admin/events/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  /*
    Every guest, a page at a time. The API answers at most 100 per page and
    refuses a larger `limit` outright — asking for 200 in one go left the
    desk with an empty guest list. The page cap only stops a runaway loop.
  */
  const initialRegistrations: AdminEventRegistration[] = [];
  try {
    for (let page = 1; page <= 50; page += 1) {
      const regRes = await adminFetch<Paginated<AdminEventRegistration>>(
        `admin/events/${id}/registrations`,
        { query: { status: 'all', limit: 100, page } },
      );
      initialRegistrations.push(...(regRes.items ?? []));
      if (!regRes.pagination?.hasNext) break;
    }
  } catch {
    // The scanner still works without the list; the desk shows what loaded.
  }

  return <GateKioskView event={event} initialRegistrations={initialRegistrations} />;
}
