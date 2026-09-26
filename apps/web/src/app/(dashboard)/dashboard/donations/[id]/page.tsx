import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt } from 'lucide-react';

import { Button, Card, formatCurrency, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/dashboard/status-pill';
import { DonorApiError, donorFetch, type DonorDonationDetail } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Donation',
  path: '/dashboard/donations',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * One donation.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A DONATION THAT IS NOT YOURS IS A 404 HERE, BECAUSE IT IS A 404 AT THE API.
 *
 * This page does no ownership check of its own and must not be given one. The
 * API scopes the query by the session's donor id, so somebody else's donation
 * does not come back as forbidden — it does not come back at all. Adding a
 * check here would imply the API's is optional.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE PRICES ARE THE ONES THAT WERE CHARGED. Line items carry the price
 * snapshotted at the moment of giving (decision A5), so a later catalogue
 * change never rewrites what this page says. A donation from March reads what
 * March charged, forever.
 */
export default async function DonationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let donation: DonorDonationDetail;
  try {
    donation = await donorFetch<DonorDonationDetail>(`me/donations/${id}`);
  } catch (error) {
    if (error instanceof DonorApiError && error.status === 404) notFound();
    throw error;
  }

  const productLines = donation.items.filter((item) => item.itemType === 'product');
  const customLines = donation.items.filter((item) => item.itemType === 'custom');

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/donations"
        className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex items-center gap-1.5 rounded-sm focus-visible:outline-2"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All donations
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">{formatCurrency(donation.amount)}</h1>
          <p className="text-body text-muted-foreground mt-1">
            {donation.campaignSlug ? (
              <Link
                href={`/campaigns/${donation.campaignSlug}`}
                className="focus-visible:outline-ring rounded-sm hover:underline focus-visible:outline-2"
              >
                {donation.campaignTitle}
              </Link>
            ) : (
              (donation.campaignTitle ?? 'General fund')
            )}
          </p>
        </div>
        <StatusPill status={donation.status} />
      </header>

      {/* A failed donation needs saying, not hiding. */}
      {donation.status === 'failed' ? (
        <Card className="border-destructive/30 bg-destructive-subtle/40 p-4">
          <p className="text-body-sm">
            This payment did not go through, so nothing was charged. If your bank shows an amount
            held against it, they release it themselves, usually within a few working days.
          </p>
        </Card>
      ) : null}

      {/* `dl`, not a bare div: `dt`/`dd` outside a description list are invalid
          and screen readers stop pairing the label with its value. */}
      <Card>
        <dl className="divide-border divide-y">
          <Row label="Reference" value={donation.reference} mono />
          <Row label="Date" value={formatDate(donation.donationDate)} />
          {donation.completedAt ? (
            <Row label="Confirmed" value={formatDate(donation.completedAt)} />
          ) : null}
          {donation.payment?.method ? (
            <Row
              label="Paid by"
              value={
                donation.payment.cardLast4
                  ? `${donation.payment.method} ending ${donation.payment.cardLast4}`
                  : donation.payment.method
              }
            />
          ) : null}
          {donation.anonymous ? (
            <Row label="Public listing" value="Anonymous — your name is not shown publicly" />
          ) : null}
        </dl>
      </Card>

      {/* What was bought --------------------------------------------------- */}
      {donation.items.length > 0 ? (
        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-h3 font-semibold">
            What this bought
          </h2>
          <ul className="border-border divide-border mt-3 divide-y rounded-lg border">
            {productLines.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="min-w-0">
                  <span className="text-body-sm block font-medium">{item.itemName}</span>
                  <span data-numeric="" className="text-caption text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </span>
                </span>
                <span data-numeric="" className="text-body-sm shrink-0 font-medium tabular-nums">
                  {formatCurrency(item.totalPrice)}
                </span>
              </li>
            ))}
            {customLines.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="text-body-sm font-medium">Additional amount</span>
                <span data-numeric="" className="text-body-sm shrink-0 font-medium tabular-nums">
                  {formatCurrency(item.totalPrice)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground mt-2">
            These are the prices you were charged. They do not change if the campaign later reprices
            an item.
          </p>
        </section>
      ) : null}

      {donation.donorMessage ? (
        <section aria-labelledby="message-heading">
          <h2 id="message-heading" className="text-h3 font-semibold">
            Your message
          </h2>
          <p className="text-body text-muted-foreground mt-2">{donation.donorMessage}</p>
        </section>
      ) : null}

      {donation.receiptNumber ? (
        <Button asChild size="md" variant="secondary">
          <Link href={`/dashboard/donations/${donation.id}/receipt`}>
            <Receipt className="size-4" aria-hidden="true" />
            View receipt {donation.receiptNumber}
          </Link>
        </Button>
      ) : donation.status === 'successful' ? (
        <p className="text-body-sm text-muted-foreground">
          Your receipt is being generated and will appear here shortly.
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
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
