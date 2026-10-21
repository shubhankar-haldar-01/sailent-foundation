import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, Clock, Database, Heart } from 'lucide-react';

import { cn, formatCurrency } from '@sailent/ui';

import { DonationsControls } from '@/components/dashboard/donations-controls';
import { DonationsPagination } from '@/components/dashboard/donations-pagination';
import { DonationsRetryButton } from '@/components/dashboard/donations-retry';
import { DonationsTable } from '@/components/dashboard/donations-table';
import { EmptyState } from '@/components/dashboard/empty-state';
import { donorFetch, type DonorDonation, type DonorProfile, type Paginated } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your donations',
  path: '/dashboard/donations',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    sort?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;
  const statusParam = params.status;
  const status =
    statusParam === 'successful' || statusParam === 'pending' || statusParam === 'failed'
      ? statusParam
      : 'all';
  const q = params.q?.trim() || '';
  const sort = params.sort || '-donationDate';
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const limit = [8, 16, 32].includes(Number(params.limit)) ? Number(params.limit) : 8;

  let fetchError: Error | null = null;

  const [profile, allRes, successfulRes, pendingRes, failedRes, result] = await Promise.all([
    donorFetch<DonorProfile>('me').catch(() => null),
    donorFetch<Paginated<DonorDonation>>('me/donations', {
      query: { status: 'all', page: 1, limit: 1 },
    }).catch(() => ({ pagination: { total: 0 } })),
    donorFetch<Paginated<DonorDonation>>('me/donations', {
      query: { status: 'successful', page: 1, limit: 1 },
    }).catch(() => ({ pagination: { total: 0 } })),
    donorFetch<Paginated<DonorDonation>>('me/donations', {
      query: { status: 'pending', page: 1, limit: 1 },
    }).catch(() => ({ pagination: { total: 0 } })),
    donorFetch<Paginated<DonorDonation>>('me/donations', {
      query: { status: 'failed', page: 1, limit: 1 },
    }).catch(() => ({ pagination: { total: 0 } })),
    donorFetch<Paginated<DonorDonation>>('me/donations', {
      query: {
        status: status === 'all' ? undefined : status,
        q: q || undefined,
        sort: sort || undefined,
        page,
        limit,
      },
    }).catch((err) => {
      fetchError = err instanceof Error ? err : new Error(String(err));
      return {
        items: [],
        pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
      };
    }),
  ]);

  const allCount = allRes.pagination.total;
  const receivedCount = successfulRes.pagination.total;
  const awaitingCount = pendingRes.pagination.total;
  const failedCount = failedRes.pagination.total;

  const totalDonated = profile?.totalDonated ?? 0;
  const donationCount = profile?.donationCount ?? receivedCount;

  const filters = [
    { value: 'all', label: 'All', count: allCount },
    { value: 'successful', label: 'Received', count: receivedCount },
    { value: 'pending', label: 'Awaiting payment', count: awaitingCount },
    { value: 'failed', label: 'Failed', count: failedCount },
  ] as const;

  const makeFilterHref = (targetValue: string) => {
    const sp = new URLSearchParams();
    if (targetValue !== 'all') sp.set('status', targetValue);
    if (q) sp.set('q', q);
    if (sort && sort !== '-donationDate') sp.set('sort', sort);
    if (limit !== 8) sp.set('limit', String(limit));
    const qs = sp.toString();
    return qs ? `/dashboard/donations?${qs}` : '/dashboard/donations';
  };

  return (
    <div className="space-y-3.5 xl:space-y-3">
      {/* Header: shown from `lg`; below it, read out but not drawn — the page's h1 must not disappear on a phone. */}
      <header className="relative max-lg:sr-only">
        <p className="text-primary text-[0.6875rem] font-bold uppercase tracking-wider">
          MY ACCOUNT
        </p>
        <h1 className="text-foreground mt-0.5 text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
          Your donations
        </h1>
        <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs sm:text-[0.8125rem]">
          Every contribution has a story. Track your donations and payment status in one place.
        </p>
      </header>

      {/* ──────────────── 3 Summary Cards ──────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Card 1: Total Donated */}
        <div className="card-elevated flex items-center gap-3.5 rounded-2xl p-3.5 xl:p-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EAF8F0] text-[#1E9E65] dark:bg-emerald-950/40 dark:text-emerald-400">
            <Database className="size-5 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">Total donated</p>
            <p className="font-display text-foreground mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
              {formatCurrency(totalDonated)}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-[0.6875rem]">
              Across {donationCount} {donationCount === 1 ? 'donation' : 'donations'}
            </p>
          </div>
        </div>

        {/* Card 2: Received */}
        <div className="card-elevated flex items-center gap-3.5 rounded-2xl p-3.5 xl:p-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400">
            <Heart className="size-5 fill-current" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">Received</p>
            <p className="font-display text-foreground mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
              {receivedCount}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-[0.6875rem]">
              Successful {receivedCount === 1 ? 'donation' : 'donations'}
            </p>
          </div>
        </div>

        {/* Card 3: Awaiting payment */}
        <div className="card-elevated flex items-center gap-3.5 rounded-2xl p-3.5 xl:p-3">
          <div className="text-primary flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400">
            <Clock className="size-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">Awaiting payment</p>
            <p className="font-display text-foreground mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
              {awaitingCount}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-[0.6875rem]">
              Payments in progress
            </p>
          </div>
        </div>
      </div>

      {/* ──────────────── Filter Pills + Search + Sort Bar ──────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Status Filter Tabs */}
        <nav aria-label="Filter donations by status" className="overflow-x-auto pb-0.5">
          <ul className="flex items-center gap-2">
            {filters.map((filter) => {
              const active = filter.value === status;
              return (
                <li key={filter.value} className="shrink-0">
                  <Link
                    href={makeFilterHref(filter.value)}
                    {...(active ? { 'aria-current': 'true' as const } : {})}
                    className={cn(
                      'focus-visible:outline-ring min-h-8.5 inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-[0.8125rem]',
                      active
                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                        : 'bg-surface text-foreground/80 hover:bg-muted hover:text-foreground border-border/80 border',
                    )}
                  >
                    <span>{filter.label}</span>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        active ? 'text-primary-foreground/90' : 'text-muted-foreground',
                      )}
                    >
                      {filter.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Search & Sort Controls */}
        <DonationsControls currentQuery={q} currentSort={sort} />
      </div>

      {/* ──────────────── Error / Empty State / Table Container ──────────────── */}
      {fetchError ? (
        <div className="card-standard flex flex-col items-center justify-center rounded-2xl p-8 text-center sm:p-12">
          <div className="bg-destructive/10 text-destructive mb-3 flex size-12 items-center justify-center rounded-full">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-h3 text-foreground font-bold">Failed to load donations</h2>
          <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
            We could not fetch your donations history right now. Please check your connection and
            try again.
          </p>
          <div className="mt-5">
            <DonationsRetryButton />
          </div>
        </div>
      ) : result.items.length === 0 ? (
        <EmptyState
          title={
            q
              ? 'No matching donations'
              : status === 'all'
                ? 'No donations yet'
                : 'Nothing with that status'
          }
          description={
            q
              ? `No donations found matching “${q}”. Try a different search term or clear the filter.`
              : status === 'all'
                ? 'When you give, it will appear here with its receipt.'
                : 'Try another filter, or look at everything.'
          }
          action={
            status === 'all' && !q
              ? { label: 'Browse campaigns', href: '/campaigns' }
              : { label: 'Show all donations', href: '/dashboard/donations' }
          }
        />
      ) : (
        <div className="space-y-4">
          <DonationsTable donations={result.items} currentSort={sort} />
          <DonationsPagination
            page={page}
            limit={limit}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            hasNext={result.pagination.hasNext}
            hasPrevious={page > 1}
          />
        </div>
      )}
    </div>
  );
}
