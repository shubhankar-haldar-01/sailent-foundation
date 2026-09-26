import { formatCurrency } from '@sailent/ui';

import { Stat } from '@/components/admin/report-controls';
import { AdminApiError, taxReadinessReport } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * Form 10BD readiness.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT COUNTS WHAT WOULD BE MISSING. IT FILES NOTHING.
 *
 * Decision A7: the receipt a donor already holds is NOT their 80G certificate.
 * The organisation files Form 10BD by 31 May; the Income Tax Department then
 * issues Form 10BE to the donor. A donation with no donor tax ID cannot go on
 * that return, which means the donor gets no relief — and the time to find
 * that out is while the year is still open, not in May.
 *
 * There is no "generate the return" button, deliberately. `form_10bd_exports`
 * is documented and deferred, and a button that produced an unreviewed
 * statutory filing would be worse than not having one.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminTaxPage({
  searchParams,
}: {
  searchParams: Promise<{ financialYear?: string }>;
}) {
  const params = await searchParams;
  const requested = params.financialYear ? Number(params.financialYear) : undefined;

  let report;
  try {
    report = await taxReadinessReport(Number.isFinite(requested) ? requested : undefined);
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

  const percentReady =
    report.eligible === 0 ? 100 : Math.round((report.ready / report.eligible) * 100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Tax compliance</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          Form 10BD readiness for {report.financialYear}. A receipt is not an 80G certificate — the
          Income Tax Department issues Form 10BE after this return is filed, and a donation with no
          tax ID on file cannot go on it.
        </p>
      </header>

      <p className="border-border bg-muted/40 text-body-sm rounded-lg border p-4">
        <strong>Filing deadline: {report.filingDeadline}.</strong> Anything still missing a tax ID
        by then is a donor who will not receive relief for a gift they already made.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Eligible donations"
          value={report.eligible}
          hint={formatCurrency(report.eligiblePaise)}
        />
        <Stat label="Ready to file" value={report.ready} hint={`${percentReady}% of eligible`} />
        <Stat
          label="Missing a tax ID"
          value={report.missing}
          hint={formatCurrency(report.missingPaise)}
        />
        <Stat label="Donors to chase" value={report.donorsMissingTaxId} />
      </div>

      {report.missing > 0 ? (
        <p
          role="status"
          className="border-warning/40 bg-warning/5 text-body-sm rounded-lg border p-4"
        >
          {report.missing} captured {report.missing === 1 ? 'donation' : 'donations'} worth{' '}
          {formatCurrency(report.missingPaise)} cannot go on the return, across{' '}
          {report.donorsMissingTaxId} {report.donorsMissingTaxId === 1 ? 'donor' : 'donors'}.
          Collecting a PAN from each is what closes that gap.
        </p>
      ) : (
        <p
          role="status"
          className="border-success/40 bg-success/5 text-body-sm rounded-lg border p-4"
        >
          Every eligible donation in {report.financialYear} has a tax ID on file.
        </p>
      )}

      <p className="text-body-sm text-muted-foreground">
        Generating the return itself is not part of this platform. Export the donations for the
        financial year from{' '}
        <a href="/admin/reports" className="hover:text-foreground underline">
          Reports
        </a>{' '}
        and prepare the filing from that.
      </p>
    </div>
  );
}
