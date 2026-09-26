import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@sailent/ui';

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
  archived: { endpoint: 'archived', label: 'Archive' },
} as const;

const LIFECYCLE_LABELS = {
  open: { endpoint: 'open', label: 'Open registration' },
  closed: { endpoint: 'closed', label: 'Close registration' },
  cancelled: { endpoint: 'cancelled', label: 'Cancel event' },
  completed: { endpoint: 'completed', label: 'Mark completed' },
  // `full` is set BY THE SERVER from the seat count and is deliberately not
  // offered as a button. An operator who wants registration shut uses `closed`,
  // so that a cancellation freeing a seat can reopen a full event without
  // reopening one somebody closed on purpose.
} as const;

/**
 * Edit an event.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO SEPARATE SETS OF LIFECYCLE BUTTONS, and the separation is the point.
 *
 * Publication answers "can anyone see this". The lifecycle answers "what is
 * happening to it". They are not the same question, and a cancelled event must
 * stay PUBLISHED — archiving it would 404 the page that tells its registrants
 * it is off.
 *
 * The API refuses to archive an event with live registrations for exactly that
 * reason, so the two controls cannot be used in the wrong order.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Both tables come FROM the API rather than being restated here, so the buttons
 * cannot offer a move the server will refuse.
 */
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">{event.title}</h1>
          <p className="text-body-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={event.registrationStatus === 'cancelled' ? 'destructive' : 'neutral'}>
              {event.registrationStatus}
            </Badge>
            {event.status === 'published' ? (
              <Link href={`/events/${event.slug}`} className="text-primary hover:underline">
                View the public page
              </Link>
            ) : null}
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <EventForm event={event} programs={programs.items} campaigns={campaigns.items} />

        <div className="space-y-4">
          <aside className="border-border space-y-4 rounded-lg border p-4">
            <h2 className="text-body-sm font-semibold">Registrations</h2>
            <p className="text-body-sm">
              <span data-numeric="" className="text-h3 font-semibold tabular-nums">
                {seatsHeld}
              </span>
              {event.capacity !== null ? (
                <span className="text-muted-foreground"> of {event.capacity} places</span>
              ) : (
                <span className="text-muted-foreground"> places taken (no limit)</span>
              )}
            </p>

            {/*
              The cached counter is written inside every registration and every
              cancellation, so it should never disagree with the rows. Showing
              the disagreement when it happens is the only way anybody would
              find out — and on a capped event a high counter quietly turns
              people away while a low one admits an extra person.
            */}
            {drifted ? (
              <p className="text-caption text-destructive">
                The cached counter says {event.registeredCount}. Use the recount on the attendee
                list to correct it.
              </p>
            ) : null}

            {can(actor, 'event.registration.read') ? (
              <Link
                href={`/admin/events/${event.id}/registrations`}
                className="text-body-sm text-primary hover:underline"
              >
                See who is coming
              </Link>
            ) : null}
          </aside>

          <aside className="border-border space-y-4 rounded-lg border p-4">
            <h2 className="text-body-sm font-semibold">Publication</h2>
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
                You do not have permission to change this.
              </p>
            )}
          </aside>

          <aside className="border-border space-y-4 rounded-lg border p-4">
            <h2 className="text-body-sm font-semibold">Registration</h2>
            <p className="text-caption text-muted-foreground">
              Cancelling emails everybody holding a place, quoting the reason you give.
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
                You do not have permission to change this.
              </p>
            )}
          </aside>

          {event.slugHistory?.length ? (
            <aside className="border-border rounded-lg border p-4">
              <h2 className="text-body-sm font-semibold">Previous addresses</h2>
              <ul className="text-caption text-muted-foreground mt-2 space-y-1">
                {event.slugHistory.map((entry) => (
                  <li key={entry.slug}>/events/{entry.slug} — redirects here</li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
