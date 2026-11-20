import Link from 'next/link';
import { Plus, Search, Sparkles, Flag, Info } from 'lucide-react';

import { Badge, Button, Card, formatCurrency, formatDate, PageHeader, Progress } from '@sailent/ui';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminListEmpty, isFiltered } from '@/components/admin/list-empty';
import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminCampaign, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
] as const;

/**
 * Campaign list.
 *
 * Shows real fundraising progress and counts. Figures are derived from recorded donations.
 */
export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    programId?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminCampaign>>('admin/campaigns', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      programId: params.programId,
      page: params.page,
      limit: 10,
      sort: params.sort ?? '-createdAt',
    },
  });

  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        count={data.pagination.total}
        description={
          <p className="text-body-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Public and operational campaigns.</span>
            <span className="text-border hidden sm:inline" aria-hidden="true">
              •
            </span>
            <span className="text-muted-foreground/90 inline-flex items-center gap-1">
              <Info className="text-primary/70 size-3.5 shrink-0" aria-hidden="true" />
              Must be attached to a program before publishing
            </span>
          </p>
        }
        actions={
          can(actor, 'campaign.create') ? (
            <Button asChild className="shadow-xs gap-2 transition-all hover:shadow-sm">
              <Link href="/admin/campaigns/new">
                <Plus className="size-4" aria-hidden="true" />
                <span>New campaign</span>
              </Link>
            </Button>
          ) : null
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => {
            const isSelected = active === status.value;
            const href = `/admin/campaigns?status=${status.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
            return (
              <Link
                key={status.value}
                href={href}
                aria-current={isSelected ? 'page' : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {status.label}
              </Link>
            );
          })}
        </nav>

        <form
          className="flex w-full items-center gap-2 sm:w-auto"
          method="get"
          action="/admin/campaigns"
        >
          {active !== 'all' ? <input type="hidden" name="status" value={active} /> : null}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search campaigns..."
              aria-label="Search campaigns"
              className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/campaigns${active !== 'all' ? `?status=${active}` : ''}`}>
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </div>

      {data.items.length === 0 ? (
        <AdminListEmpty
          icon={Flag}
          noun="campaigns"
          filtered={isFiltered(params)}
          clearHref="/admin/campaigns"
          filteredDescription={
            params.q
              ? `No campaigns match “${params.q}”.`
              : 'No campaigns match the selected status filter.'
          }
          emptyDescription="New campaigns appear here, starting as drafts."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Campaigns with fundraising goal progress, program association and lifecycle status.
              </caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Campaign
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Program
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Fundraising Progress
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Donors
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    End Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.items.map((campaign) => {
                  const percent = campaign.progress?.percent ?? 0;
                  return (
                    <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/campaigns/${campaign.id}/edit`}
                            className="text-foreground hover:text-primary font-medium transition-colors"
                          >
                            {campaign.title}
                          </Link>
                          {campaign.isFeatured ? (
                            <Badge
                              variant="accent"
                              className="gap-1 px-1.5 py-0 text-[10px] font-semibold"
                            >
                              <Sparkles className="size-2.5" aria-hidden="true" />
                              Featured
                              {campaign.featuredOrder !== null &&
                              campaign.featuredOrder !== undefined
                                ? ` · ${campaign.featuredOrder}`
                                : ''}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          /{campaign.slug}
                          {campaign.category ? ` · ${campaign.category}` : ''}
                        </p>
                      </td>
                      <td className="text-muted-foreground px-5 py-3.5 text-xs">
                        {campaign.programTitle ? (
                          <span className="text-foreground font-medium">
                            {campaign.programTitle}
                          </span>
                        ) : (
                          <Badge variant="warning" className="text-[11px]">
                            Not attached
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={campaign.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="min-w-44">
                          <p
                            data-numeric=""
                            className="text-foreground text-xs font-semibold tabular-nums"
                          >
                            {formatCurrency(campaign.amountRaised)}
                            <span className="text-muted-foreground font-normal">
                              {' / '}
                              {formatCurrency(campaign.fundraisingGoal)}
                            </span>
                          </p>
                          <Progress
                            value={percent}
                            size="sm"
                            className="mt-1.5"
                            label={`${percent}% of the goal raised`}
                          />
                        </div>
                      </td>
                      <td
                        data-numeric=""
                        className="text-foreground px-5 py-3.5 text-right text-xs font-medium tabular-nums"
                      >
                        {campaign.donorCount}
                      </td>
                      <td className="text-muted-foreground px-5 py-3.5 text-xs">
                        {campaign.endDate ? formatDate(campaign.endDate) : 'Ongoing'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AdminPagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        totalItems={data.pagination.total}
        ariaLabel="Campaigns pagination"
        makeHref={(p) => {
          const search = new URLSearchParams();
          if (params.status && params.status !== 'all') search.set('status', params.status);
          if (params.q) search.set('q', params.q);
          if (params.programId) search.set('programId', params.programId);
          search.set('page', String(p));
          return `/admin/campaigns?${search.toString()}`;
        }}
      />
    </div>
  );
}
