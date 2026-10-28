import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  History,
  Lock,
  Mail,
  ShieldAlert,
  User,
  UserCog,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatCurrency,
  formatDate,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sailent/ui';

import { DonorCorrectionForm } from '@/components/admin/donor-correction-form';
import { AdminApiError, adminFetch } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface AdminDonorDetail {
  id: string;
  donorCode: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  donorType: string;
  totalDonated: number;
  donationCount: number;
  firstDonatedAt: string | null;
  lastDonatedAt: string | null;
  isAnonymous: boolean;
  communicationConsent: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  notifyCampaignUpdates: boolean;
  notifyImpactUpdates: boolean;
  notifyNewsletter: boolean;
  source: string | null;
  createdAt: string;
  hasTaxId: boolean;

  /** Present only with `donor.read_sensitive`. */
  taxIdType?: string | null;
  taxIdNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  internalNotes?: string | null;

  donations: {
    id: string;
    reference: string;
    amount: number;
    status: string;
    donationDate: string;
    campaignTitle: string | null;
  }[];
  recomputed: { totalDonated: number; donationCount: number };
}

/**
 * One donor.
 *
 * Shows cached lifetime totals vs re-derived totals to expose any reconciliation drift.
 */
export default async function AdminDonorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let donor: AdminDonorDetail;
  try {
    donor = await adminFetch<AdminDonorDetail>(`admin/donors/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const name =
    [donor.firstName, donor.lastName].filter(Boolean).join(' ').trim() || 'Unnamed donor';
  const sensitive = can(actor, 'donor.read_sensitive');
  const canUpdate = can(actor, 'donor.update');
  const drifted =
    donor.recomputed.totalDonated !== donor.totalDonated ||
    donor.recomputed.donationCount !== donor.donationCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        breadcrumb={
          <Link
            href="/admin/donors"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to donors
          </Link>
        }
        description={`${donor.donorCode ? `Donor Code: ${donor.donorCode} · ` : ''}Member since ${formatDate(donor.createdAt)}`}
        status={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {donor.donorType}
            </Badge>
            {donor.isAnonymous ? <Badge variant="neutral">Anonymous to public</Badge> : null}
            {donor.hasTaxId ? (
              <Badge variant="success">PAN on file</Badge>
            ) : (
              <Badge variant="neutral">PAN missing</Badge>
            )}
          </div>
        }
      />

      {/* Drift reconciliation banner */}
      {drifted ? (
        <Card className="border-warning/50 bg-warning-subtle/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="text-warning-foreground mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-body-sm text-warning-foreground font-semibold">
                Cached totals do not match historical donations
              </p>
              <p className="text-body-sm text-muted-foreground mt-1">
                The donor profile caches {formatCurrency(donor.totalDonated)} across{' '}
                {donor.donationCount} donations. The historical table sums to{' '}
                {formatCurrency(donor.recomputed.totalDonated)} across{' '}
                {donor.recomputed.donationCount} donations. Lifetime caches update strictly on
                payment capture transactions; a mismatch indicates a database reconciliation job is
                required.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* KPI Top Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
              Lifetime Given
            </p>
            <p
              data-numeric=""
              className="font-display text-h2 text-foreground mt-1 font-bold tabular-nums"
            >
              {formatCurrency(donor.totalDonated)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
              Total Contributions
            </p>
            <p
              data-numeric=""
              className="font-display text-h2 text-foreground mt-1 font-bold tabular-nums"
            >
              {donor.donationCount}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
              First Gift Date
            </p>
            <p className="text-body text-foreground mt-2 font-medium">
              {donor.firstDonatedAt ? formatDate(donor.firstDonatedAt) : 'No gifts recorded'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">
              Last Gift Date
            </p>
            <p className="text-body text-foreground mt-2 font-medium">
              {donor.lastDonatedAt ? formatDate(donor.lastDonatedAt) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact and Profile Card */}
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <div className="flex items-center gap-2">
              <User className="text-primary size-5" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">Contact & Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <dl className="divide-border divide-y">
              <Row label="Email" value={donor.email ?? '—'} />
              <Row label="Phone" value={donor.phone ?? '—'} mono />
              <Row label="Donor Type" value={donor.donorType} />
              <Row
                label="Public Listing"
                value={donor.isAnonymous ? 'Anonymous' : 'Named publicly'}
              />
              <Row label="Acquisition Source" value={donor.source ?? 'Direct website'} />
            </dl>
          </CardContent>
        </Card>

        {/* Communication Consents Card */}
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <div className="flex items-center gap-2">
              <Mail className="text-primary size-5" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">Communication Consents</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <dl className="divide-border divide-y">
              <Row
                label="Primary Consent"
                value={donor.communicationConsent ? 'Granted' : 'Revoked / Withheld'}
              />
              <Row label="Email Channel" value={donor.emailOptIn ? 'Opted In' : 'Opted Out'} />
              <Row label="SMS Channel" value={donor.smsOptIn ? 'Opted In' : 'Opted Out'} />
              <Row
                label="WhatsApp Channel"
                value={donor.whatsappOptIn ? 'Opted In' : 'Opted Out'}
              />
              <Row
                label="Campaign & Impact Updates"
                value={donor.notifyCampaignUpdates ? 'Subscribed' : 'Off'}
              />
              <Row
                label="Quarterly Newsletter"
                value={donor.notifyNewsletter ? 'Subscribed' : 'Off'}
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Sensitive Tax & Address block (requires donor.read_sensitive) */}
      {sensitive ? (
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">
                  Statutory Tax & Address Information
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                donor.read_sensitive
              </Badge>
            </div>
            <p className="text-caption text-muted-foreground mt-1">
              Protected statutory data required for annual Form 10BD filing with the Income Tax
              Department.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <dl className="divide-border divide-y">
              <Row
                label="PAN / Tax Identification"
                value={
                  donor.taxIdNumber
                    ? `${donor.taxIdType ?? 'PAN'} · ${donor.taxIdNumber}`
                    : 'None recorded'
                }
                mono
              />
              <Row
                label="Registered Address"
                value={
                  [
                    donor.addressLine1,
                    donor.addressLine2,
                    donor.city,
                    donor.state,
                    donor.postalCode,
                    donor.country,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'None recorded'
                }
              />
              <Row label="Internal Staff Notes" value={donor.internalNotes ?? '—'} />
            </dl>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-muted/10 p-5">
          <div className="flex items-center gap-3">
            <Lock className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <p className="text-caption text-muted-foreground">
              Statutory tax ID and address records are restricted. They require the sensitive{' '}
              <code>donor.read_sensitive</code> permission with recent re-authentication.
            </p>
          </div>
        </Card>
      )}

      {/* Donor Record Correction Form (Audit-logged) */}
      {canUpdate ? (
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <div className="flex items-center gap-2">
              <UserCog className="text-primary size-5" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">Correct Donor Record</CardTitle>
            </div>
            <p className="text-caption text-muted-foreground mt-1">
              Updates to donor profile details are recorded in the immutable audit log with a
              mandatory justification reason.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <DonorCorrectionForm donor={donor} />
          </CardContent>
        </Card>
      ) : null}

      {/* Donations History */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <div className="flex items-center gap-2">
            <History className="text-primary size-5" aria-hidden="true" />
            <CardTitle className="text-base font-semibold">Donation History</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {donor.donations.length === 0 ? (
            <p className="text-body-sm text-muted-foreground p-6 text-center">
              No completed donations on record for this donor.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donor.donations.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell>
                        <Link
                          href={`/admin/donations/${donation.id}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {donation.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {donation.campaignTitle ?? 'General Foundation'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(donation.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={donation.status === 'successful' ? 'success' : 'neutral'}
                          className="text-xs capitalize"
                        >
                          {donation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-caption text-muted-foreground">
                        {formatDate(donation.donationDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-caption text-muted-foreground shrink-0 font-medium">{label}</dt>
      <dd
        {...(mono ? { 'data-numeric': '' } : {})}
        className="text-body-sm text-foreground min-w-0 break-words text-right font-medium"
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}
