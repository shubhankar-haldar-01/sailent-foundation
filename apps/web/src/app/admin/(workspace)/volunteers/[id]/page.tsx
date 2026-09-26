import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Button, Card, formatDate } from '@sailent/ui';

import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  IssueCertificate,
  VolunteerReview,
  VolunteerStatusBadge,
} from '@/components/admin/volunteer-review';
import {
  NewAssignment,
  RecordAttendance,
  VerifyAttendance,
} from '@/components/admin/volunteer-work';
import { issueVolunteerCertificate } from '@/lib/admin/actions';
import {
  AdminApiError,
  adminFetch,
  type AdminVolunteer,
  type AdminVolunteerAssignment,
  type AdminVolunteerAttendance,
  type AdminVolunteerCertificate,
  type VolunteerTransitions,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One volunteer, in full.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MOST SENSITIVE SCREEN IN PHASE 8.
 *
 * It carries a phone number, a home address, a date of birth and an EMERGENCY
 * CONTACT — somebody who never applied to anything and whose number is here
 * because a volunteer might be hurt in the field. `volunteer.read` is marked
 * sensitive in the permission catalogue and the route is `@Sensitive()`, so a
 * fresh re-authentication is required.
 *
 * A 403 `REAUTH_REQUIRED` is therefore an EXPECTED outcome, not an error: it
 * renders the re-auth panel in place of the record.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminVolunteerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let volunteer: AdminVolunteer | null = null;
  let needsReauth = false;

  try {
    volunteer = await adminFetch<AdminVolunteer>(`admin/volunteers/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      needsReauth = true;
    } else if (error instanceof AdminApiError && error.status === 404) {
      notFound();
    } else if (error instanceof AdminApiError && error.status === 403) {
      return (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          You do not have permission to read volunteer records.
        </p>
      );
    } else {
      throw error;
    }
  }

  if (needsReauth || !volunteer) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-h1 font-bold tracking-tight">Volunteer</h1>
        <ReauthPanel
          returnTo={`/admin/volunteers/${id}`}
          what="This record contains a home address, a date of birth and an emergency contact."
        />
      </div>
    );
  }

  const [transitions, assignments, attendance, certificates] = await Promise.all([
    adminFetch<VolunteerTransitions>('admin/volunteers/transitions'),
    adminFetch<AdminVolunteerAssignment[]>(`admin/volunteers/${id}/assignments`),
    adminFetch<AdminVolunteerAttendance[]>(`admin/volunteers/${id}/attendance`),
    adminFetch<AdminVolunteerCertificate[]>(`admin/volunteers/${id}/certificates`),
  ]);

  const name = [volunteer.firstName, volunteer.lastName].filter(Boolean).join(' ');
  const application = volunteer.applications[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">{name}</h1>
          <p className="text-body-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <VolunteerStatusBadge status={volunteer.status} />
            {volunteer.volunteerId ? <span>{volunteer.volunteerId}</span> : null}
            <span>·</span>
            <span data-numeric="">
              {volunteer.verifiedHours} verified {volunteer.verifiedHours === 1 ? 'hour' : 'hours'}
              {volunteer.totalHours !== volunteer.verifiedHours
                ? ` of ${volunteer.totalHours} recorded`
                : ''}
            </span>
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/volunteers">Back to the list</Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          {/* Contact ------------------------------------------------------ */}
          <Card className="p-5">
            <h2 className="text-h4 font-semibold">Contact</h2>
            <dl className="text-body-sm mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{volunteer.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{volunteer.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Where</dt>
                <dd>{[volunteer.city, volunteer.state].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Occupation</dt>
                <dd>{volunteer.occupation ?? '—'}</dd>
              </div>
            </dl>

            <div className="border-border mt-4 border-t pt-4">
              <h3 className="text-body-sm font-semibold">In an emergency</h3>
              <p className="text-body-sm mt-1">
                {volunteer.emergencyContactName ? (
                  <>
                    {volunteer.emergencyContactName}
                    {volunteer.emergencyContactRelation
                      ? ` (${volunteer.emergencyContactRelation})`
                      : ''}
                    {' — '}
                    {volunteer.emergencyContactPhone}
                  </>
                ) : (
                  <span className="text-muted-foreground">Not recorded</span>
                )}
              </p>
            </div>
          </Card>

          {/* Skills ------------------------------------------------------- */}
          <Card className="p-5">
            <h2 className="text-h4 font-semibold">Skills and interests</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(volunteer.skills ?? []).map((skill) => (
                <Badge key={skill} variant="neutral">
                  {skill}
                </Badge>
              ))}
              {(volunteer.interests ?? []).map((interest) => (
                <Badge key={interest} variant="info">
                  {interest}
                </Badge>
              ))}
              {!volunteer.skills?.length && !volunteer.interests?.length ? (
                <span className="text-body-sm text-muted-foreground">None recorded</span>
              ) : null}
            </div>
            {volunteer.experience ? (
              <p className="text-body-sm text-muted-foreground mt-4 leading-relaxed">
                {volunteer.experience}
              </p>
            ) : null}
          </Card>

          {/* Assignments -------------------------------------------------- */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-h4 font-semibold">Assignments</h2>
              {can(actor, 'volunteer.assign') ? (
                <NewAssignment
                  volunteerId={volunteer.id}
                  canAssign={volunteer.status === 'active'}
                />
              ) : null}
            </div>

            {assignments.length === 0 ? (
              <p className="text-body-sm text-muted-foreground mt-3">
                No work has been assigned yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="border-border border-t pt-4 first:border-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-body font-medium">{assignment.role}</p>
                        <p className="text-caption text-muted-foreground">
                          {formatDate(assignment.startsAt)}
                          {assignment.location ? ` · ${assignment.location}` : ''}
                        </p>
                      </div>
                      <Badge
                        variant={
                          assignment.status === 'completed'
                            ? 'success'
                            : assignment.status === 'cancelled' || assignment.status === 'no_show'
                              ? 'destructive'
                              : 'neutral'
                        }
                      >
                        {assignment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {can(actor, 'volunteer.attendance') ? (
                      <RecordAttendance volunteerId={volunteer.id} assignment={assignment} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Attendance --------------------------------------------------- */}
          <Card className="p-5">
            <h2 className="text-h4 font-semibold">Attendance</h2>
            <p className="text-caption text-muted-foreground mb-3 mt-1">
              Recorded by staff only. A volunteer can read this and cannot change it — certificates
              count these hours.
            </p>
            {can(actor, 'volunteer.attendance') ? (
              <VerifyAttendance volunteerId={volunteer.id} attendance={attendance} />
            ) : (
              <p className="text-body-sm text-muted-foreground">
                {attendance.length} record{attendance.length === 1 ? '' : 's'}.
              </p>
            )}
          </Card>
        </div>

        {/* Sidebar -------------------------------------------------------- */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-body-sm font-semibold">Decision</h2>
            <div className="mt-3">
              {can(actor, 'volunteer.approve') ? (
                <VolunteerReview
                  volunteerId={volunteer.id}
                  status={volunteer.status}
                  allowed={transitions.volunteer[volunteer.status] ?? []}
                />
              ) : (
                <p className="text-caption text-muted-foreground">
                  You do not have permission to decide applications.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-body-sm font-semibold">Certificates</h2>
            {certificates.length > 0 ? (
              <ul className="text-body-sm mt-3 space-y-2">
                {certificates.map((certificate) => (
                  <li key={certificate.id}>
                    <span className="font-medium">{certificate.certificateNumber}</span>
                    <span className="text-muted-foreground">
                      {' · '}
                      {certificate.hoursCredited}h
                    </span>
                    {certificate.status === 'revoked' ? (
                      <Badge variant="destructive" className="ml-2">
                        withdrawn
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              {can(actor, 'volunteer.approve') ? (
                <IssueCertificate
                  volunteerId={volunteer.id}
                  verifiedHours={volunteer.verifiedHours}
                  action={issueVolunteerCertificate}
                />
              ) : null}
            </div>
          </Card>

          {/*
            ADMIN-ONLY, and labelled as such on screen.

            `statusReason` holds the rejection reason and `internalNotes` the
            reviewer's candid assessment. Neither is ever returned on a
            volunteer-facing route; the label is here so nobody writes into it
            believing otherwise.
          */}
          {volunteer.statusReason || volunteer.internalNotes || application?.reviewNotes ? (
            <Card className="border-warning/30 bg-warning-subtle p-5">
              <h2 className="text-body-sm font-semibold">Internal notes</h2>
              <p className="text-caption text-muted-foreground">Never shown to the volunteer.</p>
              {volunteer.statusReason ? (
                <p className="text-body-sm mt-3">{volunteer.statusReason}</p>
              ) : null}
              {volunteer.internalNotes ? (
                <p className="text-body-sm mt-2">{volunteer.internalNotes}</p>
              ) : null}
              {application?.reviewNotes ? (
                <p className="text-body-sm mt-2">{application.reviewNotes}</p>
              ) : null}
            </Card>
          ) : null}

          {application ? (
            <Card className="p-5">
              <h2 className="text-body-sm font-semibold">Application</h2>
              <p className="text-caption text-muted-foreground mt-1">
                Submitted {formatDate(application.submittedAt)}
                {application.reviewedAt ? `, reviewed ${formatDate(application.reviewedAt)}` : ''}.
              </p>
              <p className="text-caption text-muted-foreground mt-2">
                {/* The point of keeping it separate from the profile. */}
                Frozen as submitted — the profile above may have been edited since.
              </p>
              {application.coolingPeriodUntil ? (
                <p className="text-caption text-destructive mt-2">
                  Cannot re-apply until {formatDate(application.coolingPeriodUntil)}.
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
