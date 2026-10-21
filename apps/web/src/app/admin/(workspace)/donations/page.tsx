import Link from 'next/link';

import { adminFetch, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';
import {
  DonationsTable,
  DonationStatusBadge,
  type AdminDonation,
} from '@/components/admin/donations-table';

export const dynamic = 'force-dynamic';

export { DonationStatusBadge, type AdminDonation };

const STATUSES = ['all', 'successful', 'pending', 'failed'] as const;

/**
 * Donations.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Donor identity is NULL here unless the viewer holds `donation.read_pii`, and
 * that is decided by the API, not by this page. The columns simply render what
 * came back — a page that filtered PII itself would have already received it.
 *
 * There is no control anywhere in this screen that changes a donation's status.
 * Money moves only through payments this platform verified against Razorpay.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; campaignId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminDonation>>('admin/donations', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      campaignId: params.campaignId,
      page: params.page,
      limit: 50,
      sort: '-createdAt',
    },
  });

  const active = params.status ?? 'all';
  const seesDonors = can(actor, 'donation.read_pii');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Donations</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-prose">
          {data.pagination.total} recorded.{' '}
          {seesDonors
            ? 'You can see donor identities because you hold the sensitive permission for it.'
            : 'Donor identities are hidden — they need the donation.read_pii permission.'}
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/donations?status=${status}`}
            aria-current={active === status ? 'page' : undefined}
            className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
              active === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {status.replace('_', ' ')}
          </Link>
        ))}
      </nav>

      {data.items.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          No donations match this filter.
        </p>
      ) : (
        <DonationsTable donations={data.items} seesDonors={seesDonors} activeStatus={active} />
      )}

      {data.pagination.totalPages > 1 ? (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          hasNext={data.pagination.hasNext}
          query={params}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  hasNext,
  query,
}: {
  page: number;
  totalPages: number;
  hasNext: boolean;
  query: { status?: string; q?: string; campaignId?: string };
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    if (query.status && query.status !== 'all') search.set('status', query.status);
    if (query.q) search.set('q', query.q);
    if (query.campaignId) search.set('campaignId', query.campaignId);
    search.set('page', String(target));
    return `/admin/donations?${search.toString()}`;
  };

  return (
    <nav aria-label="Donations pagination" className="flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-body-sm font-medium underline">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-caption text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {hasNext ? (
        <Link href={href(page + 1)} className="text-body-sm font-medium underline">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
