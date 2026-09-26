import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, MapPin, ShieldCheck } from 'lucide-react';

import { Badge, Card, formatDate } from '@sailent/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { donorFetch } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your volunteering',
  path: '/dashboard/volunteering',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

interface MyVolunteering {
  isVolunteer: boolean;
  id?: string;
  volunteerId?: string | null;
  status?: string;
  totalHours?: number;
  verifiedHours?: number;
  assignmentCount?: number;
  skills?: string[] | null;
  joiningDate?: string | null;
  upcoming?: {
    id: string;
    role: string;
    startsAt: string;
    location: string | null;
    status: string;
  }[];
  certificates?: {
    id: string;
    certificateNumber: string;
    verificationCode: string;
    title: string;
    hoursCredited: number;
    periodStart: string;
    periodEnd: string;
    issuedAt: string;
    status: string;
    revokedReason: string | null;
  }[];
}

/**
 * A volunteer's own record.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS PAGE DOES NOT SHOW, AND WHY.
 *
 * Not the rejection reason, not the internal review notes, not the
 * `statusReason`. The API does not return them on this route at all — the
 * decision is communicated, the reasoning behind it is an internal record.
 *
 * Attendance is READ-ONLY here and is not editable anywhere by a volunteer.
 * Certificates count verified hours, and somebody who could record their own
 * attendance could print themselves any figure they liked.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function MyVolunteeringPage() {
  const mine = await donorFetch<MyVolunteering>('me/volunteering');

  if (!mine.isVolunteer) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-h1 font-bold">Your volunteering</h1>
        </header>
        <EmptyState
          title="You have not applied to volunteer"
          description="If you would like to give time as well as, or instead of, money — we would be glad to hear from you."
          action={{ label: 'Read about volunteering', href: '/volunteer' }}
        />
      </div>
    );
  }

  const pending = mine.status === 'applied' || mine.status === 'under_review';
  const certificates = mine.certificates ?? [];
  const upcoming = mine.upcoming ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-bold">Your volunteering</h1>
        <p className="text-body text-muted-foreground mt-2 flex flex-wrap items-center gap-2">
          <Badge
            variant={
              mine.status === 'active'
                ? 'success'
                : mine.status === 'suspended'
                  ? 'destructive'
                  : pending
                    ? 'warning'
                    : 'neutral'
            }
          >
            {(mine.status ?? '').replace('_', ' ')}
          </Badge>
          {mine.volunteerId ? <span>Volunteer number {mine.volunteerId}</span> : null}
        </p>
      </header>

      {pending ? (
        <Card className="p-5">
          <p className="text-body">
            {/* No timeframe. See the notification processor for why. */}
            We have your application and somebody will read it. We will write to you once it has
            been considered — there is nothing you need to do in the meantime.
          </p>
        </Card>
      ) : null}

      {!pending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-caption text-muted-foreground">Verified hours</p>
            <p data-numeric="" className="text-display mt-1 font-semibold tabular-nums">
              {mine.verifiedHours ?? 0}
            </p>
            {(mine.totalHours ?? 0) !== (mine.verifiedHours ?? 0) ? (
              <p className="text-caption text-muted-foreground mt-1">
                {mine.totalHours} recorded, the rest awaiting verification
              </p>
            ) : null}
          </Card>
          <Card className="p-5">
            <p className="text-caption text-muted-foreground">Assignments</p>
            <p data-numeric="" className="text-display mt-1 font-semibold tabular-nums">
              {mine.assignmentCount ?? 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-caption text-muted-foreground">With us since</p>
            <p className="text-body mt-2 font-medium">
              {mine.joiningDate ? formatDate(mine.joiningDate) : '—'}
            </p>
          </Card>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <section aria-labelledby="upcoming-work">
          <h2 id="upcoming-work" className="text-h3 font-semibold">
            Coming up
          </h2>
          <ul className="mt-4 space-y-3">
            {upcoming.map((assignment) => (
              <li key={assignment.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-h4 font-semibold leading-tight">{assignment.role}</h3>
                      <p className="text-body-sm text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                          <time dateTime={assignment.startsAt}>
                            {formatDate(assignment.startsAt)}
                          </time>
                        </span>
                        {assignment.location ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                            {assignment.location}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Badge variant="neutral">{assignment.status}</Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {certificates.length > 0 ? (
        <section aria-labelledby="certificates">
          <h2 id="certificates" className="text-h3 font-semibold">
            Your certificates
          </h2>
          <ul className="mt-4 space-y-3">
            {certificates.map((certificate) => (
              <li key={certificate.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-h4 font-semibold leading-tight">{certificate.title}</h3>
                      <p className="text-body-sm text-muted-foreground mt-1">
                        {certificate.hoursCredited}{' '}
                        {certificate.hoursCredited === 1 ? 'hour' : 'hours'} ·{' '}
                        {formatDate(certificate.periodStart)} to {formatDate(certificate.periodEnd)}
                      </p>
                      <p className="text-caption text-muted-foreground mt-1">
                        {certificate.certificateNumber}
                      </p>
                    </div>
                    {certificate.status === 'revoked' ? (
                      <Badge variant="destructive">Withdrawn</Badge>
                    ) : (
                      <Badge variant="success">Valid</Badge>
                    )}
                  </div>

                  {certificate.status === 'issued' ? (
                    <div className="border-border mt-4 border-t pt-4">
                      <p className="text-body-sm flex items-center gap-1.5">
                        <ShieldCheck className="text-wash-mint-ink size-4" aria-hidden="true" />
                        {/*
                          The volunteer needs this link: it is how an employer
                          confirms the certificate without an account.
                        */}
                        <Link
                          href={`/verify/${certificate.verificationCode}`}
                          className="text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2"
                        >
                          Share this link to prove it is genuine
                        </Link>
                      </p>
                    </div>
                  ) : certificate.revokedReason ? (
                    <p className="text-body-sm text-muted-foreground border-border mt-4 border-t pt-4">
                      {/* Unlike a rejection, this reason IS shown: the holder
                          has to be able to explain it to whoever saw it. */}
                      {certificate.revokedReason}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!pending && upcoming.length === 0 && certificates.length === 0 ? (
        <EmptyState
          title="Nothing scheduled just now"
          description="When you are assigned to something it will appear here, along with your hours and any certificates."
          action={{ label: 'See upcoming events', href: '/events' }}
        />
      ) : null}
    </div>
  );
}
