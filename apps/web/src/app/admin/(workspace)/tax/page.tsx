import Link from 'next/link';
import { Calendar, CheckCircle, FileText, Info } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatCurrency,
  PageHeader,
} from '@sailent/ui';

import { Stat } from '@/components/admin/report-controls';
import { AdminApiError, taxReadinessReport } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * Form 10BD readiness.
 *
 * Statutory 80G tax compliance analysis.
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
      <div className="p-6">
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {error instanceof AdminApiError
            ? error.message
            : 'Could not build tax compliance report.'}
        </p>
      </div>
    );
  }

  const percentReady =
    report.eligible === 0 ? 100 : Math.round((report.ready / report.eligible) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax compliance"
        description={`Annual Form 10BD statutory filing readiness for Financial Year ${report.financialYear}. Form 10BE tax relief certificates are issued by the Income Tax Department based on this filing.`}
        status={
          <Badge variant={percentReady === 100 ? 'success' : 'warning'}>
            {percentReady}% Ready
          </Badge>
        }
      />

      {/* Deadline Notice Card */}
      <Card className="border-border bg-muted/20">
        <CardContent className="flex items-start gap-3 p-4">
          <Calendar className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-body-sm text-foreground font-semibold">
              Statutory Filing Deadline: {report.filingDeadline}
            </p>
            <p className="text-body-sm text-muted-foreground mt-0.5">
              Any eligible donation missing a valid PAN by the statutory filing deadline cannot be
              included in the annual Form 10BD submission, preventing the donor from claiming 80G
              deductions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Eligible Donations"
          value={report.eligible}
          hint={formatCurrency(report.eligiblePaise)}
        />
        <Stat
          label="Ready to File"
          value={report.ready}
          hint={`${percentReady}% of eligible donations`}
        />
        <Stat
          label="Missing Tax ID"
          value={report.missing}
          hint={formatCurrency(report.missingPaise)}
        />
        <Stat
          label="Donors to Contact"
          value={report.donorsMissingTaxId}
          hint="Donors with missing PANs"
        />
      </div>

      {/* Status Notice */}
      {report.missing > 0 ? (
        <Card className="border-warning/50 bg-warning-subtle/30 p-4">
          <div className="flex items-start gap-3">
            <Info className="text-warning-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-body-sm text-warning-foreground font-semibold">
                Action Required: {report.missing} {report.missing === 1 ? 'donation' : 'donations'}{' '}
                missing PAN
              </p>
              <p className="text-body-sm text-muted-foreground mt-1">
                {report.missing} captured donations totaling {formatCurrency(report.missingPaise)}{' '}
                across {report.donorsMissingTaxId}{' '}
                {report.donorsMissingTaxId === 1 ? 'donor' : 'donors'} cannot go on the return.
                Requesting PAN details from these donors will close the eligibility gap prior to the
                deadline.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-success/40 bg-success-subtle/30 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-body-sm text-success font-semibold">
                100% Tax ID Coverage Achieved
              </p>
              <p className="text-body-sm text-muted-foreground mt-1">
                Every eligible donation in {report.financialYear} has a verified PAN / tax ID on
                file and is ready for Form 10BD compilation.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Guidance Card */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <div className="flex items-center gap-2">
            <FileText className="text-primary size-5" aria-hidden="true" />
            <CardTitle className="text-base font-semibold">Statutory Export Guidance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-body-sm text-muted-foreground">
            To prepare the official government filing, export the verified donations CSV for
            Financial Year {report.financialYear} from the{' '}
            <Link href="/admin/reports" className="text-primary font-medium hover:underline">
              Administrative Reports & Exports
            </Link>{' '}
            section. That export includes full tax IDs and addresses unlocked under sensitive staff
            permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
