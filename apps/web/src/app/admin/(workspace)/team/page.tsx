import Link from 'next/link';
import { Plus, Search, Users } from 'lucide-react';

import { Button, Card, CardContent, formatDate, PageHeader } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminTeamMember, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

/**
 * Team directory.
 *
 * Distinct from Volunteers: team members represent public leadership, trustees
 * and staff shown in the "Our Team" section of the public site.
 */
export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminTeamMember>>('admin/team', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      limit: 50,
      sort: 'displayOrder',
    },
  });

  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Directory"
        count={data.pagination.total}
        description="Public team members and leadership profiles displayed on the public About page."
        actions={
          can(actor, 'team.manage') ? (
            <Button asChild className="gap-1.5">
              <Link href="/admin/team/new">
                <Plus className="size-4" aria-hidden="true" />
                Add team member
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
            const href = `/admin/team?status=${status.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
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
          action="/admin/team"
        >
          {active !== 'all' ? <input type="hidden" name="status" value={active} /> : null}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search name or role..."
              aria-label="Search team"
              className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/team${active !== 'all' ? `?status=${active}` : ''}`}>Clear</Link>
            </Button>
          ) : null}
        </form>
      </div>

      {data.items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">No team members found</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {params.q
                ? `No team members match “${params.q}”.`
                : 'No team members match the selected status filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Team directory members ordered by public display rank.
              </caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Team Member
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Department
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Role Type
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Display Order
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Last Updated
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.items.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/team/${member.id}/edit`}
                        className="text-foreground hover:text-primary font-medium transition-colors"
                      >
                        {member.name}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 text-xs">{member.designation}</p>
                    </td>
                    <td className="text-foreground px-5 py-3.5 text-xs">
                      {member.department ?? 'General'}
                    </td>
                    <td className="text-muted-foreground px-5 py-3.5 text-xs capitalize">
                      {member.memberType}
                    </td>
                    <td
                      data-numeric=""
                      className="text-foreground px-5 py-3.5 text-right font-mono text-xs tabular-nums"
                    >
                      {member.displayOrder}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={member.status} />
                    </td>
                    <td className="text-muted-foreground px-5 py-3.5 text-xs">
                      {formatDate(member.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/team/${member.id}/edit`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
