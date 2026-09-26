import Link from 'next/link';

import { formatCurrency, formatDate } from '@sailent/ui';

import { adminFetch, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'successful', 'pending', 'failed'] as const;

const STATUS_STYLE: Record<string, string> = {
  successful: 'bg-success-subtle text-success',
  pending: 'bg-warning-subtle text-warning-foreground',
  processing: 'bg-warning-subtle text-warning-foreground',
  failed: 'bg-destructive-subtle text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

interface AdminDonation {
  id: string;
  reference: string;
  status: string;
  donationType: string;
  amount: number;
  createdAt: string;
  completedAt: string | null;
  campaignTitle: string | null;
  campaignSlug: string | null;
  receiptNumber: string | null;
  donorName: string | null;
  donorEmail: string | null;
}

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
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[52rem] border-collapse">
            <caption className="sr-only">
              Every donation, with its reference, campaign, amount and state.
            </caption>
            <thead>
              <tr className="border-border bg-muted/50 border-b text-left">
                <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                  Reference
                </th>
                <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                  Campaign
                </th>
                {seesDonors ? (
                  <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                    Donor
                  </th>
                ) : null}
                <th scope="col" className="text-caption px-4 py-2.5 text-right font-semibold">
                  Amount
                </th>
                <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                  State
                </th>
                <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                  Receipt
                </th>
                <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                  When
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.items.map((donation) => (
                <tr key={donation.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/donations/${donation.id}`}
                      data-numeric=""
                      className="text-body-sm focus-visible:outline-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2"
                    >
                      {donation.reference}
                    </Link>
                    <p className="text-caption text-muted-foreground capitalize">
                      {donation.donationType}
                    </p>
                  </td>
                  <td className="text-body-sm px-4 py-3">{donation.campaignTitle ?? '—'}</td>
                  {seesDonors ? (
                    <td className="px-4 py-3">
                      <p className="text-body-sm">{donation.donorName ?? '—'}</p>
                      <p className="text-caption text-muted-foreground">
                        {donation.donorEmail ?? ''}
                      </p>
                    </td>
                  ) : null}
                  <td data-numeric="" className="text-body-sm px-4 py-3 text-right tabular-nums">
                    {formatCurrency(donation.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-caption inline-flex rounded-full px-2 py-0.5 font-medium capitalize ${
                        STATUS_STYLE[donation.status] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {donation.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td data-numeric="" className="text-caption px-4 py-3">
                    {donation.receiptNumber ?? '—'}
                  </td>
                  <td className="text-caption text-muted-foreground px-4 py-3">
                    {formatDate(donation.completedAt ?? donation.createdAt)}
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
