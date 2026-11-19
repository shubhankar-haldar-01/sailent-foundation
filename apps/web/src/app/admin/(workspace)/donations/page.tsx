import Link from 'next/link';
import { Lock, Search, ShieldCheck } from 'lucide-react';

import { Button, PageHeader } from '@sailent/ui';

import { AdminPagination } from '@/components/admin/admin-pagination';
import {
  DonationsTable,
  DonationStatusBadge,
  type AdminDonation,
} from '@/components/admin/donations-table';
import { adminFetch, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export { DonationStatusBadge, type AdminDonation };

const STATUSES = [
  { value: 'all', label: 'All donations' },
  { value: 'successful', label: 'Successful' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
] as const;

/**
 * Donations.
 *
 * Donor identity is NULL here unless the viewer holds `donation.read_pii`, and
 * that is decided by the API, not by this page.
 */
export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    campaignId?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminDonation>>('admin/donations', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      campaignId: params.campaignId,
      page: params.page,
      limit: 10,
      sort: params.sort ?? '-createdAt',
    },
  });

  const active = params.status ?? 'all';
  const seesDonors = can(actor, 'donation.read_pii');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donations"
        count={data.pagination.total}
        description={
          seesDonors
            ? 'Lifetime donation transactions recorded across campaigns.'
            : 'Lifetime donation transactions. Donor identities are masked without donation.read_pii.'
        }
        status={
          seesDonors ? (
            <span className="text-caption text-success bg-success-subtle inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              PII Unlocked
            </span>
          ) : (
            <span className="text-caption text-muted-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium">
              <Lock className="size-3" aria-hidden="true" />
              PII Redacted
            </span>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => {
            const isSelected = active === status.value;
            const href = `/admin/donations?status=${status.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
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
          method="get"
          action="/admin/donations"
          className="flex w-full items-center gap-2 sm:w-auto"
        >
          {active !== 'all' ? <input type="hidden" name="status" value={active} /> : null}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search reference, donor, email..."
              aria-label="Search donations"
              className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/donations${active !== 'all' ? `?status=${active}` : ''}`}>
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </div>

      <DonationsTable donations={data.items} seesDonors={seesDonors} activeStatus={active} />

      <AdminPagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        totalItems={data.pagination.total}
        ariaLabel="Donations pagination"
        makeHref={(p) => {
          const search = new URLSearchParams();
          if (params.status && params.status !== 'all') search.set('status', params.status);
          if (params.q) search.set('q', params.q);
          if (params.campaignId) search.set('campaignId', params.campaignId);
          search.set('page', String(p));
          return `/admin/donations?${search.toString()}`;
        }}
      />
    </div>
  );
}
