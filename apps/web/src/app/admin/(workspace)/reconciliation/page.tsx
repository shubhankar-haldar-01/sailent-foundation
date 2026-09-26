import { formatCurrency, formatDate } from '@sailent/ui';

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
 * ══════════════════════════════════════════════════════════════════════════
 * IT ANSWERS ONE QUESTION: WHAT NEEDS A HUMAN?
 *
 * A donation sits `pending` between the donor pressing pay and a
 * signature-verified webhook moving it forward (decision A3). Most resolve in
 * seconds. The ones that do not are either an abandoned checkout or money that
 * arrived and was never recorded — and from here those look identical, which
 * is exactly why somebody has to look rather than the platform guessing.
 *
 * Nothing on this screen changes a payment. Moving money is the webhook's job
 * and only the webhook's; a button here that marked a donation successful
 * would be a button that takes an unverified word for it.
 * ══════════════════════════════════════════════════════════════════════════
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
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not build that report.'}
      </p>
    );
  }

  const { summary } = report;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Reconciliation</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          What is unresolved. A donation only becomes successful on a verified webhook, so anything
          still pending is either an abandoned checkout or money that needs chasing — and nothing on
          this page can tell them apart for you.
        </p>
      </header>

      <RangePicker from={range.from} to={range.to} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending" value={summary.pending} hint={formatCurrency(summary.pendingPaise)} />
        <Stat
          label="Stuck over an hour"
          value={summary.stuckOverAnHour}
          hint="Long past a slow webhook"
        />
        <Stat label="Failed" value={summary.failed} />
        <Stat
          label="Captured without a receipt"
          value={summary.capturedWithoutReceipt}
          hint="Should always be zero"
        />
      </div>

      {summary.capturedWithoutReceipt > 0 ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm rounded-lg border p-4"
        >
          A receipt number is allocated inside the same transaction that captures a payment, so this
          figure should be zero. It is not. Tell an engineer before reconciling anything else.
        </p>
      ) : null}

      <section aria-labelledby="unresolved" className="space-y-3">
        <h2 id="unresolved" className="text-h3 font-semibold">
          Oldest unresolved
        </h2>
        {report.oldestUnresolved.length === 0 ? (
          <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            Nothing is pending in this range.
          </p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] text-left">
              <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    State
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Given
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {report.oldestUnresolved.map((row) => (
                  <tr key={row.id}>
                    <td className="text-body-sm px-4 py-2 font-mono">{row.reference}</td>
                    <td className="text-body-sm px-4 py-2">{row.status}</td>
                    <td className="text-body-sm px-4 py-2 tabular-nums">
                      {formatCurrency(row.amountPaise)}
                    </td>
                    <td className="text-body-sm text-muted-foreground px-4 py-2">
                      {formatDate(row.donationDate)}
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
