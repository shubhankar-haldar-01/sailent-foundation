import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CreditCard, FileCheck2, HeartHandshake, User } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatCurrency,
  formatDate,
  PageHeader,
} from '@sailent/ui';

import { DonationStatusBadge } from '@/components/admin/donations-table';
import { AdminApiError, adminFetch } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

interface DonationDetail {
  id: string;
  reference: string;
  status: string;
  donationType: string;
  amount: number;
  anonymous: boolean;
  donorMessage: string | null;
  source: string | null;
  ipCountry: string | null;
  createdAt: string;
  completedAt: string | null;
  failedReason: string | null;
  campaignTitle: string | null;
  campaignSlug: string | null;
  receiptNumber: string | null;
  receiptIssuedAt: string | null;
  donorName: string | null;
  donorEmail: string | null;
  donorPhone: string | null;
  items: {
    itemType: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  payment: {
    provider: string;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    status: string;
    method: string | null;
    cardLast4: string | null;
    cardNetwork: string | null;
    isInternational: boolean;
    fee: number | null;
    paidAt: string | null;
    failureReason: string | null;
    errorCode: string | null;
  } | null;
}

/**
 * One donation.
 *
 * Line items are historical snapshots. Prices reflect what was charged at payment time.
 */
export default async function AdminDonationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let donation: DonationDetail;
  try {
    donation = await adminFetch<DonationDetail>(`admin/donations/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={donation.reference}
        breadcrumb={
          <Link
            href="/admin/donations"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to donations
          </Link>
        }
        status={<DonationStatusBadge status={donation.status} />}
        description={`Recorded on ${formatDate(donation.createdAt)} · Type: ${donation.donationType}`}
      />

      {/* Top Highlight Summary Card */}
      <Card className="bg-surface/80 border-border">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-caption text-muted-foreground font-semibold uppercase tracking-wider">
                Total Donation Amount
              </p>
              <p
                data-numeric=""
                className="font-display text-h1 text-foreground mt-1 font-bold tabular-nums tracking-tight"
              >
                {formatCurrency(donation.amount)}
              </p>
              {donation.completedAt ? (
                <p className="text-caption text-muted-foreground mt-0.5">
                  Completed on {formatDate(donation.completedAt)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {donation.donationType} gift
              </Badge>
              {donation.anonymous ? <Badge variant="neutral">Anonymous to public</Badge> : null}
              {donation.receiptNumber ? (
                <Badge variant="success" className="font-mono text-xs">
                  Receipt #{donation.receiptNumber}
                </Badge>
              ) : (
                <Badge variant="neutral">No receipt</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left Column: What was funded */}
        <section aria-labelledby="what-was-funded" className="space-y-6">
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <HeartHandshake className="text-primary size-5" aria-hidden="true" />
                <CardTitle id="what-was-funded" className="text-base font-semibold">
                  What Was Funded
                </CardTitle>
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                Historical snapshot recorded at capture. Repricing products does not alter this
                record.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-border divide-y">
                {donation.items.map((item, index) => (
                  <li
                    key={`${item.itemName}-${index}`}
                    className="hover:bg-muted/20 flex items-baseline justify-between gap-4 px-5 py-3.5 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-body-sm text-foreground block font-medium">
                        {item.itemName}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {item.itemType === 'custom'
                          ? 'Additional custom gift'
                          : `${item.quantity} × ${formatCurrency(item.unitPrice)}`}
                      </span>
                    </div>
                    <span
                      data-numeric=""
                      className="text-body-sm text-foreground shrink-0 font-semibold tabular-nums"
                    >
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </li>
                ))}
              </ul>

              {donation.campaignTitle ? (
                <div className="border-border bg-muted/20 flex items-center justify-between gap-2 border-t px-5 py-3">
                  <span className="text-caption text-muted-foreground">Associated campaign:</span>
                  {donation.campaignSlug ? (
                    <Link
                      href={`/campaigns/${donation.campaignSlug}`}
                      className="text-body-sm text-primary font-medium hover:underline"
                    >
                      {donation.campaignTitle}
                    </Link>
                  ) : (
                    <span className="text-body-sm font-medium">{donation.campaignTitle}</span>
                  )}
                </div>
              ) : null}

              {donation.donorMessage ? (
                <div className="border-border bg-muted/10 border-t p-5">
                  <p className="text-caption text-muted-foreground mb-1 font-semibold uppercase">
                    Donor Note
                  </p>
                  <blockquote className="border-primary/40 text-body-sm text-foreground/90 border-l-2 pl-3 italic">
                    “{donation.donorMessage}”
                  </blockquote>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* Right Column: Donor, Payment, Receipt */}
        <div className="space-y-6">
          {/* Donor Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <User className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">Donor Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {donation.donorName === null ? (
                <div className="p-5">
                  <p className="border-border text-caption text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                    Donor identity is protected. It requires sensitive permission{' '}
                    <code>donation.read_pii</code> with recent re-authentication.
                  </p>
                </div>
              ) : (
                <dl className="divide-border divide-y">
                  <Row label="Name" value={donation.donorName} />
                  <Row label="Email" value={donation.donorEmail} />
                  <Row label="Phone" value={donation.donorPhone} />
                  {donation.anonymous ? (
                    <Row
                      label="Public preference"
                      value="Anonymous to public (finance retains record)"
                    />
                  ) : null}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Payment Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">
                  Payment Gateway Transaction
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {donation.payment === null ? (
                <div className="p-5">
                  <p className="border-border text-caption text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                    Payment details require the <code>payment.read</code> permission.
                  </p>
                </div>
              ) : (
                <dl className="divide-border divide-y">
                  <Row label="Status" value={donation.payment.status} />
                  <Row label="Gateway order" value={donation.payment.providerOrderId} mono />
                  <Row label="Payment ID" value={donation.payment.providerPaymentId} mono />
                  <Row label="Payment method" value={donation.payment.method} />
                  {donation.payment.cardLast4 ? (
                    <Row
                      label="Card"
                      value={`${donation.payment.cardNetwork ?? 'Card'} ending •••• ${donation.payment.cardLast4}`}
                    />
                  ) : null}
                  <Row
                    label="Paid at"
                    value={donation.payment.paidAt ? formatDate(donation.payment.paidAt) : null}
                  />
                  {donation.payment.fee !== null ? (
                    <Row label="Gateway fee" value={formatCurrency(donation.payment.fee)} />
                  ) : null}
                  {donation.payment.isInternational ? (
                    <Row
                      label="⚠ International"
                      value="Foreign contribution — requires FCRA review"
                    />
                  ) : null}
                  {donation.payment.failureReason ? (
                    <Row label="Failure reason" value={donation.payment.failureReason} />
                  ) : null}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Receipt Card */}
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">Payment Receipt</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {donation.receiptNumber ? (
                <dl className="border-border divide-border divide-y rounded-lg border">
                  <Row label="Receipt Number" value={donation.receiptNumber} mono />
                  <Row
                    label="Issued Date"
                    value={donation.receiptIssuedAt ? formatDate(donation.receiptIssuedAt) : null}
                  />
                </dl>
              ) : (
                <p className="text-body-sm text-muted-foreground">
                  No receipt generated. Receipts are numbered and issued from the gapless book upon
                  payment capture.
                </p>
              )}
              <p className="text-caption text-muted-foreground mt-3">
                A receipt acknowledges receipt of funds. Statutory tax deduction certificates (Form
                10BE) are issued annually by the Income Tax Department following Form 10BD filing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
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
