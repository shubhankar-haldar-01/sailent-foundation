import Link from 'next/link';

import { Badge, Button, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminEvent, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** The lifecycle badge — what is happening, as opposed to who can see it. */
function LifecycleBadge({ lifecycle }: { lifecycle: AdminEvent['registrationStatus'] }) {
  const variant =
    lifecycle === 'cancelled'
      ? 'destructive'
      : lifecycle === 'open'
        ? 'success'
        : lifecycle === 'full'
          ? 'warning'
          : 'neutral';
  return <Badge variant={variant}>{lifecycle}</Badge>;
}

/**
 * Events.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO STATE COLUMNS, NOT ONE, because an event has two states.
 *
 *   Status     draft / published / archived — can anyone see it?
 *   Lifecycle  open / closed / full / cancelled / completed — what is happening?
 *
 * A cancelled event is still PUBLISHED, deliberately: everyone holding a
 * registration needs to be able to reach the page that tells them. Collapsing
 * the two into one column would make that combination look like a mistake.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `Places` shows the recomputed figure beside the cap. It is counted from the
 * registration rows rather than read from the cached counter, so this screen is
 * where a drift would be visible.
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; when?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminEvent>>('admin/events', {
    query: {
      status: params.status ?? 'all',
      when: params.when,
      q: params.q,
      page: params.page,
      limit: 25,
    },
  });

  const statuses = ['all', 'draft', 'published', 'archived'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Events</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data.pagination.total} total. Cancelling an event emails everybody holding a place.
          </p>
        </div>
        {can(actor, 'event.manage') ? (
          <Button asChild>
            <Link href="/admin/events/new">New event</Link>
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={`/admin/events?status=${status}${params.when ? `&when=${params.when}` : ''}`}
              aria-current={active === status ? 'page' : undefined}
              className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
                active === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <nav aria-label="Filter by date" className="flex flex-wrap gap-1.5">
          {(['upcoming', 'past'] as const).map((when) => (
            <Link
              key={when}
              href={
                params.when === when
                  ? `/admin/events?status=${active}`
                  : `/admin/events?status=${active}&when=${when}`
              }
              aria-current={params.when === when ? 'page' : undefined}
              className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
                params.when === when
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {when}
            </Link>
          ))}
        </nav>

        <form className="ml-auto flex gap-2" action="/admin/events">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search title or city"
            aria-label="Search events"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No events match this view.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Event
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  When
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Places
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Registration
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((event) => (
                <tr key={event.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="hover:text-primary font-medium"
                    >
                      {event.title}
                    </Link>
                    <p className="text-caption text-muted-foreground">
                      {event.isOnline ? 'Online' : (event.city ?? event.venueName ?? '—')}
                    </p>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{formatDate(event.startDate)}</td>
                  <td data-numeric="" className="px-4 py-3 text-right tabular-nums">
                    {event.capacity === null
                      ? `${event.seatsHeld ?? event.registeredCount}`
                      : `${event.seatsHeld ?? event.registeredCount} / ${event.capacity}`}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={event.status} />
                  </td>
                  <td className="px-4 py-3">
                    <LifecycleBadge lifecycle={event.registrationStatus} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    {can(actor, 'event.registration.read') ? (
                      <>
                        <span className="text-muted-foreground mx-2" aria-hidden="true">
                          ·
                        </span>
                        <Link
                          href={`/admin/events/${event.id}/registrations`}
                          className="text-primary hover:underline"
                        >
                          Attendees
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
