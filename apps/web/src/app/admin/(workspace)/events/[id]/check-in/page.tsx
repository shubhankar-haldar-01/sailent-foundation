import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldAlert, QrCode } from 'lucide-react';

import { Button, Card, CardContent, PageHeader, formatDate } from '@sailent/ui';
import { AdminApiError, adminFetch, type AdminEvent } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';
import { EventCheckInScanner } from '@/components/admin/event-check-in-scanner';

export const dynamic = 'force-dynamic';

export default async function EventCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let event: AdminEvent;
  try {
    event = await adminFetch<AdminEvent>(`admin/events/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  if (!can(actor, 'event.attendance') && !can(actor, 'event.manage')) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={event.title}
          description="Gate check-in & scanner"
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href={`/admin/events/${event.id}/registrations`}>
                <ArrowLeft className="mr-1.5 size-4" />
                Back to registrations
              </Link>
            </Button>
          }
        />
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <ShieldAlert className="text-warning mb-2 size-8" />
            <p className="text-body font-medium">Access restricted</p>
            <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
              You do not have permission to record attendance or check in attendees for this event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        description={`Gate Admission & QR Check-In · Scheduled for ${formatDate(event.startDate)} ${
          event.venueName ? `at ${event.venueName}` : ''
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="primary" size="sm" className="shadow-xs font-semibold">
              <Link href={`/admin/gate/${event.id}`}>
                <QrCode className="mr-1.5 size-4" />
                Fullscreen kiosk
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/admin/events/${event.id}/registrations`}>
                <ArrowLeft className="mr-1.5 size-4" />
                Attendee register
              </Link>
            </Button>
          </div>
        }
      />

      <EventCheckInScanner event={event} />
    </div>
  );
}
