import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatCurrency, formatDate } from '@sailent/ui';

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
 * ══════════════════════════════════════════════════════════════════════════
 * THE LINE ITEMS ARE THE HISTORICAL RECORD.
 *
 * Every price shown is the SNAPSHOT taken when the donor paid, read from the
 * donation's own rows. It is not a join onto the catalogue and it does not
 * change when a product is repriced. A donation from March reads what March
 * charged, forever, and that is the difference between a receipt and a guess.
 * ══════════════════════════════════════════════════════════════════════════
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
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/donations"
          className="text-body-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Donations
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 data-numeric="" className="font-display text-h1 font-bold tracking-tight">
            {donation.reference}
          </h1>
          <span className="text-body-sm text-muted-foreground capitalize">
            {donation.status.replace('_', ' ')} · {donation.donationType}
          </span>
        </div>
        <p data-numeric="" className="font-display text-h2 mt-2 font-bold tabular-nums">
          {formatCurrency(donation.amount)}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="what-was-funded" className="space-y-4">
          <h2 id="what-was-funded" className="text-h3 font-semibold">
            What was funded
          </h2>
          <p className="text-body-sm text-muted-foreground">
            These are the prices the donor was charged, stored on the donation. Repricing the
            product or the campaign does not change them.
          </p>
          <ul className="border-border divide-border divide-y rounded-lg border">
            {donation.items.map((item, index) => (
              <li
                key={`${item.itemName}-${index}`}
                className="flex items-baseline justify-between gap-4 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="text-body-sm block font-medium">{item.itemName}</span>
                  <span className="text-caption text-muted-foreground">
                    {item.itemType === 'custom'
                      ? 'Additional amount'
                      : `${item.quantity} × ${formatCurrency(item.unitPrice)}`}
                  </span>
                </span>
                <span data-numeric="" className="text-body-sm shrink-0 tabular-nums">
                  {formatCurrency(item.totalPrice)}
                </span>
              </li>
            ))}
          </ul>

          {donation.campaignSlug ? (
            <p className="text-body-sm">
              Campaign:{' '}
              <Link
                href={`/campaigns/${donation.campaignSlug}`}
                className="underline underline-offset-4"
              >
                {donation.campaignTitle}
              </Link>
            </p>
          ) : null}

          {donation.donorMessage ? (
            <blockquote className="border-border text-body-sm text-muted-foreground border-l-2 pl-4">
              “{donation.donorMessage}”
            </blockquote>
          ) : null}
        </section>

        <div className="space-y-8">
          <section aria-labelledby="donor" className="space-y-3">
            <h2 id="donor" className="text-h3 font-semibold">
              Donor
            </h2>
            {donation.donorName === null ? (
              <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-4">
                Donor identity is hidden. It needs the <code>donation.read_pii</code> permission,
                which is sensitive and requires a recent re-authentication.
              </p>
            ) : (
              <dl className="border-border divide-border divide-y rounded-lg border">
                <Row label="Name" value={donation.donorName} />
                <Row label="Email" value={donation.donorEmail} />
                <Row label="Phone" value={donation.donorPhone} />
                {donation.anonymous ? (
                  <Row label="Public display" value="Anonymous (finance can still identify them)" />
                ) : null}
              </dl>
            )}
          </section>

          <section aria-labelledby="payment" className="space-y-3">
            <h2 id="payment" className="text-h3 font-semibold">
              Payment
            </h2>
            {donation.payment === null ? (
              <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-4">
                Payment details are hidden. They need the <code>payment.read</code> permission.
              </p>
            ) : (
              <dl className="border-border divide-border divide-y rounded-lg border">
                <Row label="State" value={donation.payment.status} />
                <Row label="Razorpay order" value={donation.payment.providerOrderId} mono />
                <Row label="Razorpay payment" value={donation.payment.providerPaymentId} mono />
                <Row label="Method" value={donation.payment.method} />
                {donation.payment.cardLast4 ? (
                  <Row
                    label="Card"
                    value={`${donation.payment.cardNetwork ?? 'Card'} ending ${donation.payment.cardLast4}`}
                  />
                ) : null}
                <Row
                  label="Paid at"
                  value={donation.payment.paidAt ? formatDate(donation.payment.paidAt) : null}
                />
                {donation.payment.fee !== null ? (
                  <Row label="Provider fee" value={formatCurrency(donation.payment.fee)} />
                ) : null}
                {/*
                  FCRA: the organisation is not registered to accept foreign
                  contributions, so one received in error has to be spotted and
                  returned rather than kept.
                */}
                {donation.payment.isInternational ? (
                  <Row label="⚠ International" value="Foreign contribution — review under FCRA" />
                ) : null}
                {donation.payment.failureReason ? (
                  <Row label="Failure" value={donation.payment.failureReason} />
                ) : null}
              </dl>
            )}
          </section>

          <section aria-labelledby="receipt" className="space-y-3">
            <h2 id="receipt" className="text-h3 font-semibold">
              Receipt
            </h2>
            {donation.receiptNumber ? (
              <dl className="border-border divide-border divide-y rounded-lg border">
                <Row label="Number" value={donation.receiptNumber} mono />
                <Row
                  label="Issued"
                  value={donation.receiptIssuedAt ? formatDate(donation.receiptIssuedAt) : null}
                />
              </dl>
            ) : (
              <p className="text-body-sm text-muted-foreground">
                No receipt — one is issued when a payment is captured.
              </p>
            )}
            <p className="text-caption text-muted-foreground">
              A receipt acknowledges a payment. It is not an 80G certificate: that is Form 10BE,
              issued by the Income Tax Department after the annual Form 10BD filing.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-caption text-muted-foreground shrink-0">{label}</dt>
      <dd
        {...(mono ? { 'data-numeric': '' } : {})}
        className="text-body-sm min-w-0 break-words text-right"
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}
