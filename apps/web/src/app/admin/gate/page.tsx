import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  Calendar,
  MapPin,
  Users,
  QrCode,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

import { Badge, Button, formatDate } from '@sailent/ui';
import { adminFetch, type AdminEvent, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function GateHubPage() {
  const actor = await currentActor();
  if (!actor) {
    redirect('/admin/login?next=/admin/gate');
  }

  if (!can(actor, 'event.attendance') && !can(actor, 'event.manage')) {
    redirect('/admin');
  }

  let events: AdminEvent[] = [];
  try {
    const res = await adminFetch<Paginated<AdminEvent>>('admin/events', {
      query: { status: 'all', limit: 50, sort: '-startDate' },
    });
    events = res.items;
  } catch {
    events = [];
  }

  const totalRegistered = events.reduce((sum, e) => sum + (e.registeredCount || 0), 0);
  const totalAttended = events.reduce((sum, e) => sum + (e.counts?.attended || 0), 0);

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col font-sans">
      {/* Top Header Bar */}
      <header className="border-border/80 bg-surface/95 sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/events"
            className="border-border bg-background text-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Admin dashboard</span>
          </Link>
          <div className="bg-border h-4 w-px" />
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-success relative inline-flex size-2.5 rounded-full" />
            </span>
            <span className="text-foreground text-sm font-bold tracking-tight">
              Sailent gate operations hub
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="neutral"
            className="text-2xs border-border bg-muted text-foreground gap-1.5 font-mono"
          >
            <ShieldCheck className="text-success size-3.5" />
            Active session
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-8 lg:p-10">
        {/* Hero Section */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xs bg-accent text-primary rounded-full px-2.5 py-0.5 font-bold">
                EVENT ENTRANCE & ADMISSION
              </span>
            </div>
            <h1 className="text-foreground mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Gate pass scanner & check-in desk
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Select an event to open its high-speed QR pass camera scanner, instant search, and
              live guest list.
            </p>
          </div>
        </div>

        {/* Live Metrics Ribbon */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="shadow-xs border-border/90 bg-surface rounded-2xl border p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold">Events active</span>
              <span className="bg-accent text-primary flex size-8 items-center justify-center rounded-xl">
                <Calendar className="size-4" />
              </span>
            </div>
            <p className="text-foreground mt-2 text-2xl font-black">{events.length}</p>
            <p className="text-2xs text-muted-foreground mt-0.5">Live for gate check-in</p>
          </div>

          <div className="shadow-xs border-border/90 bg-surface rounded-2xl border p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold">
                Total registered guests
              </span>
              <span className="bg-info-subtle text-info flex size-8 items-center justify-center rounded-xl">
                <Users className="size-4" />
              </span>
            </div>
            <p className="text-foreground mt-2 text-2xl font-black">{totalRegistered}</p>
            <p className="text-2xs text-muted-foreground mt-0.5">Confirmed bookings</p>
          </div>

          <div className="shadow-xs border-border/90 bg-surface rounded-2xl border p-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold">Total admitted</span>
              <span className="bg-success-subtle text-success flex size-8 items-center justify-center rounded-xl">
                <CheckCircle2 className="size-4" />
              </span>
            </div>
            <p className="text-success mt-2 text-2xl font-black">{totalAttended}</p>
            <p className="text-2xs text-muted-foreground mt-0.5">Checked in at entrance</p>
          </div>
        </div>

        {/* Event Cards Grid */}
        {events.length === 0 ? (
          <div className="border-border-strong bg-surface text-muted-foreground flex flex-col items-center justify-center rounded-3xl border border-dashed p-12 text-center">
            <Calendar className="text-muted-foreground mb-3 size-12" />
            <p className="text-foreground text-base font-bold">No events scheduled</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Create an event in the admin dashboard to start accepting pass registrations and gate
              check-ins.
            </p>
            <Button asChild variant="primary" size="sm" className="mt-4 font-bold">
              <Link href="/admin/events/new">Create event</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
            {events.map((evt) => {
              const checkedIn = evt.counts?.attended || 0;
              const total = evt.registeredCount || 0;
              const percent = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

              return (
                <div
                  key={evt.id}
                  className="shadow-xs border-border/90 bg-surface hover:border-primary/60 group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-md"
                >
                  <div>
                    {/* Event Banner / Cover */}
                    <div className="bg-muted relative h-44 w-full overflow-hidden">
                      {evt.coverImage ? (
                        <Image
                          src={evt.coverImage}
                          alt={evt.title}
                          fill
                          className="group-hover:scale-103 object-cover transition-transform duration-300"
                        />
                      ) : (
                        <div className="from-surface-inverse to-surface-inverse flex h-full w-full items-center justify-center bg-gradient-to-br text-white">
                          <Calendar className="text-muted-foreground size-12" />
                        </div>
                      )}
                      <div className="from-surface-inverse/80 via-surface-inverse/20 absolute inset-0 bg-gradient-to-t to-transparent" />

                      {/* Badges on cover */}
                      <div className="absolute left-3 top-3 flex items-center gap-1.5">
                        <span className="text-2xs backdrop-blur-xs bg-surface/95 text-foreground rounded-full px-2.5 py-1 font-black uppercase tracking-wider shadow-sm">
                          {evt.registrationStatus || 'OPEN'}
                        </span>
                        {evt.status === 'published' && (
                          <span className="text-2xs backdrop-blur-xs bg-success/95 flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-white shadow-sm">
                            <span className="bg-surface size-1.5 rounded-full" />
                            Live
                          </span>
                        )}
                      </div>

                      {/* Title on cover */}
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-xl font-black tracking-tight text-white drop-shadow-sm">
                          {evt.title}
                        </h3>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="space-y-4 p-5">
                      <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-primary size-4 shrink-0" />
                          <span className="text-foreground font-medium">
                            {formatDate(evt.startDate)}
                          </span>
                        </div>
                        {evt.venueName && (
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className="text-primary size-4 shrink-0" />
                            <span className="text-foreground truncate font-medium">
                              {evt.venueName}
                              {evt.city ? `, ${evt.city}` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Live Admission Progress Bar */}
                      <div className="border-border bg-background/80 space-y-1.5 rounded-xl border p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-semibold">Admitted guests</span>
                          <span className="text-foreground font-mono font-bold">
                            {checkedIn} / {total} ({percent}%)
                          </span>
                        </div>
                        <div className="bg-border h-2 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-success h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(percent, total > 0 ? 3 : 0))}%`,
                            }}
                          />
                        </div>
                        <div className="text-2xs text-muted-foreground flex items-center justify-between pt-0.5">
                          <span>
                            {evt.capacity !== null ? `Capacity: ${evt.capacity}` : 'Open Capacity'}
                          </span>
                          <span>{total - checkedIn} pending entry</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="border-border bg-background/50 border-t p-4">
                    <Button
                      asChild
                      variant="primary"
                      className="shadow-xs h-11 w-full gap-2 font-bold transition-all hover:shadow-md"
                    >
                      <Link href={`/admin/gate/${evt.id}`}>
                        <QrCode className="size-4" />
                        Launch gate scanner & desk
                        <ChevronRight className="ml-auto size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
