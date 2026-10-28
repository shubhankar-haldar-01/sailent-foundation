import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

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

import { RangePicker, Stat } from '@/components/admin/report-controls';
import { AdminApiError, reconciliationReport } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getTime() - 89 * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(today) };
}

/**
 * Reconciliation.
 *
 * Operational monitoring for payment reconciliation queues.
 */
export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const fallback = defaultRange();
  const range = { from: params.from || fallback.from, to: params.to || fallback.to };

  let report;
  try {
    report = await reconciliationReport(range);
  } catch (error) {
    return (
      <div className="p-6">
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {error instanceof AdminApiError
            ? error.message
            : 'Could not build reconciliation report.'}
        </p>
      </div>
    );
  }

  const { summary } = report;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Monitor automated payment reconciliation between Razorpay gateway settlements and database donation records."
      />

      {/* Date Range Selector */}
      <Card className="border-border">
        <CardContent className="p-4">
          <RangePicker from={range.from} to={range.to} />
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Pending Checkouts"
          value={summary.pending}
          hint={formatCurrency(summary.pendingPaise)}
        />
        <Stat
          label="Stuck Over 1 Hour"
          value={summary.stuckOverAnHour}
          hint="Delayed beyond normal gateway webhook threshold"
        />
        <Stat
          label="Failed Sessions"
          value={summary.failed}
          hint="Gateway rejected or donor aborted"
        />
        <Stat
          label="Missing Receipt"
          value={summary.capturedWithoutReceipt}
          hint="Integrity check (must always be zero)"
        />
      </div>

      {summary.capturedWithoutReceipt > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-body-sm text-destructive font-semibold">
                Critical Integrity Alert: Captured donation missing receipt number
              </p>
              <p className="text-body-sm text-muted-foreground mt-1">
                Receipt numbers are allocated inside the payment-capture transaction from the
                gapless financial book. This number is non-zero, indicating a failed transaction
                step. Notify an engineer immediately before resolving pending payments.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Oldest Unresolved Queue */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <div className="flex items-center gap-2">
            <Clock className="text-primary size-5" aria-hidden="true" />
            <CardTitle className="text-base font-semibold">Oldest Unresolved Checkouts</CardTitle>
          </div>
          <p className="text-caption text-muted-foreground mt-1">
            Checkouts within the selected range that have not settled or cancelled.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {report.oldestUnresolved.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="text-success/80 mx-auto size-8" aria-hidden="true" />
              <p className="text-body-sm text-foreground mt-2 font-medium">
                All checkout sessions within this range are reconciled.
              </p>
              <p className="text-caption text-muted-foreground mt-0.5">
                No stuck transactions found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Checkout Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.oldestUnresolved.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/admin/donations/${row.id}`}
                          className="text-primary font-mono text-xs font-semibold hover:underline"
                        >
                          {row.reference}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning" className="text-xs capitalize">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-foreground text-right font-semibold tabular-nums">
                        {formatCurrency(row.amountPaise)}
                      </TableCell>
                      <TableCell className="text-caption text-muted-foreground">
                        {formatDate(row.donationDate)}
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
