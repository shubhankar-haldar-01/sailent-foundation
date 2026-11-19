import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ExternalLink, Globe, Ticket, Users } from 'lucide-react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
import { StatusPill } from '@/components/admin/status-pill';
import { EventForm } from '@/components/admin/event-form';
import { StatusActions } from '@/components/admin/status-actions';
import { changeEventLifecycle, changeEventStatus } from '@/lib/admin/actions';
import {
  AdminApiError,
  adminFetch,
  listMedia,
  type AdminEvent,
  type AdminMedia,
  type AdminProgram,
  type EventTransitions,
  type Paginated,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUS_LABELS = {
  published: { endpoint: 'published', label: 'Publish' },
  draft: { endpoint: 'draft', label: 'Unpublish' },
  archived: { endpoint: 'archived', label: 'Delete' },
} as const;

const LIFECYCLE_LABELS = {
  open: { endpoint: 'open', label: 'Open registration' },
  closed: { endpoint: 'closed', label: 'Close registration' },
  cancelled: { endpoint: 'cancelled', label: 'Cancel event' },
  completed: { endpoint: 'completed', label: 'Mark completed' },
} as const;

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let event: AdminEvent;
  try {
    event = await adminFetch<AdminEvent>(`admin/events/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const [transitions, programs, mediaOptions] = await Promise.all([
    adminFetch<EventTransitions>('admin/events/transitions'),
    adminFetch<Paginated<AdminProgram>>('admin/programs', { query: { status: 'all', limit: 100 } }),
    can(actor, 'media.read')
      ? listMedia({ visibility: 'public', limit: 100 })
          .then((res) => res.items)
          .catch(() => [] as AdminMedia[])
      : Promise.resolve([] as AdminMedia[]),
  ]);

  const seatsHeld = event.counts?.seatsHeld ?? event.registeredCount;
  const drifted = event.counts ? event.counts.seatsHeld !== event.registeredCount : false;

  const publishBlockers: string[] = [];
  if (!event.summary?.trim()) {
    publishBlockers.push('Add a summary (shown on event cards and in search results)');
  }
  if (event.isOnline) {
    if (!event.meetingUrl?.trim()) {
      publishBlockers.push('Add an online joining link');
    }
  } else if (!event.venueName?.trim() && !event.location?.trim() && !event.city?.trim()) {
    publishBlockers.push('Add a venue name or city in the form');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        breadcrumb={<AdminBackButton href="/admin/events">Back to events</AdminBackButton>}
        status={
          <div className="flex items-center gap-2">
            <Badge
              variant={event.registrationStatus === 'cancelled' ? 'destructive' : 'neutral'}
              className="text-xs capitalize"
            >
              {event.registrationStatus}
            </Badge>
            <Badge
              variant={event.status === 'published' ? 'success' : 'neutral'}
              className="text-xs capitalize"
            >
              {event.status}
            </Badge>
          </div>
        }
        actions={
          event.status === 'published' ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="h-8.5 shadow-xs gap-1.5 rounded-lg px-3.5 text-xs font-semibold"
            >
              <Link href={`/events/${event.slug}`} target="_blank">
                <span>View on site</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Left Column: Event Form */}
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-base font-semibold">Event Configuration & Details</CardTitle>
            <p className="text-caption text-muted-foreground mt-1">
              Title, date, start/end time, physical venue, and program linkage.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <EventForm event={event} programs={programs.items} mediaOptions={mediaOptions} />
          </CardContent>
        </Card>

        {/* Right Column: Registrations, Publication & Lifecycle */}
        <div className="space-y-6">
          {/* Capacity Card */}
          <Card className="border-border shadow-xs overflow-hidden">
            <CardHeader className="border-border bg-muted/20 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="border-border/80 bg-background text-foreground shadow-xs flex size-9 shrink-0 items-center justify-center rounded-lg border">
                  <Users className="text-info size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Attendee Capacity</CardTitle>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    Registration limit and reserved places
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
                  Confirmed Places
                </span>
                <span
                  data-numeric=""
                  className="font-display text-h2 text-foreground font-bold tabular-nums"
                >
                  {seatsHeld}
                  {event.capacity !== null ? (
                    <span className="text-body text-muted-foreground font-normal">
                      {' '}
                      / {event.capacity}
                    </span>
                  ) : (
                    <span className="text-caption text-muted-foreground font-normal">
                      {' '}
                      (unlimited)
                    </span>
                  )}
                </span>
              </div>

              {drifted ? (
                <p className="text-caption text-destructive bg-destructive/10 rounded-lg p-3 font-medium">
                  Discrepancy detected: Cache says {event.registeredCount} while rows indicate{' '}
                  {seatsHeld}. Recount from attendee list.
                </p>
              ) : null}

              {can(actor, 'event.registration.read') ? (
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="h-8.5 w-full rounded-lg text-xs font-semibold"
                >
                  <Link href={`/admin/events/${event.id}/registrations`}>View attendee sheet</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {/* Visibility Controls */}
          <Card className="border-border shadow-xs overflow-hidden">
            <CardHeader className="border-border bg-muted/20 border-b pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="border-border/80 bg-background text-foreground shadow-xs flex size-9 shrink-0 items-center justify-center rounded-lg border">
                    <Globe className="text-info size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Visibility Status</CardTitle>
                    <p className="text-caption text-muted-foreground mt-1">
                      Controls whether the event appears on the public website.
                    </p>
                  </div>
                </div>
                <StatusPill status={event.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
              {publishBlockers.length > 0 && event.status === 'draft' ? (
                <div className="text-foreground space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                    <AlertCircle className="size-4 shrink-0 text-amber-600" />
                    <span>Required before publishing</span>
                  </div>
                  <ul className="text-caption text-foreground/80 list-inside list-disc space-y-1 pl-1">
                    {publishBlockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {can(actor, 'event.manage') ? (
                <StatusActions
                  entityId={event.id}
                  slug={event.slug}
                  current={event.status}
                  allowed={transitions.status[event.status] ?? []}
                  action={changeEventStatus}
                  labels={STATUS_LABELS}
                  confirmRequired={['archived']}
                />
              ) : (
                <p className="text-caption text-muted-foreground">
                  You do not possess permission to alter publication state.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Registration Lifecycle Controls */}
          <Card className="border-border shadow-xs overflow-hidden">
            <CardHeader className="border-border bg-muted/20 border-b pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="border-border/80 bg-background text-foreground shadow-xs flex size-9 shrink-0 items-center justify-center rounded-lg border">
                    <Ticket className="text-primary size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Registration Lifecycle
                    </CardTitle>
                    <p className="text-caption text-muted-foreground mt-1">
                      Attendee reservation and capacity state.
                    </p>
                  </div>
                </div>
                <StatusPill status={event.registrationStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <p className="text-caption text-muted-foreground">
                Cancelling automatically dispatches email notifications to all confirmed attendees.
              </p>
              {can(actor, 'event.manage') ? (
                <StatusActions
                  entityId={event.id}
                  slug={event.slug}
                  current={event.registrationStatus}
                  allowed={transitions.lifecycle[event.registrationStatus] ?? []}
                  action={changeEventLifecycle}
                  labels={LIFECYCLE_LABELS}
                  reasonRequired={['cancelled']}
                  confirmRequired={['cancelled', 'completed']}
                />
              ) : (
                <p className="text-caption text-muted-foreground">
                  You do not possess permission to alter registration state.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Slug History */}
          {event.slugHistory?.length ? (
            <Card className="border-border">
              <CardHeader className="border-border border-b pb-4">
                <CardTitle className="text-base font-semibold">Previous URL Permalinks</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="text-caption text-muted-foreground space-y-1">
                  {event.slugHistory.map((entry) => (
                    <li key={entry.slug} className="font-mono text-xs">
                      /events/{entry.slug} — redirects here
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
