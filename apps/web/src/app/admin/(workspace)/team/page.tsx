import Link from 'next/link';

import { Button, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminTeamMember, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * The public team directory, as staff see it.
 *
 * Ordered by `displayOrder` — the order the public page uses — rather than by
 * when somebody was added, because the question this screen answers most often
 * is "why is this person above that one".
 */
export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminTeamMember>>('admin/team', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      page: params.page,
      limit: 50,
      sort: 'displayOrder',
    },
  });

  const statuses = ['all', 'draft', 'published', 'archived'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Team</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data.pagination.total} total. Everyone here is a real person whose name and photograph
            go on a public page — nothing is published until you publish it.
          </p>
        </div>
        {can(actor, 'team.manage') ? (
          <Button asChild>
            <Link href="/admin/team/new">Add someone</Link>
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={`/admin/team?status=${status}`}
              aria-current={active === status ? 'page' : undefined}
              className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
                active === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <form className="ml-auto flex gap-2" action="/admin/team">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search name or role"
            aria-label="Search team"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          Nobody matches this view.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Department
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Order
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((member) => (
                <tr key={member.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/team/${member.id}/edit`}
                      className="hover:text-primary font-medium"
                    >
                      {member.name}
                    </Link>
                    <p className="text-caption text-muted-foreground">{member.designation}</p>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{member.department ?? '—'}</td>
                  <td className="text-muted-foreground px-4 py-3 capitalize">
                    {member.memberType}
                  </td>
                  <td data-numeric="" className="px-4 py-3 text-right tabular-nums">
                    {member.displayOrder}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={member.status} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formatDate(member.updatedAt)}
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
