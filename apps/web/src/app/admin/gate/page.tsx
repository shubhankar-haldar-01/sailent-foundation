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
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] font-sans text-slate-900">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/events"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Admin Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              Sailent Gate Operations Hub
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="neutral"
            className="text-2xs gap-1.5 border-slate-200 bg-slate-100 font-mono text-slate-700"
          >
            <ShieldCheck className="size-3.5 text-emerald-600" />
            Active Session
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-8 lg:p-10">
        {/* Hero Section */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xs rounded-full bg-orange-100 px-2.5 py-0.5 font-bold text-[#EB6A1F]">
                EVENT ENTRANCE & ADMISSION
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Gate Pass Scanner & Check-In Desk
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Select an event to open its high-speed QR pass camera scanner, instant search, and
              live guest list.
            </p>
          </div>
        </div>

        {/* Live Metrics Ribbon */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="shadow-xs rounded-2xl border border-slate-200/90 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Events Active</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-orange-50 text-[#EB6A1F]">
                <Calendar className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{events.length}</p>
            <p className="text-2xs mt-0.5 text-slate-500">Live for gate check-in</p>
          </div>

          <div className="shadow-xs rounded-2xl border border-slate-200/90 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Registered Guests</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Users className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{totalRegistered}</p>
            <p className="text-2xs mt-0.5 text-slate-500">Confirmed bookings</p>
          </div>

          <div className="shadow-xs rounded-2xl border border-slate-200/90 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Admitted</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600">{totalAttended}</p>
            <p className="text-2xs mt-0.5 text-slate-500">Checked in at entrance</p>
          </div>
        </div>

        {/* Event Cards Grid */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            <Calendar className="mb-3 size-12 text-slate-400" />
            <p className="text-base font-bold text-slate-800">No Events Scheduled</p>
            <p className="mt-1 text-xs text-slate-500">
              Create an event in the admin dashboard to start accepting pass registrations and gate
              check-ins.
            </p>
            <Button asChild variant="primary" size="sm" className="mt-4 font-bold">
              <Link href="/admin/events/new">Create Event</Link>
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
                  className="shadow-xs group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all duration-200 hover:border-[#EB6A1F]/60 hover:shadow-md"
                >
                  <div>
                    {/* Event Banner / Cover */}
                    <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                      {evt.coverImage ? (
                        <Image
                          src={evt.coverImage}
                          alt={evt.title}
                          fill
                          className="group-hover:scale-103 object-cover transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                          <Calendar className="size-12 text-slate-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                      {/* Badges on cover */}
                      <div className="absolute left-3 top-3 flex items-center gap-1.5">
                        <span className="text-2xs backdrop-blur-xs rounded-full bg-white/95 px-2.5 py-1 font-black uppercase tracking-wider text-slate-800 shadow-sm">
                          {evt.registrationStatus || 'OPEN'}
                        </span>
                        {evt.status === 'published' && (
                          <span className="text-2xs backdrop-blur-xs flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 font-bold text-white shadow-sm">
                            <span className="size-1.5 rounded-full bg-white" />
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
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 shrink-0 text-[#EB6A1F]" />
                          <span className="font-medium text-slate-900">
                            {formatDate(evt.startDate)}
                          </span>
                        </div>
                        {evt.venueName && (
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className="size-4 shrink-0 text-[#EB6A1F]" />
                            <span className="truncate font-medium text-slate-900">
                              {evt.venueName}
                              {evt.city ? `, ${evt.city}` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Live Admission Progress Bar */}
                      <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">Admitted Guests</span>
                          <span className="font-mono font-bold text-slate-900">
                            {checkedIn} / {total} ({percent}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(percent, total > 0 ? 3 : 0))}%`,
                            }}
                          />
                        </div>
                        <div className="text-2xs flex items-center justify-between pt-0.5 text-slate-500">
                          <span>
                            {evt.capacity !== null ? `Capacity: ${evt.capacity}` : 'Open Capacity'}
                          </span>
                          <span>{total - checkedIn} pending entry</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <Button
                      asChild
                      variant="primary"
                      className="shadow-xs h-11 w-full gap-2 font-bold transition-all hover:shadow-md"
                    >
                      <Link href={`/admin/gate/${evt.id}`}>
                        <QrCode className="size-4" />
                        Launch Gate Scanner & Desk
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
