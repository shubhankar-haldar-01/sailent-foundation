import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Button, formatDate } from '@sailent/ui';

import { AttendanceSheet } from '@/components/admin/attendance-sheet';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  AdminApiError,
  adminFetch,
  type AdminEvent,
  type AdminEventRegistration,
  type Paginated,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface RegistrationsPayload extends Paginated<AdminEventRegistration> {
  event: { id: string; title: string; capacity: number | null };
}

/**
 * Who is coming, and who came.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MOST SENSITIVE SCREEN IN PHASE 9.
 *
 * It is the only place the name, email address and phone number of every
 * person attending an event come out in one response. `event.registration.read`
 * is marked sensitive in the permission catalogue for that reason, and the API
 * route carries `@Sensitive()` — so reaching it needs a re-authentication
 * within the last five minutes, not merely a valid session.
 *
 * A 403 `REAUTH_REQUIRED` is therefore an EXPECTED outcome here, not an error.
 * It renders the re-auth panel in place of the list; anything else would leave
 * an operator holding the right permission staring at a permission error.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function EventRegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const status = (await searchParams).status;
  const actor = await currentActor();

  let event: AdminEvent;
  try {
    event = await adminFetch<AdminEvent>(`admin/events/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  let data: RegistrationsPayload | null = null;
  let needsReauth = false;

  try {
    data = await adminFetch<RegistrationsPayload>(`admin/events/${id}/registrations`, {
      query: { status, limit: 100 },
    });
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      needsReauth = true;
    } else if (error instanceof AdminApiError && error.status === 403) {
      // A genuine permission failure, which is a different thing and gets a
      // different message — telling somebody to re-enter a password for
      // something they still could not do is a dead end.
      return (
        <div className="space-y-6">
          <h1 className="font-display text-h1 font-bold tracking-tight">{event.title}</h1>
          <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
            You do not have permission to see who is attending this event.
          </p>
        </div>
      );
    } else {
      throw error;
    }
  }

  const past = new Date(event.startDate).getTime() < Date.now();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">{event.title}</h1>
          <p className="text-body-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <span>{formatDate(event.startDate)}</span>
            <Badge variant={event.registrationStatus === 'cancelled' ? 'destructive' : 'neutral'}>
              {event.registrationStatus}
            </Badge>
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/events/${event.id}/edit`}>Back to the event</Link>
        </Button>
      </header>

      {needsReauth ? (
        <ReauthPanel
          returnTo={`/admin/events/${id}/registrations`}
          what="This list contains the name, email address and phone number of everybody attending."
        />
      ) : null}

      {data ? (
        <>
          <nav aria-label="Filter attendees" className="flex flex-wrap gap-1.5">
            {(['coming', 'attended', 'no_show', 'cancelled', 'all'] as const).map((option) => {
              // `coming` is the DEFAULT view and is expressed by sending no
              // status at all — the API excludes cancellations unless asked.
              const query = option === 'coming' ? '' : `?status=${option}`;
              const isActive = option === 'coming' ? !status : status === option;
              return (
                <Link
                  key={option}
                  href={`/admin/events/${id}/registrations${query}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.replace('_', ' ')}
                </Link>
              );
            })}
          </nav>

          <p className="text-body-sm text-muted-foreground">
            {data.pagination.total} {data.pagination.total === 1 ? 'person' : 'people'}
            {event.capacity !== null ? ` · ${event.capacity} places` : null}
          </p>

          {/*
            The register is offered only once the event has started. The API
            refuses attendance for an event that has not happened — an
            attendance figure dated before the thing took place is exactly the
            number decision A14 exists to keep off the site — so showing the
            sheet early would only produce a refusal.
          */}
          {past && can(actor, 'event.attendance') ? (
            <section aria-labelledby="register">
              <h2 id="register" className="text-h3 font-semibold">
                Attendance
              </h2>
              <p className="text-body-sm text-muted-foreground mb-4 mt-1">
                Leave a row on “Leave” and its record is not touched. Somebody who cancelled and
                came anyway has to register again first.
              </p>
              <AttendanceSheet eventId={event.id} registrations={data.items} />
            </section>
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="text-body-sm w-full">
                <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Contact
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Places
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Registered
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((entry) => (
                    <tr key={entry.id} className="border-border border-t">
                      <td className="px-4 py-3 font-medium">{entry.fullName}</td>
                      <td className="text-muted-foreground px-4 py-3">
                        {entry.email}
                        <p className="text-caption">{entry.phone}</p>
                      </td>
                      <td data-numeric="" className="px-4 py-3 text-right tabular-nums">
                        {entry.attendeeCount}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 capitalize">
                        {entry.status.replace('_', ' ')}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {formatDate(entry.registeredAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.items.length === 0 ? (
            <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
              Nobody matches this view.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
