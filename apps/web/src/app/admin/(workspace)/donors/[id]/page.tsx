import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

import { Card, formatCurrency, formatDate } from '@sailent/ui';

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
 * ══════════════════════════════════════════════════════════════════════════
 * THE DRIFT BANNER IS THE POINT OF THIS SCREEN.
 *
 * `totalDonated` and `donationCount` on the donor row are CACHES, written
 * inside the payment-capture transaction (decision A6). Everything else in the
 * platform reads them. This is the one place that also re-derives them from the
 * donations table and shows both — because this is where somebody comes when
 * they suspect the cache is wrong, and a screen that read the cache would just
 * confirm it to itself.
 *
 * When they disagree, that is a reconciliation job, not something to fix by
 * typing a number in: there is deliberately no way to edit either figure, here
 * or anywhere.
 * ══════════════════════════════════════════════════════════════════════════
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
  const drifted =
    donor.recomputed.totalDonated !== donor.totalDonated ||
    donor.recomputed.donationCount !== donor.donationCount;

  return (
    <div className="space-y-8">
      <Link
        href="/admin/donors"
        className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All donors
      </Link>

      <header>
        <h1 className="text-h1 font-semibold">{name}</h1>
        <p data-numeric="" className="text-body-sm text-muted-foreground mt-1">
          {donor.donorCode ?? '—'} · since {formatDate(donor.createdAt)}
        </p>
      </header>

      {drifted ? (
        <Card className="border-warning/40 bg-warning-subtle/40 flex gap-3 p-4">
          <AlertTriangle
            className="text-warning-foreground mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-body-sm font-semibold">Cached totals do not match the donations</p>
            <p className="text-body-sm text-muted-foreground mt-1">
              The donor record says {formatCurrency(donor.totalDonated)} across{' '}
              {donor.donationCount}; the donations table sums to{' '}
              {formatCurrency(donor.recomputed.totalDonated)} across{' '}
              {donor.recomputed.donationCount}. These figures are written only by payment capture,
              so a mismatch is a reconciliation job — there is no way to correct it by hand, and
              there should not be.
            </p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <dl className="divide-border divide-y">
            <Row label="Email" value={donor.email ?? '—'} />
            <Row label="Phone" value={donor.phone ?? '—'} mono />
            <Row label="Type" value={donor.donorType} />
            <Row label="Public listing" value={donor.isAnonymous ? 'Anonymous' : 'Named'} />
            <Row label="Source" value={donor.source ?? '—'} />
          </dl>
        </Card>

        <Card>
          <dl className="divide-border divide-y">
            <Row label="Total given" value={formatCurrency(donor.totalDonated)} mono />
            <Row label="Donations" value={String(donor.donationCount)} mono />
            <Row
              label="First gift"
              value={donor.firstDonatedAt ? formatDate(donor.firstDonatedAt) : '—'}
            />
            <Row
              label="Last gift"
              value={donor.lastDonatedAt ? formatDate(donor.lastDonatedAt) : '—'}
            />
            <Row label="Tax id on file" value={donor.hasTaxId ? 'Yes' : 'No'} />
          </dl>
        </Card>
      </div>

      {/* Sensitive block — present only when the API returned it. --------- */}
      {sensitive ? (
        <section aria-labelledby="sensitive-heading">
          <h2 id="sensitive-heading" className="text-h3 font-semibold">
            Address and tax identification
          </h2>
          <p className="text-body-sm text-muted-foreground mt-1">
            Visible because you hold <code>donor.read_sensitive</code>. Needed for the annual Form
            10BD filing.
          </p>
          <Card className="mt-3">
            <dl className="divide-border divide-y">
              <Row
                label="Tax id"
                value={donor.taxIdNumber ? `${donor.taxIdType ?? '—'} · ${donor.taxIdNumber}` : '—'}
                mono
              />
              <Row
                label="Address"
                value={
                  [
                    donor.addressLine1,
                    donor.addressLine2,
                    donor.city,
                    donor.state,
                    donor.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              <Row label="Internal notes" value={donor.internalNotes ?? '—'} />
            </dl>
          </Card>
        </section>
      ) : null}

      {/* Preferences ------------------------------------------------------ */}
      <section aria-labelledby="prefs-heading">
        <h2 id="prefs-heading" className="text-h3 font-semibold">
          Communication preferences
        </h2>
        <p className="text-body-sm text-muted-foreground mt-1">
          Set by the donor. Shown here so you can see why a message did or did not reach them — they
          are not editable from this screen.
        </p>
        <Card className="mt-3">
          <dl className="divide-border divide-y">
            <Row label="Consents to contact" value={donor.communicationConsent ? 'Yes' : 'No'} />
            <Row
              label="Channels"
              value={
                [
                  donor.emailOptIn && 'Email',
                  donor.smsOptIn && 'SMS',
                  donor.whatsappOptIn && 'WhatsApp',
                ]
                  .filter(Boolean)
                  .join(', ') || 'None'
              }
            />
            <Row
              label="Topics"
              value={
                [
                  donor.notifyCampaignUpdates && 'Campaign updates',
                  donor.notifyImpactUpdates && 'Impact reports',
                  donor.notifyNewsletter && 'Newsletter',
                ]
                  .filter(Boolean)
                  .join(', ') || 'None'
              }
            />
          </dl>
        </Card>
      </section>

      {/* Giving history --------------------------------------------------- */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-h3 font-semibold">
          Giving history
        </h2>
        {donor.donations.length === 0 ? (
          <p className="text-body-sm text-muted-foreground border-border mt-3 rounded-lg border border-dashed px-6 py-8 text-center">
            No donations recorded.
          </p>
        ) : (
          <ul className="border-border divide-border mt-3 divide-y rounded-lg border">
            {donor.donations.map((donation) => (
              <li key={donation.id}>
                <Link
                  href={`/admin/donations/${donation.id}`}
                  className="hover:bg-muted/40 flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="text-body-sm block truncate font-medium">
                      {donation.campaignTitle ?? 'General fund'}
                    </span>
                    <span data-numeric="" className="text-caption text-muted-foreground">
                      {donation.reference} · {formatDate(donation.donationDate)} · {donation.status}
                    </span>
                  </span>
                  <span data-numeric="" className="text-body-sm shrink-0 font-medium tabular-nums">
                    {formatCurrency(donation.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {can(actor, 'donor.update') ? <DonorCorrectionForm donor={donor} /> : null}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-caption text-muted-foreground shrink-0">{label}</dt>
      <dd
        {...(mono ? { 'data-numeric': '' } : {})}
        className="text-body-sm min-w-0 break-words text-right"
      >
        {value}
      </dd>
    </div>
  );
}
