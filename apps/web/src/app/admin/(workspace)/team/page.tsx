import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Search, Users } from 'lucide-react';

import { Alert, Button, Card, formatDate, PageHeader } from '@sailent/ui';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { DeleteTeamMemberButton } from '@/components/admin/delete-team-member';
import { IssueIdentityCardDialog } from '@/components/admin/identity-card-dialog';
import { AdminListEmpty, isFiltered } from '@/components/admin/list-empty';
import { StatusPill } from '@/components/admin/status-pill';
import { AdminApiError, adminFetch, type AdminTeamMember, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
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
  searchParams: Promise<{ status?: string; q?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  let data: Paginated<AdminTeamMember> = {
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false },
  };
  let failure: string | null = null;

  try {
    data = await adminFetch<Paginated<AdminTeamMember>>('admin/team', {
      query: {
        status: params.status ?? 'all',
        q: params.q,
        page: params.page,
        limit: 10,
        sort: params.sort ?? '-createdAt',
      },
    });
  } catch (error) {
    if (
      error instanceof AdminApiError &&
      (error.status === 401 || error.code === 'UNAUTHENTICATED')
    ) {
      redirect('/admin/login?next=%2Fadmin%2Fteam');
    }
    failure = error instanceof AdminApiError ? error.message : 'Could not load team directory.';
  }

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

      {failure ? (
        <Alert variant="destructive" title="Unable to load team members">
          {failure}
        </Alert>
      ) : null}

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
        <AdminListEmpty
          icon={Users}
          noun="team members"
          filtered={isFiltered(params)}
          clearHref="/admin/team"
          filteredDescription={
            params.q
              ? `No team members match “${params.q}”.`
              : 'No team members match the selected status filter.'
          }
          emptyDescription="Team members you add appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Team directory members.</caption>
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
                        href={`/admin/team/${member.id}/edit${params.page && Number(params.page) > 1 ? `?page=${params.page}` : ''}`}
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
                    <td className="px-5 py-3.5">
                      <StatusPill status={member.status} />
                    </td>
                    <td className="text-muted-foreground px-5 py-3.5 text-xs">
                      {formatDate(member.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <IssueIdentityCardDialog
                          initialData={{
                            id: member.id,
                            name: member.name,
                            designation: member.designation,
                            department: member.department,
                            email: member.emailPublic || member.linkedAccountEmail,
                            photoUrl: member.photoUrl,
                            companyName: 'SAILENT FOUNDATION',
                          }}
                        />
                        {can(actor, 'team.manage') ? (
                          <DeleteTeamMemberButton
                            id={member.id}
                            name={member.name}
                            slug={member.slug}
                            variant="ghost"
                            label="Delete"
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AdminPagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        totalItems={data.pagination.total}
        ariaLabel="Team members pagination"
        makeHref={(p) => {
          const search = new URLSearchParams();
          if (active && active !== 'all') search.set('status', active);
          if (params.q) search.set('q', params.q);
          search.set('page', String(p));
          return `/admin/team?${search.toString()}`;
        }}
      />
    </div>
  );
}
