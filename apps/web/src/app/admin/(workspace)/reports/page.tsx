import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  PageHeader,
  Alert,
  formatCurrency,
} from '@sailent/ui';
import { FileSpreadsheet, HeartHandshake, Flag, Users, Activity } from 'lucide-react';
import { EXPORT_DATASET_KEYS, datasetPermission, type ExportDataset } from '@sailent/validation';

import { ExportLinks, RangePicker, Stat } from '@/components/admin/report-controls';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  AdminApiError,
  campaignReport,
  donationReport,
  impactReport,
  volunteerReport,
} from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** The last 30 days, when nobody has said otherwise. */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getTime() - 29 * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(today) };
}

/**
 * Reports.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE HERE IS ADMINISTRATIVE, AND SAYS SO.
 *
 * A14 governs what the public site may claim; this screen is not the public
 * site. It shows pending money, failed payments and applications that were
 * turned down — the things a public "impact" page must never imply. Keeping
 * them apart is why the reports module has no public controller.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    exportError?: string;
    exportMessage?: string;
  }>;
}) {
  const params = await searchParams;
  const fallback = defaultRange();
  const range = { from: params.from || fallback.from, to: params.to || fallback.to };
  const actor = await currentActor();

  // A failed download comes back here as a flag, because a download cannot
  // render a password prompt.
  if (params.exportError === 'REAUTH_REQUIRED') {
    return (
      <ReauthPanel
        returnTo={`/admin/reports?from=${range.from}&to=${range.to}`}
        what="An export is a file of real records leaving the platform."
      />
    );
  }

  let donations;
  let campaigns;
  let volunteers;
  let impact;
  let failure: string | null = null;

  try {
    [donations, campaigns, volunteers, impact] = await Promise.all([
      donationReport(range),
      campaignReport(range),
      volunteerReport(range),
      impactReport(range),
    ]);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return <ReauthPanel returnTo="/admin/reports" what="These are the platform's figures." />;
    }
    failure =
      error instanceof AdminApiError ? error.message : 'Could not build those reports just now.';
  }

  const exportable = EXPORT_DATASET_KEYS.filter((dataset: ExportDataset) => {
    const extra = datasetPermission(dataset);
    return can(actor, 'reports.export') && (!extra || can(actor, extra));
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Administrative reports"
        description="Donations, campaigns, volunteers, and verified impact over selected date range. Figures represent administrative ledger states including pending and reconciling items."
      />

      <Card>
        <CardContent className="p-4">
          <RangePicker from={range.from} to={range.to} />
        </CardContent>
      </Card>

      {params.exportError ? (
        <Alert variant="destructive">
          {params.exportMessage ?? 'That export could not be produced.'}
        </Alert>
      ) : null}

      {failure ? <Alert variant="destructive">{failure}</Alert> : null}

      {donations ? (
        <section aria-labelledby="donations-report" className="space-y-4">
          <div className="flex items-center gap-2">
            <HeartHandshake className="text-primary h-5 w-5" />
            <h2 id="donations-report" className="text-foreground text-lg font-bold">
              Donation Summary
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Captured Funds"
              value={formatCurrency(donations.totals.capturedPaise)}
              hint="Successful payments only"
            />
            <Stat
              label="Total Donations"
              value={donations.totals.donations}
              hint="Across all transaction states"
            />
            <Stat label="Distinct Donors" value={donations.totals.distinctDonors} />
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-border bg-muted/20 border-b px-5 py-3">
              <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Payment State Breakdown
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      Payment State
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Transactions
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Total Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {donations.byStatus.map((row) => (
                    <tr key={row.status} className="hover:bg-muted/30 transition-colors">
                      <td className="text-foreground px-5 py-3 text-xs font-semibold uppercase">
                        {row.status}
                      </td>
                      <td className="text-foreground px-5 py-3 tabular-nums">{row.count}</td>
                      <td className="text-foreground px-5 py-3 font-semibold tabular-nums">
                        {formatCurrency(row.amountPaise)}
                      </td>
                    </tr>
                  ))}
                  {donations.byStatus.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-muted-foreground px-5 py-6 text-center text-xs"
                      >
                        No donation records found in the selected date range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}

      {campaigns ? (
        <section aria-labelledby="campaigns-report" className="space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="text-primary h-5 w-5" />
            <h2 id="campaigns-report" className="text-foreground text-lg font-bold">
              Campaign Performance
            </h2>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      Campaign Title
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Raised in Range
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Donations in Range
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Lifetime Raised
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {campaigns.items.slice(0, 15).map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="text-foreground px-5 py-3 font-medium">{row.title}</td>
                      <td className="text-foreground px-5 py-3 font-semibold tabular-nums">
                        {formatCurrency(row.inRangePaise)}
                      </td>
                      <td className="text-foreground px-5 py-3 tabular-nums">
                        {row.inRangeDonations}
                      </td>
                      <td className="text-muted-foreground px-5 py-3 tabular-nums">
                        {formatCurrency(row.lifetimePaise)}
                      </td>
                    </tr>
                  ))}
                  {campaigns.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-muted-foreground px-5 py-6 text-center text-xs"
                      >
                        No campaign activity found in the selected date range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {volunteers ? (
          <section aria-labelledby="volunteers-report" className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="text-primary h-5 w-5" />
              <h2 id="volunteers-report" className="text-foreground text-lg font-bold">
                Volunteer Activity
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Stat label="Active Volunteers" value={volunteers.standing.activeVolunteers} />
              <Stat
                label="Verified Hours"
                value={volunteers.standing.verifiedHours}
                hint="From validated attendance"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {volunteers.appliedInRange.reduce((total, row) => total + row.count, 0)} new volunteer
              applications submitted in this period.
            </p>
          </section>
        ) : null}

        {impact ? (
          <section aria-labelledby="impact-report" className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="text-primary h-5 w-5" />
              <h2 id="impact-report" className="text-foreground text-lg font-bold">
                Impact Metrics
              </h2>
            </div>

            {impact.items.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="text-muted-foreground p-6 text-center text-xs">
                  No verified impact entries recorded in this range.
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-border divide-y">
                  {impact.items.map((row) => (
                    <li
                      key={row.metricType}
                      className="hover:bg-muted/30 flex items-center justify-between p-4 text-sm transition-colors"
                    >
                      <span className="text-foreground font-medium capitalize">
                        {row.metricType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-foreground font-semibold tabular-nums">
                        {row.total.toLocaleString()}{' '}
                        <span className="text-muted-foreground text-xs font-normal">
                          ({row.published} of {row.records} published)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="text-primary h-4 w-4" />
            Statutory & Operational Data Exports
          </CardTitle>
          <CardDescription>
            Download verifiable CSV records for reconciliation and compliance reporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportLinks from={range.from} to={range.to} allowed={exportable} />
        </CardContent>
      </Card>
    </div>
  );
}
