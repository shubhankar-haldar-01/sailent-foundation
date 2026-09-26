import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { formatCurrency, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/dashboard/status-pill';
import { EmptyState } from '@/components/dashboard/empty-state';
import { donorFetch, type DonorDonation, type Paginated } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your donations',
  path: '/dashboard/donations',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'successful', label: 'Received' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'failed', label: 'Failed' },
] as const;

/**
 * The full giving history.
 *
 * Failed and pending donations ARE shown, filtered but not hidden. A donor who
 * remembers paying and cannot find the record assumes the money vanished; a
 * donor who can see "this attempt failed" knows where they stand. Hiding
 * unsuccessful attempts would be tidier and would generate support email.
 *
 * NO DONOR PARAMETER IS SENT. The API scopes this to the session, and there is
 * no query string that could widen it.
 */
export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = FILTERS.some((filter) => filter.value === params.status)
    ? (params.status as string)
    : 'all';
  const page = Math.max(1, Number(params.page ?? '1') || 1);

  const result = await donorFetch<Paginated<DonorDonation>>('me/donations', {
    query: { status, page, limit: 20 },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-bold">Your donations</h1>
        <p className="text-body text-muted-foreground mt-2">
          {result.pagination.total} in total. Every one keeps the price you were charged at the
          time.
        </p>
      </header>

      <nav aria-label="Filter by status">
        <ul className="rail flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const active = filter.value === status;
            return (
              <li key={filter.value} className="shrink-0">
                <Link
                  href={
                    filter.value === 'all'
                      ? '/dashboard/donations'
                      : `/dashboard/donations?status=${filter.value}`
                  }
                  {...(active ? { 'aria-current': 'true' as const } : {})}
                  className={
                    active
                      ? 'text-body-sm bg-primary text-primary-foreground focus-visible:outline-ring flex min-h-9 items-center rounded-full px-3.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2'
                      : 'text-body-sm border-border text-muted-foreground hover:bg-muted focus-visible:outline-ring flex min-h-9 items-center rounded-full border px-3.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'
                  }
                >
                  {filter.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {result.items.length === 0 ? (
        <EmptyState
          title={status === 'all' ? 'No donations yet' : 'Nothing with that status'}
          description={
            status === 'all'
              ? 'When you give, it will appear here with its receipt.'
              : 'Try another filter, or look at everything.'
          }
          action={
            status === 'all'
              ? { label: 'Browse campaigns', href: '/campaigns' }
              : { label: 'Show all donations', href: '/dashboard/donations' }
          }
        />
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {result.items.map((donation) => (
            <li key={donation.id}>
              <Link
                href={`/dashboard/donations/${donation.id}`}
                className="hover:bg-muted/50 focus-visible:outline-ring flex min-h-16 items-center gap-4 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-body-sm block truncate font-medium">
                    {donation.campaignTitle ?? 'General fund'}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {formatDate(donation.donationDate)} · {donation.reference}
                    {donation.receiptNumber ? ` · ${donation.receiptNumber}` : ''}
                  </span>
                </span>
                <StatusPill status={donation.status} />
                <span data-numeric="" className="text-body-sm font-semibold tabular-nums">
                  {formatCurrency(donation.amount)}
                </span>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pagination.totalPages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link
              href={`/dashboard/donations?status=${status}&page=${page - 1}`}
              className="text-body-sm text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-caption text-muted-foreground">
            Page {page} of {result.pagination.totalPages}
          </span>
          {result.pagination.hasNext ? (
            <Link
              href={`/dashboard/donations?status=${status}&page=${page + 1}`}
              className="text-body-sm text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
