import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Users } from 'lucide-react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { EventForm } from '@/components/admin/event-form';
import { StatusActions } from '@/components/admin/status-actions';
import { changeEventLifecycle, changeEventStatus } from '@/lib/admin/actions';
import {
  AdminApiError,
  adminFetch,
  type AdminCampaign,
  type AdminEvent,
  type AdminProgram,
  type EventTransitions,
  type Paginated,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUS_LABELS = {
  published: { endpoint: 'published', label: 'Publish' },
  draft: { endpoint: 'draft', label: 'Unpublish' },
  archived: { endpoint: 'archive', label: 'Archive' },
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

  const [transitions, programs, campaigns] = await Promise.all([
    adminFetch<EventTransitions>('admin/events/transitions'),
    adminFetch<Paginated<AdminProgram>>('admin/programs', { query: { status: 'all', limit: 100 } }),
    adminFetch<Paginated<AdminCampaign>>('admin/campaigns', {
      query: { status: 'all', limit: 100 },
    }),
  ]);

  const seatsHeld = event.counts?.seatsHeld ?? event.registeredCount;
  const drifted = event.counts ? event.counts.seatsHeld !== event.registeredCount : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        breadcrumb={
          <Link
            href="/admin/events"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to events
          </Link>
        }
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
          <div className="flex items-center gap-2">
            {event.status === 'published' ? (
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <Link href={`/events/${event.slug}`} target="_blank">
                  View on site
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            {can(actor, 'event.registration.read') ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/admin/events/${event.id}/registrations`}>
                  <Users className="size-3.5" aria-hidden="true" />
                  Attendees ({seatsHeld})
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Left Column: Event Form */}
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-base font-semibold">Event Configuration & Details</CardTitle>
            <p className="text-caption text-muted-foreground mt-1">
              Title, date, start/end time, physical venue or online meeting link, and program
              linkage.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <EventForm event={event} programs={programs.items} campaigns={campaigns.items} />
          </CardContent>
        </Card>

        {/* Right Column: Registrations, Publication & Lifecycle */}
        <div className="space-y-6">
          {/* Capacity Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <CardTitle className="text-base font-semibold">Attendee Capacity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-caption text-muted-foreground font-medium uppercase">
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
                <p className="text-caption text-destructive bg-destructive/10 rounded p-2.5 font-medium">
                  Discrepancy detected: Cache says {event.registeredCount} while rows indicate{' '}
                  {seatsHeld}. Recount from attendee list.
                </p>
              ) : null}

              {can(actor, 'event.registration.read') ? (
                <Button asChild variant="secondary" size="sm" className="mt-2 w-full">
                  <Link href={`/admin/events/${event.id}/registrations`}>View attendee sheet</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {/* Visibility Controls */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <CardTitle className="text-base font-semibold">Visibility Status</CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                Controls whether the event appears on the public website.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {can(actor, 'event.manage') ? (
                <StatusActions
                  entityId={event.id}
                  slug={event.slug}
                  current={event.status}
                  allowed={transitions.status[event.status] ?? []}
                  action={changeEventStatus}
                  labels={STATUS_LABELS}
                  reasonRequired={['archived']}
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
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <CardTitle className="text-base font-semibold">Registration Lifecycle</CardTitle>
              <p className="text-caption text-muted-foreground mt-1">
                Cancelling automatically dispatches email notifications to all confirmed attendees.
              </p>
            </CardHeader>
            <CardContent className="p-6">
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
