import Link from 'next/link';
import { Plus, Search, Award, CheckCircle2, AlertCircle } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatDate,
} from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminImpactRecord, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Impact records.
 *
 * The `Evidence` column exists because it is the one thing that decides whether
 * a record can be published (decision A14): a figure with no stated method
 * cannot go out. Showing it in the list means an editor can see at a glance
 * which drafts are waiting on a source, rather than finding out one at a time
 * by pressing publish.
 */
export default async function AdminImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminImpactRecord>>('admin/impact', {
    query: { status: params.status ?? 'all', q: params.q, page: params.page, limit: 25 },
  });

  const statuses = ['all', 'draft', 'published', 'archived'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impact Verification Records"
        description="Statutory evidentiary records behind all claimed impact metrics. Non-database figures require recorded verification methods prior to publication."
        count={data.pagination.total}
        actions={
          can(actor, 'impact.create') ? (
            <Button asChild>
              <Link href="/admin/impact/new">
                <Plus className="mr-1.5 size-4" />
                Record Impact
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={`/admin/impact?status=${status}`}
              aria-current={active === status ? 'page' : undefined}
              className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                active === status
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <form className="flex items-center gap-2" action="/admin/impact">
          <input type="hidden" name="status" value={active} />
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search title or location..."
              aria-label="Search impact records"
              className="border-input bg-surface text-body-sm shadow-xs focus-visible:outline-ring h-9 w-64 rounded-md border pl-8 pr-3 focus-visible:outline-2"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="text-primary size-4" />
            Verified Metrics & Records
          </CardTitle>
          <CardDescription>{data.pagination.total} total records in repository</CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              No records match this view.
            </div>
          ) : (
            <div className="border-border/70 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Record Title & Location</TableHead>
                    <TableHead className="font-semibold">Associated Entity</TableHead>
                    <TableHead className="text-right font-semibold">Claimed Metric</TableHead>
                    <TableHead className="font-semibold">Evidence Status</TableHead>
                    <TableHead className="font-semibold">Publication Status</TableHead>
                    <TableHead className="text-right font-semibold">Impact Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((record) => {
                    const claimsFigure = record.metricValue !== null;
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="max-w-md">
                          <Link
                            href={`/admin/impact/${record.id}/edit`}
                            className="text-body-sm hover:text-primary block font-semibold transition-colors"
                          >
                            {record.title}
                          </Link>
                          <p className="text-caption text-muted-foreground/80 mt-0.5">
                            {record.location ?? '—'}
                          </p>
                        </TableCell>
                        <TableCell className="text-body-sm text-muted-foreground">
                          {record.campaignTitle ?? record.eventTitle ?? record.programTitle ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {claimsFigure
                            ? `${record.metricValue!.toLocaleString('en-IN')}${
                                record.metricUnit ? ` ${record.metricUnit}` : ''
                              }`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {!claimsFigure ? (
                            <span className="text-caption text-muted-foreground">Not required</span>
                          ) : record.verificationMethod ? (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle2 className="size-3" />
                              Recorded
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="size-3" />
                              Missing method
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={record.status} />
                        </TableCell>
                        <TableCell className="text-body-sm text-muted-foreground text-right">
                          {formatDate(record.impactDate)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
