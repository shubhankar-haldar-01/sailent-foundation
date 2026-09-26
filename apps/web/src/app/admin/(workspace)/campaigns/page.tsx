import Link from 'next/link';

import { Button, Progress, formatCurrency, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminCampaign, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  'all',
  'draft',
  'published',
  'active',
  'paused',
  'completed',
  'archived',
] as const;

/**
 * Campaign list.
 *
 * Shows the money, because that is what an operator is here to check. Every
 * figure is server-computed: `progress.percent` comes from the API's single
 * implementation, so this table cannot disagree with the public page.
 */
export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; programId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminCampaign>>('admin/campaigns', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      programId: params.programId,
      page: params.page,
      limit: 25,
      sort: '-updatedAt',
    },
  });

  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Campaigns</h1>
          <p className="text-body-sm text-muted-foreground mt-1">{data.pagination.total} total.</p>
        </div>
        {can(actor, 'campaign.create') ? (
          <Button asChild>
            <Link href="/admin/campaigns/new">New campaign</Link>
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/campaigns?status=${status}`}
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

        <form className="ml-auto flex gap-2" action="/admin/campaigns">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search campaigns"
            aria-label="Search campaigns"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No campaigns match this view.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Campaign
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Program
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Raised
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Donors
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Ends
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((campaign) => (
                <tr key={campaign.id} className="border-border border-t align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/campaigns/${campaign.id}/edit`}
                      className="hover:text-primary font-medium"
                    >
                      {campaign.title}
                    </Link>
                    <p className="text-caption text-muted-foreground">
                      /{campaign.slug}
                      {campaign.category ? ` · ${campaign.category}` : ''}
                    </p>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {campaign.programTitle ?? (
                      <span className="text-warning-foreground">Not attached</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={campaign.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="min-w-40">
                      <p data-numeric="" className="tabular-nums">
                        {formatCurrency(campaign.amountRaised)}
                        <span className="text-muted-foreground">
                          {' of '}
                          {formatCurrency(campaign.fundraisingGoal)}
                        </span>
                      </p>
                      <Progress
                        value={campaign.progress.percent}
                        size="sm"
                        className="mt-1.5"
                        label={`${campaign.progress.percent}% of the goal raised`}
                      />
                    </div>
                  </td>
                  <td data-numeric="" className="px-4 py-3 text-right tabular-nums">
                    {campaign.donorCount}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {campaign.endDate ? formatDate(campaign.endDate) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/admin/campaigns/${campaign.id}/edit`}
                      className="text-primary hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
