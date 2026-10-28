import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users, ShieldAlert } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatDate,
} from '@sailent/ui';

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
      return (
        <div className="space-y-6">
          <PageHeader
            title={event.title}
            description="Event attendee list and attendance tracking"
            actions={
              <Button asChild variant="secondary" size="sm">
                <Link href={`/admin/events/${event.id}/edit`}>
                  <ArrowLeft className="mr-1.5 size-4" />
                  Back to event
                </Link>
              </Button>
            }
          />
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <ShieldAlert className="text-warning mb-2 size-8" />
              <p className="text-body font-medium">Access Restricted</p>
              <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
                You do not have permission to view attendee details for this event.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    } else {
      throw error;
    }
  }

  const past = new Date(event.startDate).getTime() < Date.now();

  const getStatusBadge = (regStatus: string) => {
    switch (regStatus) {
      case 'attended':
        return <Badge variant="success">Attended</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'no_show':
        return <Badge variant="warning">No show</Badge>;
      default:
        return <Badge variant="neutral">{regStatus.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        description={`Scheduled for ${formatDate(event.startDate)} · ${
          event.capacity !== null ? `${event.capacity} total seats` : 'Open capacity'
        }`}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/events/${event.id}/edit`}>
              <ArrowLeft className="mr-1.5 size-4" />
              Edit Event
            </Link>
          </Button>
        }
      />

      {needsReauth ? (
        <ReauthPanel
          returnTo={`/admin/events/${id}/registrations`}
          what="This list contains the name, email address and phone number of everybody attending."
        />
      ) : null}

      {data ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="text-primary size-4" />
                    Attendee Register
                  </CardTitle>
                  <CardDescription>
                    {data.pagination.total} {data.pagination.total === 1 ? 'person' : 'people'}{' '}
                    registered
                    {event.capacity !== null ? ` · ${event.capacity} places total` : ''}
                  </CardDescription>
                </div>
                <nav aria-label="Filter attendees" className="flex flex-wrap gap-1.5">
                  {(['coming', 'attended', 'no_show', 'cancelled', 'all'] as const).map(
                    (option) => {
                      const query = option === 'coming' ? '' : `?status=${option}`;
                      const isActive = option === 'coming' ? !status : status === option;
                      return (
                        <Link
                          key={option}
                          href={`/admin/events/${id}/registrations${query}`}
                          aria-current={isActive ? 'page' : undefined}
                          className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                          }`}
                        >
                          {option.replace('_', ' ')}
                        </Link>
                      );
                    },
                  )}
                </nav>
              </div>
            </CardHeader>

            <CardContent>
              {past && can(actor, 'event.attendance') ? (
                <div className="space-y-4">
                  <div className="border-border/60 bg-muted/30 rounded-lg border p-4">
                    <h3 className="text-body-sm font-semibold">Mark Attendance</h3>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      Leave a row on “Leave” and its record is not touched. Somebody who cancelled
                      and came anyway must register again first.
                    </p>
                  </div>
                  <AttendanceSheet eventId={event.id} registrations={data.items} />
                </div>
              ) : (
                <>
                  {data.items.length === 0 ? (
                    <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
                      Nobody matches this view.
                    </div>
                  ) : (
                    <div className="border-border/70 overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="font-semibold">Attendee</TableHead>
                            <TableHead className="font-semibold">Contact</TableHead>
                            <TableHead className="text-right font-semibold">Places</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="text-right font-semibold">Registered</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.items.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">{entry.fullName}</TableCell>
                              <TableCell className="text-body-sm text-muted-foreground">
                                <div>{entry.email}</div>
                                <div className="text-caption text-muted-foreground/80 font-mono">
                                  {entry.phone}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {entry.attendeeCount}
                              </TableCell>
                              <TableCell>{getStatusBadge(entry.status)}</TableCell>
                              <TableCell className="text-body-sm text-muted-foreground text-right">
                                {formatDate(entry.registeredAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
