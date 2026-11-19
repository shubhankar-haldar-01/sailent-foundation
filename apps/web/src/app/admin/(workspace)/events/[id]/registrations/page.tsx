import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users, ShieldAlert, QrCode } from 'lucide-react';

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

import { AdminPagination } from '@/components/admin/admin-pagination';
import { AttendanceSheet } from '@/components/admin/attendance-sheet';
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
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const status = sp.status;
  const actor = await currentActor();

  let event: AdminEvent;
  try {
    event = await adminFetch<AdminEvent>(`admin/events/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  let data: RegistrationsPayload | null = null;

  try {
    data = await adminFetch<RegistrationsPayload>(`admin/events/${id}/registrations`, {
      query: { status, page: sp.page, limit: 100 },
    });
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 403) {
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
    }
    throw error;
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
          <div className="flex items-center gap-2">
            <Button asChild variant="primary" size="sm" className="shadow-xs font-semibold">
              <Link href={`/admin/gate/${event.id}`}>
                <QrCode className="mr-1.5 size-4" />
                Gate QR Scanner
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/admin/events/${event.id}/edit`}>
                <ArrowLeft className="mr-1.5 size-4" />
                Edit Event
              </Link>
            </Button>
          </div>
        }
      />

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
                            <TableHead className="font-semibold">Attendee(s)</TableHead>
                            <TableHead className="font-semibold">Function</TableHead>
                            <TableHead className="font-semibold">Contact</TableHead>
                            <TableHead className="text-right font-semibold">Passes</TableHead>
                            <TableHead className="font-semibold">Payment</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="text-right font-semibold">Registered</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.items.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                <div>{entry.fullName}</div>
                                {entry.attendees && entry.attendees.length > 1 ? (
                                  <div className="text-muted-foreground mt-1 flex flex-wrap gap-1 text-[11px] font-normal">
                                    {entry.attendees.map((att, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                      >
                                        Pass {i + 1}: {att.fullName}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                {entry.functionName ? (
                                  <Badge variant="neutral" className="font-medium">
                                    {entry.functionName}
                                  </Badge>
                                ) : (
                                  <span className="text-caption text-muted-foreground">
                                    General
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-body-sm text-muted-foreground">
                                <div>{entry.email}</div>
                                <div className="text-caption text-muted-foreground/80 font-mono">
                                  {entry.phone}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {entry.attendeeCount}
                              </TableCell>
                              <TableCell className="text-caption">
                                {entry.isPaid && entry.paidAmount ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                                      Paid ₹{Math.round(entry.paidAmount / 100)}
                                    </span>
                                    {entry.paymentId ? (
                                      <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                                        {entry.paymentId}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Free</span>
                                )}
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

          <AdminPagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            totalItems={data.pagination.total}
            ariaLabel="Event registrations pagination"
            makeHref={(p) => {
              const search = new URLSearchParams();
              if (status) search.set('status', status);
              search.set('page', String(p));
              return `/admin/events/${id}/registrations?${search.toString()}`;
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
