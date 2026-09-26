import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Card, formatCurrency, formatDate } from '@sailent/ui';

import { PrintButton } from '@/components/dashboard/print-button';
import { DonorApiError, donorFetch, type DonorReceipt } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Receipt',
  path: '/dashboard/donations',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * A receipt.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A RECEIPT IS NOT AN 80G CERTIFICATE, AND THIS PAGE SAYS SO IN WORDS.
 *
 * Decision A7. Relief under Section 80G is granted through Form 10BE, which the
 * Income Tax Department issues to the donor AFTER this organisation files its
 * annual Form 10BD — months later, by a different party. A receipt that lets
 * somebody believe it is the tax document is a claim this platform cannot
 * honour, made to someone who may act on it at filing time.
 *
 * So the distinction is stated on the receipt itself, not buried in an FAQ.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * PRINTING IS THE EXPORT. There is no PDF generator yet, and a browser's own
 * "save as PDF" produces a perfectly good document from a page designed to
 * print — which this one is. Shipping a print stylesheet now is better than
 * shipping a "download" button that does not work.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let receipt: DonorReceipt;
  try {
    receipt = await donorFetch<DonorReceipt>(`me/donations/${id}/receipt`);
  } catch (error) {
    if (error instanceof DonorApiError && error.status === 404) notFound();
    throw error;
  }

  const lineItems = Array.isArray(receipt.lineItems) ? receipt.lineItems : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/donations/${id}`}
          className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex items-center gap-1.5 rounded-sm focus-visible:outline-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to donation
        </Link>
        <PrintButton />
      </div>

      <Card className="p-6 md:p-8">
        <header className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-caption text-muted-foreground font-semibold uppercase tracking-wide">
              Receipt
            </p>
            <p data-numeric="" className="text-h2 mt-1 font-bold">
              {receipt.receiptNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-body-sm font-semibold">Sailent Foundation</p>
            {receipt.registrationNumber ? (
              <p data-numeric="" className="text-caption text-muted-foreground">
                {receipt.registrationNumber}
              </p>
            ) : null}
          </div>
        </header>

        <dl className="divide-border mt-6 divide-y">
          <Row label="Received from" value={receipt.donorName ?? '—'} />
          <Row label="Date" value={formatDate(receipt.issuedAt)} />
          <Row label="Donation reference" value={receipt.donationReference} mono />
          {receipt.campaignTitle ? <Row label="Towards" value={receipt.campaignTitle} /> : null}
          {receipt.paymentReference ? (
            <Row label="Payment reference" value={receipt.paymentReference} mono />
          ) : null}
        </dl>

        {lineItems.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-body-sm font-semibold">Items</h2>
            <ul className="border-border divide-border mt-2 divide-y rounded-md border">
              {lineItems.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-2.5"
                >
                  <span className="text-body-sm min-w-0">
                    {item.name}
                    {item.quantity > 1 ? (
                      <span data-numeric="" className="text-muted-foreground">
                        {' '}
                        × {item.quantity}
                      </span>
                    ) : null}
                  </span>
                  <span data-numeric="" className="text-body-sm shrink-0 tabular-nums">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-border mt-6 flex items-baseline justify-between border-t pt-4">
          <span className="text-body font-semibold">Total received</span>
          <span data-numeric="" className="text-h3 font-bold tabular-nums">
            {formatCurrency(receipt.amount)}
          </span>
        </div>

        <p className="text-caption text-muted-foreground border-border mt-6 border-t pt-4 leading-relaxed">
          <strong className="text-foreground">This is a receipt, not a tax certificate.</strong> It
          acknowledges that we received your payment. Relief under Section 80G is granted through
          Form 10BE, which the Income Tax Department issues after we file our annual statement of
          donations (Form 10BD) by 31 May following the end of the financial year. To be included,
          we need your PAN on your profile.
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
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
