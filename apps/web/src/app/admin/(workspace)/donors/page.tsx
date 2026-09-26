import Link from 'next/link';

import { formatCurrency, formatDate } from '@sailent/ui';

import { adminFetch, type Paginated } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

interface AdminDonor {
  id: string;
  donorCode: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  donorType: string;
  totalDonated: number;
  donationCount: number;
  lastDonatedAt: string | null;
  isAnonymous: boolean;
  /** Whether a PAN is on file. Never the number itself. */
  hasTaxId: boolean;
  createdAt: string;
}

/**
 * Donors.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE PAN IS NOT ON THIS SCREEN AT ANY PERMISSION LEVEL, AND IT IS NOT
 * SEARCHABLE.
 *
 * The list reports only WHETHER a tax id is on file, because that is the
 * operational question — can this donor be included in the Form 10BD filing?
 * The number itself lives on the detail page and requires
 * `donor.read_sensitive`.
 *
 * Search deliberately does not cover it either. A search that matched on a PAN
 * would let somebody confirm a number they already suspected by reading the
 * result count, and an oracle is a disclosure however the row is filtered
 * afterwards.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminDonorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hasDonated?: string; page?: string }>;
}) {
  const params = await searchParams;

  const data = await adminFetch<Paginated<AdminDonor>>('admin/donors', {
    query: {
      q: params.q,
      hasDonated: params.hasDonated ?? 'all',
      page: params.page,
      sort: '-totalDonated',
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-semibold">Donors</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          {data.pagination.total} records. Lifetime totals are maintained by payment capture and
          cannot be edited.
        </p>
      </header>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Name, email, phone or donor code"
          aria-label="Search donors"
          className="border-input bg-surface text-body-sm h-10 min-w-0 flex-1 rounded-md border px-3"
        />
        <select
          name="hasDonated"
          defaultValue={params.hasDonated ?? 'all'}
          aria-label="Filter by giving"
          className="border-input bg-surface text-body-sm h-10 rounded-md border px-3"
        >
          <option value="all">All records</option>
          <option value="true">Has donated</option>
          <option value="false">No donations</option>
        </select>
        <button
          type="submit"
          className="bg-primary text-primary-foreground text-body-sm h-10 rounded-md px-4 font-medium"
        >
          Search
        </button>
      </form>

      {data.items.length === 0 ? (
        <p className="text-body-sm text-muted-foreground border-border rounded-lg border border-dashed px-6 py-10 text-center">
          No donors match that search.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[46rem] text-left">
            <thead className="border-border bg-muted/40 border-b">
              <tr>
                <Th>Donor</Th>
                <Th>Contact</Th>
                <Th numeric>Given</Th>
                <Th numeric>Donations</Th>
                <Th>Last gift</Th>
                <Th>PAN</Th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.items.map((donor) => {
                const name =
                  [donor.firstName, donor.lastName].filter(Boolean).join(' ').trim() || '—';

                return (
                  <tr key={donor.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/donors/${donor.id}`}
                        className="text-body-sm focus-visible:outline-ring rounded-sm font-medium hover:underline focus-visible:outline-2"
                      >
                        {name}
                      </Link>
                      {donor.donorCode ? (
                        <span data-numeric="" className="text-caption text-muted-foreground block">
                          {donor.donorCode}
                        </span>
                      ) : null}
                      {donor.isAnonymous ? (
                        <span className="text-caption text-muted-foreground block">
                          Gives anonymously
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-body-sm block break-all">{donor.email ?? '—'}</span>
                      <span data-numeric="" className="text-caption text-muted-foreground">
                        {donor.phone ?? '—'}
                      </span>
                    </td>
                    <td data-numeric="" className="px-4 py-3 text-right text-sm tabular-nums">
                      {formatCurrency(donor.totalDonated)}
                    </td>
                    <td data-numeric="" className="px-4 py-3 text-right text-sm tabular-nums">
                      {donor.donationCount}
                    </td>
                    <td className="text-body-sm px-4 py-3">
                      {donor.lastDonatedAt ? formatDate(donor.lastDonatedAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          donor.hasTaxId
                            ? 'text-caption bg-success-subtle text-success inline-flex rounded-full px-2 py-0.5 font-medium'
                            : 'text-caption bg-muted text-muted-foreground inline-flex rounded-full px-2 py-0.5 font-medium'
                        }
                      >
                        {donor.hasTaxId ? 'On file' : 'Missing'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={`text-caption text-muted-foreground px-4 py-2.5 font-medium ${numeric ? 'text-right' : ''}`}
    >
      {children}
    </th>
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
  query: { q?: string; hasDonated?: string };
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    if (query.q) search.set('q', query.q);
    if (query.hasDonated) search.set('hasDonated', query.hasDonated);
    search.set('page', String(target));
    return `/admin/donors?${search.toString()}`;
  };

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4">
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
