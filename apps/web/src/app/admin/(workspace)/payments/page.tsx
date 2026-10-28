import { AlertTriangle, Clock, Webhook } from 'lucide-react';

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

import { Stat } from '@/components/admin/report-controls';
import { AdminApiError, paymentExceptions, type PaymentExceptions } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  failed: 'Failed — Gateway retrying',
  needs_review: 'Needs review',
  pending: 'Never finished',
};

/**
 * Payment exceptions.
 *
 * What automatic reconciliation could not settle on its own.
 */
export default async function AdminPaymentExceptionsPage() {
  let report: PaymentExceptions;
  try {
    report = await paymentExceptions();
  } catch (error) {
    return (
      <div className="p-6">
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {error instanceof AdminApiError ? error.message : 'Could not load payment exceptions.'}
        </p>
      </div>
    );
  }

  const { summary, thresholds } = report;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment exceptions"
        description={`Unresolved transactions requiring manual operator review. Pending checkouts expire after ${thresholds.expireAfterHours} hours.`}
      />

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Needs review"
          value={summary.needsReview}
          hint="Mismatches, partials and refunds"
        />
        <Stat
          label="Failed webhooks"
          value={summary.failedWebhooks}
          hint="Razorpay delivery retry queue"
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
          label="Overdue checkouts"
          value={summary.overdueDonations}
          hint={`Pending past ${thresholds.expireAfterHours} hours limit`}
        />
        <Stat
          label="Cancelled (7 days)"
          value={summary.cancelledLast7Days}
          hint="Expired unpaid checkouts"
        />
      </div>

      {summary.overdueDonations > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-body-sm text-destructive font-semibold">
                Overdue checkout sessions detected
              </p>
              <p className="text-body-sm text-muted-foreground mt-1">
                Some donations have remained pending past the expiry threshold. Reconciliation
                preserves pending status if Razorpay holds a captured payment that has not yet
                linked to the database, or if the background worker queue is delayed. Verify the
                payment IDs in the Razorpay dashboard.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Webhook Events Table */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <div className="flex items-center gap-2">
            <Webhook className="text-primary size-5" aria-hidden="true" />
            <CardTitle className="text-base font-semibold">Webhook Exception Log</CardTitle>
          </div>
          <p className="text-caption text-muted-foreground mt-1">
            Incoming Razorpay event notifications that failed processing or flagged order
            discrepancies.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {report.webhooks.length === 0 ? (
            <p className="text-body-sm text-muted-foreground p-8 text-center">
              All incoming payment webhooks processed successfully. No exceptions pending.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Received</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Payment / Order ID</TableHead>
                    <TableHead>Donation</TableHead>
                    <TableHead>Error Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.webhooks.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-caption text-muted-foreground">
                        {formatDate(row.receivedAt)}
                      </TableCell>
                      <TableCell className="text-foreground font-mono text-xs">
                        {row.eventType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.processingStatus === 'failed' ? 'destructive' : 'warning'}
                          className="text-xs capitalize"
                        >
                          {STATUS_LABELS[row.processingStatus] ?? row.processingStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-caption font-mono">
                        <span className="text-foreground block">
                          {row.providerPaymentId ?? '—'}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {row.providerOrderId ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.donationReference ? (
                          <>
                            <span className="text-foreground block font-mono text-xs font-medium">
                              {row.donationReference}
                            </span>
                            <span className="text-caption text-muted-foreground block capitalize">
                              {row.donationStatus}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-caption text-destructive max-w-xs break-words">
                        {row.error ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stuck Donations Table */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <div className="flex items-center gap-2">
            <Clock className="text-primary size-5" aria-hidden="true" />
            <CardTitle className="text-base font-semibold">Stuck Checkout Sessions</CardTitle>
          </div>
          <p className="text-caption text-muted-foreground mt-1">
            Donations awaiting payment confirmation exceeding {thresholds.stuckDonationMinutes}{' '}
            minutes.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {report.stuckDonations.length === 0 ? (
            <p className="text-body-sm text-muted-foreground p-8 text-center">
              No stuck donation sessions detected.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Gateway Order</TableHead>
                    <TableHead>Session Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.stuckDonations.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-foreground font-mono text-xs font-semibold">
                        {row.reference}
                        {row.overdue ? (
                          <Badge
                            variant="destructive"
                            className="ml-2 px-1.5 py-0 text-[0.625rem] font-semibold"
                          >
                            Overdue
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.campaignTitle ?? 'General Foundation'}
                      </TableCell>
                      <TableCell className="text-foreground text-right font-semibold tabular-nums">
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {row.providerOrderId ?? 'No order created'}
                      </TableCell>
                      <TableCell className="text-caption text-muted-foreground">
                        {formatDate(row.createdAt)}
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
