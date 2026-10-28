import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileCheck, FileWarning, Search, Users } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  formatCurrency,
  formatDate,
  PageHeader,
} from '@sailent/ui';

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
  hasTaxId: boolean;
  createdAt: string;
}

/**
 * Donors.
 *
 * The PAN is not on this screen at any permission level, and it is not searchable.
 * The list reports whether a tax ID is on file for Form 10BD eligibility.
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

  const activeDonated = params.hasDonated ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donors"
        count={data.pagination.total}
        description="Every donor who has signed up or given. Lifetime totals reflect successful donations only."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by giving status" className="flex flex-wrap gap-1.5">
          {[
            { value: 'all', label: 'All Donors' },
            { value: 'true', label: 'Have Donated' },
            { value: 'false', label: 'Never Donated' },
          ].map((status) => {
            const isSelected = activeDonated === status.value;
            const href = `/admin/donors?hasDonated=${status.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
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
          action="/admin/donors"
        >
          {activeDonated !== 'all' ? (
            <input type="hidden" name="hasDonated" value={activeDonated} />
          ) : null}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search name, email, code..."
              aria-label="Search donors"
              className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost" size="sm">
              <Link
                href={`/admin/donors${activeDonated !== 'all' ? `?hasDonated=${activeDonated}` : ''}`}
              >
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </div>

      {data.items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">No donors found</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {params.q
                ? `No donors match “${params.q}”.`
                : 'No donors match the selected giving filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Donors directory with giving totals, donation counts and tax id status.
              </caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Donor
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Contact
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Lifetime Given
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Gifts
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Last Gift
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    PAN / Tax ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.items.map((donor) => {
                  const name =
                    [donor.firstName, donor.lastName].filter(Boolean).join(' ').trim() || '—';
                  return (
                    <tr key={donor.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/donors/${donor.id}`}
                          className="text-foreground hover:text-primary font-medium transition-colors"
                        >
                          {name}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2">
                          {donor.donorCode ? (
                            <span
                              data-numeric=""
                              className="text-muted-foreground font-mono text-xs"
                            >
                              {donor.donorCode}
                            </span>
                          ) : null}
                          {donor.isAnonymous ? (
                            <span className="text-muted-foreground text-xs italic">
                              (Anonymous to public)
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="text-muted-foreground px-5 py-3.5 text-xs">
                        <span className="text-foreground block font-medium">
                          {donor.email ?? '—'}
                        </span>
                        <span data-numeric="" className="text-muted-foreground">
                          {donor.phone ?? '—'}
                        </span>
                      </td>
                      <td
                        data-numeric=""
                        className="text-foreground px-5 py-3.5 text-right text-xs font-semibold tabular-nums"
                      >
                        {formatCurrency(donor.totalDonated)}
                      </td>
                      <td
                        data-numeric=""
                        className="text-muted-foreground px-5 py-3.5 text-right text-xs tabular-nums"
                      >
                        {donor.donationCount}
                      </td>
                      <td className="text-muted-foreground px-5 py-3.5 text-xs">
                        {donor.lastDonatedAt ? formatDate(donor.lastDonatedAt) : 'Never'}
                      </td>
                      <td className="px-5 py-3.5">
                        {donor.hasTaxId ? (
                          <Badge variant="success" className="gap-1 text-[11px] font-normal">
                            <FileCheck className="size-3" aria-hidden="true" />
                            On file
                          </Badge>
                        ) : (
                          <Badge
                            variant="neutral"
                            className="text-muted-foreground gap-1 text-[11px] font-normal"
                          >
                            <FileWarning className="size-3 opacity-60" aria-hidden="true" />
                            Missing
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
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
  query: { q?: string; hasDonated?: string };
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    if (query.q) search.set('q', query.q);
    if (query.hasDonated && query.hasDonated !== 'all') search.set('hasDonated', query.hasDonated);
    search.set('page', String(target));
    return `/admin/donors?${search.toString()}`;
  };

  return (
    <nav aria-label="Donors pagination" className="flex items-center justify-between pt-2">
      <p className="text-muted-foreground text-xs">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={href(page - 1)} className="gap-1">
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Link>
          </Button>
        ) : null}
        {hasNext ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={href(page + 1)} className="gap-1">
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
