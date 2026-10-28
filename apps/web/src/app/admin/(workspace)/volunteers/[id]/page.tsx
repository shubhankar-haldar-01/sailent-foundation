import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckSquare,
  FileText,
  HeartHandshake,
  PhoneCall,
  ShieldAlert,
  User,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatDate,
  PageHeader,
} from '@sailent/ui';

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
 * One volunteer profile in full.
 *
 * Highly sensitive screen requiring re-authentication as it exposes home addresses,
 * date of birth, and emergency contacts.
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
        <div className="p-8">
          <Card className="border-border p-8 text-center">
            <p className="text-body text-muted-foreground">
              You do not have permission to view sensitive volunteer records.
            </p>
          </Card>
        </div>
      );
    } else {
      throw error;
    }
  }

  if (needsReauth || !volunteer) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Volunteer Profile"
          breadcrumb={
            <Link
              href="/admin/volunteers"
              className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to volunteers
            </Link>
          }
          description="Authentication required to access personal contact records."
        />
        <ReauthPanel
          returnTo={`/admin/volunteers/${id}`}
          what="This record contains a residential address, date of birth, and emergency contact."
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
      <PageHeader
        title={name}
        breadcrumb={
          <Link
            href="/admin/volunteers"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to volunteers
          </Link>
        }
        status={<VolunteerStatusBadge status={volunteer.status} />}
        description={`${volunteer.volunteerId ? `${volunteer.volunteerId} · ` : ''}${volunteer.verifiedHours} verified service hours recorded`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Left Column: Contact, Skills, Assignments, Attendance */}
        <div className="space-y-6">
          {/* Contact Details Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <User className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">
                  Contact & Personal Details
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <dl className="text-body-sm grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-caption text-muted-foreground font-medium">Email Address</dt>
                  <dd className="text-foreground mt-0.5 font-medium">{volunteer.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground font-medium">Phone Number</dt>
                  <dd className="text-foreground mt-0.5 font-mono">{volunteer.phone}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground font-medium">Location</dt>
                  <dd className="text-foreground mt-0.5">
                    {[volunteer.city, volunteer.state].filter(Boolean).join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground font-medium">Occupation</dt>
                  <dd className="text-foreground mt-0.5">{volunteer.occupation ?? '—'}</dd>
                </div>
              </dl>

              {/* Emergency Contact */}
              <div className="border-border border-t pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <PhoneCall className="text-destructive size-4" aria-hidden="true" />
                  <h3 className="text-body-sm text-foreground font-semibold">Emergency Contact</h3>
                </div>
                {volunteer.emergencyContactName ? (
                  <p className="text-body-sm text-foreground">
                    <span className="font-medium">{volunteer.emergencyContactName}</span>
                    {volunteer.emergencyContactRelation ? (
                      <span className="text-muted-foreground">
                        {' '}
                        ({volunteer.emergencyContactRelation})
                      </span>
                    ) : (
                      ''
                    )}
                    <span className="text-muted-foreground"> · </span>
                    <span className="font-mono font-medium">{volunteer.emergencyContactPhone}</span>
                  </p>
                ) : (
                  <p className="text-caption text-muted-foreground">
                    No emergency contact recorded on profile.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Skills and Background Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <HeartHandshake className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">Skills & Experience</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-caption text-muted-foreground mb-2 font-medium uppercase">
                  Key Competencies
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(volunteer.skills ?? []).map((skill) => (
                    <Badge key={skill} variant="neutral">
                      {skill}
                    </Badge>
                  ))}
                  {(volunteer.interests ?? []).map((interest) => (
                    <Badge key={interest} variant="outline">
                      {interest}
                    </Badge>
                  ))}
                  {!volunteer.skills?.length && !volunteer.interests?.length ? (
                    <span className="text-body-sm text-muted-foreground">
                      No competencies specified
                    </span>
                  ) : null}
                </div>
              </div>

              {volunteer.experience ? (
                <div className="border-border border-t pt-4">
                  <p className="text-caption text-muted-foreground mb-1 font-medium uppercase">
                    Prior Experience
                  </p>
                  <p className="text-body-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {volunteer.experience}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Field Assignments Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="text-primary size-5" aria-hidden="true" />
                  <CardTitle className="text-base font-semibold">Field Assignments</CardTitle>
                </div>
                {can(actor, 'volunteer.assign') ? (
                  <NewAssignment
                    volunteerId={volunteer.id}
                    canAssign={volunteer.status === 'active'}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {assignments.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">
                  No work assignments currently dispatched.
                </p>
              ) : (
                <ul className="space-y-4">
                  {assignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="border-border border-t pt-4 first:border-0 first:pt-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-body-sm text-foreground font-semibold">
                            {assignment.role}
                          </p>
                          <p className="text-caption text-muted-foreground mt-0.5">
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
                          className="text-xs capitalize"
                        >
                          {assignment.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {can(actor, 'volunteer.attendance') ? (
                        <div className="mt-3">
                          <RecordAttendance volunteerId={volunteer.id} assignment={assignment} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Verified Service Attendance Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">
                  Verified Service Attendance
                </CardTitle>
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                Hours verified by operational staff. Verified hours feed directly into milestone
                certificates.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {can(actor, 'volunteer.attendance') ? (
                <VerifyAttendance volunteerId={volunteer.id} attendance={attendance} />
              ) : (
                <p className="text-body-sm text-muted-foreground">
                  {attendance.length} attendance {attendance.length === 1 ? 'record' : 'records'}{' '}
                  logged.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Decision Review, Certificates, Notes */}
        <div className="space-y-6">
          {/* Review Decision Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <CardTitle className="text-base font-semibold">Onboarding Decision</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {can(actor, 'volunteer.approve') ? (
                <VolunteerReview
                  volunteerId={volunteer.id}
                  status={volunteer.status}
                  allowed={transitions.volunteer[volunteer.status] ?? []}
                />
              ) : (
                <p className="text-caption text-muted-foreground">
                  You do not possess the <code>volunteer.approve</code> permission.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Service Certificates Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <Award className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">Service Certificates</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {certificates.length > 0 ? (
                <ul className="text-body-sm space-y-2">
                  {certificates.map((certificate) => (
                    <li key={certificate.id} className="flex items-center justify-between">
                      <span className="text-foreground font-mono text-xs font-semibold">
                        {certificate.certificateNumber}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {certificate.hoursCredited}h credited
                        {certificate.status === 'revoked' ? (
                          <Badge variant="destructive" className="ml-2 text-[0.625rem]">
                            Revoked
                          </Badge>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-muted-foreground">
                  No milestone certificates issued yet.
                </p>
              )}

              {can(actor, 'volunteer.approve') ? (
                <div className="border-border border-t pt-4">
                  <IssueCertificate
                    volunteerId={volunteer.id}
                    verifiedHours={volunteer.verifiedHours}
                    action={issueVolunteerCertificate}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Internal Staff Notes */}
          {volunteer.statusReason || volunteer.internalNotes || application?.reviewNotes ? (
            <Card className="border-warning/40 bg-warning-subtle/30">
              <CardHeader className="border-warning/30 border-b pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-warning-foreground size-4" aria-hidden="true" />
                  <CardTitle className="text-warning-foreground text-sm font-semibold">
                    Internal Staff Notes
                  </CardTitle>
                </div>
                <p className="text-caption text-muted-foreground">
                  Restricted to staff; never visible to volunteer.
                </p>
              </CardHeader>
              <CardContent className="text-body-sm text-foreground space-y-2 p-4">
                {volunteer.statusReason ? <p>{volunteer.statusReason}</p> : null}
                {volunteer.internalNotes ? <p>{volunteer.internalNotes}</p> : null}
                {application?.reviewNotes ? <p>{application.reviewNotes}</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Application Record */}
          {application ? (
            <Card className="border-border">
              <CardHeader className="border-border border-b pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="text-primary size-5" aria-hidden="true" />
                  <CardTitle className="text-base font-semibold">Original Application</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-caption text-muted-foreground space-y-2 p-6">
                <p>
                  Submitted on {formatDate(application.submittedAt)}
                  {application.reviewedAt
                    ? ` · Reviewed on ${formatDate(application.reviewedAt)}`
                    : ''}
                </p>
                <p>Frozen snapshot preserved as originally submitted by the candidate.</p>
                {application.coolingPeriodUntil ? (
                  <p className="text-destructive font-medium">
                    Cooling period active until {formatDate(application.coolingPeriodUntil)}.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
