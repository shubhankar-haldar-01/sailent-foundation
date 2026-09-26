import { formatCurrency } from '@sailent/ui';
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
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Reports</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          Donations, campaigns, volunteers and impact over a date range. These are internal figures
          — they include pending and failed payments, which the public site never shows.
        </p>
      </header>

      <RangePicker from={range.from} to={range.to} />

      {params.exportError ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {params.exportMessage ?? 'That export could not be produced.'}
        </p>
      ) : null}

      {failure ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {failure}
        </p>
      ) : null}

      {donations ? (
        <section aria-labelledby="donations-report" className="space-y-4">
          <h2 id="donations-report" className="text-h3 font-semibold">
            Donations
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Captured"
              value={formatCurrency(donations.totals.capturedPaise)}
              hint="Successful payments only"
            />
            <Stat label="Donations" value={donations.totals.donations} hint="Every state" />
            <Stat label="Distinct donors" value={donations.totals.distinctDonors} />
          </div>

          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[32rem] text-left">
              <caption className="text-caption text-muted-foreground px-4 py-2 text-left">
                By payment state — what the bank total will and will not include.
              </caption>
              <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    State
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Donations
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {donations.byStatus.map((row) => (
                  <tr key={row.status}>
                    <td className="text-body-sm px-4 py-2 font-semibold">{row.status}</td>
                    <td className="text-body-sm px-4 py-2 tabular-nums">{row.count}</td>
                    <td className="text-body-sm px-4 py-2 tabular-nums">
                      {formatCurrency(row.amountPaise)}
                    </td>
                  </tr>
                ))}
                {donations.byStatus.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-body-sm text-muted-foreground px-4 py-4">
                      No donations in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {campaigns ? (
        <section aria-labelledby="campaigns-report" className="space-y-3">
          <h2 id="campaigns-report" className="text-h3 font-semibold">
            Campaigns
          </h2>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Campaign
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Raised in range
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Donations
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Lifetime
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {campaigns.items.slice(0, 15).map((row) => (
                  <tr key={row.id}>
                    <td className="text-body-sm px-4 py-2">{row.title}</td>
                    <td className="text-body-sm px-4 py-2 tabular-nums">
                      {formatCurrency(row.inRangePaise)}
                    </td>
                    <td className="text-body-sm px-4 py-2 tabular-nums">{row.inRangeDonations}</td>
                    <td className="text-body-sm text-muted-foreground px-4 py-2 tabular-nums">
                      {formatCurrency(row.lifetimePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {volunteers ? (
          <section aria-labelledby="volunteers-report" className="space-y-3">
            <h2 id="volunteers-report" className="text-h3 font-semibold">
              Volunteers
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Active" value={volunteers.standing.activeVolunteers} />
              <Stat
                label="Verified hours"
                value={volunteers.standing.verifiedHours}
                hint="From attendance, rounded down"
              />
            </div>
            <p className="text-body-sm text-muted-foreground">
              {volunteers.appliedInRange.reduce((total, row) => total + row.count, 0)} applied in
              this range.
            </p>
          </section>
        ) : null}

        {impact ? (
          <section aria-labelledby="impact-report" className="space-y-3">
            <h2 id="impact-report" className="text-h3 font-semibold">
              Impact
            </h2>
            {impact.items.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">No impact records in this range.</p>
            ) : (
              <ul className="border-border divide-border divide-y rounded-lg border">
                {impact.items.map((row) => (
                  <li key={row.metricType} className="flex justify-between gap-4 px-4 py-2">
                    <span className="text-body-sm">{row.metricType}</span>
                    <span className="text-body-sm tabular-nums">
                      {row.total.toLocaleString()}{' '}
                      <span className="text-muted-foreground">
                        ({row.published} of {row.records} published)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <ExportLinks from={range.from} to={range.to} allowed={exportable} />
    </div>
  );
}
