import Link from 'next/link';

import { Button, formatDate } from '@sailent/ui';

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Impact records</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data.pagination.total} total. These are the evidence behind every published figure that
            is not a live database total — a number here needs a method before it can go out.
          </p>
        </div>
        {can(actor, 'impact.create') ? (
          <Button asChild>
            <Link href="/admin/impact/new">Record an impact</Link>
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={`/admin/impact?status=${status}`}
              aria-current={active === status ? 'page' : undefined}
              className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
                active === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <form className="ml-auto flex gap-2" action="/admin/impact">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search title or place"
            aria-label="Search impact records"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No records match this view.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Record
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Belongs to
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Figure
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Evidence
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((record) => {
                const claimsFigure = record.metricValue !== null;
                return (
                  <tr key={record.id} className="border-border border-t">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/impact/${record.id}/edit`}
                        className="hover:text-primary font-medium"
                      >
                        {record.title}
                      </Link>
                      <p className="text-caption text-muted-foreground">{record.location ?? '—'}</p>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {record.campaignTitle ?? record.eventTitle ?? record.programTitle ?? '—'}
                    </td>
                    <td data-numeric="" className="px-4 py-3 text-right tabular-nums">
                      {claimsFigure
                        ? `${record.metricValue!.toLocaleString('en-IN')}${
                            record.metricUnit ? ` ${record.metricUnit}` : ''
                          }`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {!claimsFigure ? (
                        <span className="text-muted-foreground">Not needed</span>
                      ) : record.verificationMethod ? (
                        <span className="text-success">Recorded</span>
                      ) : (
                        <span className="text-destructive">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={record.status} />
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {formatDate(record.impactDate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
