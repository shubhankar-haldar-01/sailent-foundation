import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search, UserCheck } from 'lucide-react';

import { Badge, Button, Card, CardContent, formatDate, PageHeader } from '@sailent/ui';

import { adminFetch, type AdminVolunteer, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'pending', label: 'Review Queue' },
  { value: 'active', label: 'Active' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
] as const;

const TONE: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'neutral'> = {
  applied: 'warning',
  under_review: 'info',
  approved: 'success',
  active: 'success',
  suspended: 'destructive',
  rejected: 'neutral',
  inactive: 'neutral',
};

/**
 * Volunteers.
 *
 * Distinct from Team Members: volunteers apply, undergo onboarding review,
 * and record service hours on campaigns or events.
 */
export default async function AdminVolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminVolunteer>>('admin/volunteers', {
    query: {
      status: params.status ?? 'pending',
      q: params.q,
      page: params.page,
      limit: 25,
      sort: '-createdAt',
    },
  });

  const active = params.status ?? 'pending';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volunteers"
        count={data.pagination.total}
        description="Volunteer applications, active roster and service records. Approvals move applicants to active status."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by application status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const isSelected = active === filter.value;
            const href = `/admin/volunteers?status=${filter.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
            return (
              <Link
                key={filter.value}
                href={href}
                aria-current={isSelected ? 'page' : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>

        <form
          className="flex w-full items-center gap-2 sm:w-auto"
          method="get"
          action="/admin/volunteers"
        >
          {active !== 'pending' ? <input type="hidden" name="status" value={active} /> : null}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search name, email, VOL#..."
              aria-label="Search volunteers"
              className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/volunteers${active !== 'pending' ? `?status=${active}` : ''}`}>
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </div>

      {data.items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <UserCheck className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">
              {active === 'pending' ? 'Review queue clear' : 'No volunteers found'}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {active === 'pending'
                ? 'There are no pending volunteer applications awaiting an onboarding decision.'
                : 'No volunteer profiles match this filter criteria.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Volunteer applicants and team roster with verified service hours.
              </caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Volunteer
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Volunteer ID
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Skills & Focus
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Verified Hours
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Applied Date
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.items.map((volunteer) => {
                  const name =
                    [volunteer.firstName, volunteer.lastName].filter(Boolean).join(' ') ||
                    'Unnamed applicant';
                  return (
                    <tr key={volunteer.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        {can(actor, 'volunteer.read') ? (
                          <Link
                            href={`/admin/volunteers/${volunteer.id}`}
                            className="text-foreground hover:text-primary font-medium transition-colors"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="text-foreground font-medium">{name}</span>
                        )}
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {volunteer.city ?? 'Location unspecified'}
                        </p>
                      </td>
                      <td className="text-muted-foreground px-5 py-3.5 font-mono text-xs">
                        {volunteer.volunteerId ?? '—'}
                      </td>
                      <td className="text-foreground px-5 py-3.5 text-xs">
                        {volunteer.skills?.slice(0, 3).join(', ') || 'General support'}
                        {volunteer.skills && volunteer.skills.length > 3 ? (
                          <span className="text-muted-foreground ml-1">
                            +{volunteer.skills.length - 3}
                          </span>
                        ) : null}
                      </td>
                      <td
                        data-numeric=""
                        className="text-foreground px-5 py-3.5 text-right text-xs font-semibold tabular-nums"
                      >
                        {volunteer.verifiedHours}
                        {volunteer.totalHours !== volunteer.verifiedHours ? (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            / {volunteer.totalHours}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={TONE[volunteer.status] ?? 'neutral'}
                          className="text-[11px] capitalize"
                        >
                          {volunteer.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground px-5 py-3.5 text-xs">
                        {formatDate(volunteer.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {can(actor, 'volunteer.read') ? (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/admin/volunteers/${volunteer.id}`}>Details</Link>
                            </Button>
                          ) : null}
                        </div>
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
          activeStatus={active}
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
  activeStatus,
}: {
  page: number;
  totalPages: number;
  hasNext: boolean;
  query: { q?: string };
  activeStatus: string;
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    if (activeStatus && activeStatus !== 'pending') search.set('status', activeStatus);
    if (query.q) search.set('q', query.q);
    search.set('page', String(target));
    return `/admin/volunteers?${search.toString()}`;
  };

  return (
    <nav aria-label="Volunteers pagination" className="flex items-center justify-between pt-2">
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
