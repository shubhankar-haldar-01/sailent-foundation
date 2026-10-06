import { formatCurrency, formatDate } from '@sailent/ui';

import { Stat } from '@/components/admin/report-controls';
import { AdminApiError, paymentExceptions, type PaymentExceptions } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  failed: 'Failed — Razorpay is retrying',
  needs_review: 'Needs review',
  pending: 'Never finished',
};

/**
 * Payment exceptions (Phase 11).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT NEEDS A HUMAN, AND NOTHING THAT CHANGES A PAYMENT.
 *
 * Reconciliation runs on its own every few minutes: it records payments
 * Razorpay confirms and cancels checkouts nobody paid for. What is left here
 * is what it cannot decide — a webhook that failed or never finished, an event
 * flagged because an amount, currency or order did not match or a refund was
 * raised in the Razorpay dashboard, and a donation still pending well after it
 * should have settled.
 *
 * There is no button to mark anything successful. A donation becomes
 * successful only on a payment Razorpay confirms; look each one up in the
 * Razorpay dashboard by its payment or order id.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminPaymentExceptionsPage() {
  let report: PaymentExceptions;
  try {
    report = await paymentExceptions();
  } catch (error) {
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load payment exceptions.'}
      </p>
    );
  }

  const { summary, thresholds } = report;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Payment exceptions</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          What reconciliation could not settle on its own. Nothing here changes a payment: look each
          one up in the Razorpay dashboard by its payment or order id. Pending donations are checked
          against Razorpay after {thresholds.reconcileAfterMinutes} minutes and cancelled after{' '}
          {thresholds.expireAfterHours} hours if nothing was paid.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Needs review" value={summary.needsReview} hint="Mismatches and refunds" />
        <Stat
          label="Failed webhooks"
          value={summary.failedWebhooks}
          hint="Razorpay retries these"
        />
        <Stat
          label="Unfinished webhooks"
          value={summary.unfinishedWebhooks}
          hint={`Pending over ${thresholds.unfinishedWebhookMinutes} minutes`}
        />
        <Stat
          label="Stuck donations"
          value={summary.stuckDonations}
          hint={`Pending over ${thresholds.stuckDonationMinutes} minutes`}
        />
        <Stat
          label="Overdue"
          value={summary.overdueDonations}
          hint={`Pending past ${thresholds.expireAfterHours} hours`}
        />
        <Stat label="Cancelled (7 days)" value={summary.cancelledLast7Days} hint="Expired unpaid" />
      </div>

      {summary.overdueDonations > 0 ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm rounded-lg border p-4"
        >
          Some donations are still pending past the expiry cutoff. Reconciliation leaves a donation
          pending when Razorpay holds a captured or authorised payment it could not record, or when
          it is not running. Check each one in the Razorpay dashboard, and check that the worker is
          running.
        </p>
      ) : null}

      <section aria-labelledby="webhook-exceptions" className="space-y-3">
        <h2 id="webhook-exceptions" className="text-h3 font-semibold">
          Webhook events
        </h2>
        {report.webhooks.length === 0 ? (
          <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            No webhook needs attention.
          </p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[52rem] text-left">
              <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Received
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    State
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Payment / order
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Donation
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {report.webhooks.map((row) => (
                  <tr key={row.id}>
                    <td className="text-body-sm text-muted-foreground px-4 py-2">
                      {formatDate(row.receivedAt)}
                    </td>
                    <td className="text-body-sm px-4 py-2 font-mono">{row.eventType}</td>
                    <td className="text-body-sm px-4 py-2">
                      {STATUS_LABELS[row.processingStatus] ?? row.processingStatus}
                    </td>
                    <td className="text-caption px-4 py-2 font-mono">
                      <span className="block">{row.providerPaymentId ?? '—'}</span>
                      <span className="text-muted-foreground block">
                        {row.providerOrderId ?? '—'}
                      </span>
                    </td>
                    <td className="text-body-sm px-4 py-2">
                      {row.donationReference ? (
                        <>
                          <span className="block font-mono">{row.donationReference}</span>
                          <span className="text-caption text-muted-foreground block">
                            {row.donationStatus}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-caption text-muted-foreground max-w-xs px-4 py-2">
                      {row.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="stuck-donations" className="space-y-3">
        <h2 id="stuck-donations" className="text-h3 font-semibold">
          Stuck donations
        </h2>
        {report.stuckDonations.length === 0 ? (
          <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            No donation has been pending for more than {thresholds.stuckDonationMinutes} minutes.
          </p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[44rem] text-left">
              <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Campaign
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Razorpay order
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {report.stuckDonations.map((row) => (
                  <tr key={row.id}>
                    <td className="text-body-sm px-4 py-2 font-mono">
                      {row.reference}
                      {row.overdue ? (
                        <span className="text-caption text-destructive ml-2 font-sans font-semibold">
                          Overdue
                        </span>
                      ) : null}
                    </td>
                    <td className="text-body-sm px-4 py-2">{row.campaignTitle ?? '—'}</td>
                    <td className="text-body-sm px-4 py-2 tabular-nums">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="text-caption px-4 py-2 font-mono">
                      {row.providerOrderId ?? 'No order'}
                    </td>
                    <td className="text-body-sm text-muted-foreground px-4 py-2">
                      {formatDate(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
