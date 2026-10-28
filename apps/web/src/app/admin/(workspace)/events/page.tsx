import Link from 'next/link';
import { Calendar, ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';

import { Badge, Button, Card, CardContent, formatDate, PageHeader } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminEvent, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All Visibility' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
] as const;

const TIMINGS = [
  { value: 'all', label: 'All Dates' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
] as const;

function LifecycleBadge({ lifecycle }: { lifecycle?: string }) {
  switch (lifecycle) {
    case 'open':
      return (
        <Badge variant="success" className="text-[11px] capitalize">
          Open
        </Badge>
      );
    case 'full':
      return (
        <Badge variant="warning" className="text-[11px] capitalize">
          Full
        </Badge>
      );
    case 'closed':
    case 'ended':
      return (
        <Badge variant="neutral" className="text-[11px] capitalize">
          {lifecycle}
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="destructive" className="text-[11px] capitalize">
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className="text-[11px] capitalize">
          {lifecycle ?? '—'}
        </Badge>
      );
  }
}

/**
 * Event list.
 *
 * Registration is strictly 1-person, 1-seat; verified against real event capacity.
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
      when: params.when && params.when !== 'all' ? params.when : undefined,
      q: params.q,
      page: params.page,
      limit: 25,
      sort: 'startDate',
    },
  });

  const activeStatus = params.status ?? 'all';
  const activeWhen = params.when ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        count={data.pagination.total}
        description="Public events and workshops. Cancelling an event notifies registered donors automatically."
        actions={
          can(actor, 'event.manage') ? (
            <Button asChild className="gap-1.5">
              <Link href="/admin/events/new">
                <Plus className="size-4" aria-hidden="true" />
                New event
              </Link>
            </Button>
          ) : null
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Filter by visibility" className="flex flex-wrap items-center gap-1.5">
              {STATUSES.map((status) => {
                const isSelected = activeStatus === status.value;
                const href = `/admin/events?status=${status.value}${activeWhen !== 'all' ? `&when=${activeWhen}` : ''}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
                return (
                  <Link
                    key={status.value}
                    href={href}
                    aria-current={isSelected ? 'page' : undefined}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {status.label}
                  </Link>
                );
              })}
            </nav>

            <span className="text-muted-foreground hidden sm:inline">|</span>

            <nav aria-label="Filter by schedule" className="flex flex-wrap items-center gap-1.5">
              {TIMINGS.map((timing) => {
                const isSelected = activeWhen === timing.value;
                const href = `/admin/events?status=${activeStatus}${timing.value !== 'all' ? `&when=${timing.value}` : ''}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
                return (
                  <Link
                    key={timing.value}
                    href={href}
                    aria-current={isSelected ? 'page' : undefined}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-accent-950 text-white shadow-sm'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {timing.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <form
            className="flex w-full items-center gap-2 sm:w-auto"
            method="get"
            action="/admin/events"
          >
            {activeStatus !== 'all' ? (
              <input type="hidden" name="status" value={activeStatus} />
            ) : null}
            {activeWhen !== 'all' ? <input type="hidden" name="when" value={activeWhen} /> : null}
            <div className="relative w-full sm:w-56">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Search events..."
                aria-label="Search events"
                className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
            {params.q ? (
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`/admin/events?status=${activeStatus}${activeWhen !== 'all' ? `&when=${activeWhen}` : ''}`}
                >
                  Clear
                </Link>
              </Button>
            ) : null}
          </form>
        </div>
      </div>

      {data.items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Calendar className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">No events found</p>
            <p className="text-muted-foreground mt-1 text-xs">
              No events match the active filter criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Events with schedule dates, capacity count, visibility and registration lifecycle
                state.
              </caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Event
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Date & Time
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Capacity & Seats
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Visibility
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Registration
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.items.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/events/${event.id}/edit`}
                        className="text-foreground hover:text-primary font-medium transition-colors"
                      >
                        {event.title}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        /{event.slug}
                        {event.isOnline
                          ? ' · Virtual / Online'
                          : event.venueName
                            ? ` · ${event.venueName}`
                            : ''}
                      </p>
                    </td>
                    <td className="text-muted-foreground px-5 py-3.5 text-xs">
                      {formatDate(event.startDate)}
                    </td>
                    <td
                      data-numeric=""
                      className="text-foreground px-5 py-3.5 text-right text-xs font-semibold tabular-nums"
                    >
                      {event.registeredCount}
                      {event.capacity !== null ? (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          / {event.capacity}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal"> (no limit)</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={event.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <LifecycleBadge lifecycle={event.registrationStatus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {can(actor, 'event.registration.read') ? (
                          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                            <Link href={`/admin/events/${event.id}/registrations`}>
                              <Users className="size-3.5" aria-hidden="true" />
                              Attendees ({event.registeredCount})
                            </Link>
                          </Button>
                        ) : null}
                        <Button asChild variant="ghost" size="sm" className="text-xs">
                          <Link href={`/admin/events/${event.id}/edit`}>Edit</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.pagination.totalPages > 1 ? (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          hasNext={data.pagination.hasNext}
          query={params}
          activeStatus={activeStatus}
          activeWhen={activeWhen}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  hasNext,
  query,
  activeStatus,
  activeWhen,
}: {
  page: number;
  totalPages: number;
  hasNext: boolean;
  query: { q?: string };
  activeStatus: string;
  activeWhen: string;
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    if (activeStatus && activeStatus !== 'all') search.set('status', activeStatus);
    if (activeWhen && activeWhen !== 'all') search.set('when', activeWhen);
    if (query.q) search.set('q', query.q);
    search.set('page', String(target));
    return `/admin/events?${search.toString()}`;
  };

  return (
    <nav aria-label="Events pagination" className="flex items-center justify-between pt-2">
      <p className="text-muted-foreground text-xs">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={href(page - 1)} className="gap-1">
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Link>
          </Button>
        ) : null}
        {hasNext ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={href(page + 1)} className="gap-1">
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
