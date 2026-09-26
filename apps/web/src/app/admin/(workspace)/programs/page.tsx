import Link from 'next/link';

import { Button, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminProgram, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Program list.
 *
 * Filtering is SERVER-SIDE, through query parameters the API understands —
 * the whole table is never pulled into the browser to be filtered there. The
 * filters are plain links and a GET form, so they work without JavaScript and
 * every filtered view has its own shareable URL.
 */
export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminProgram>>('admin/programs', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      page: params.page,
      limit: 25,
      sort: 'displayOrder',
    },
  });

  const statuses = ['all', 'draft', 'published', 'archived'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Programs</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data.pagination.total} total. Campaigns attach to a program, so this is where the
            structure starts.
          </p>
        </div>
        {can(actor, 'program.create') ? (
          <Button asChild>
            <Link href="/admin/programs/new">New program</Link>
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={`/admin/programs?status=${status}`}
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

        <form className="ml-auto flex gap-2" action="/admin/programs">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search programs"
            aria-label="Search programs"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No programs match this view.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Program
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Campaigns
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Updated
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((program) => (
                <tr key={program.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/programs/${program.id}/edit`}
                      className="hover:text-primary font-medium"
                    >
                      {program.title}
                    </Link>
                    <p className="text-caption text-muted-foreground">/{program.slug}</p>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{program.category ?? '—'}</td>
                  <td data-numeric="" className="px-4 py-3 text-right tabular-nums">
                    {program.campaignCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={program.status} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formatDate(program.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/admin/programs/${program.id}/edit`}
                      className="text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    {program.status === 'published' ? (
                      <>
                        {' · '}
                        <Link
                          href={`/programs/${program.slug}`}
                          className="text-muted-foreground hover:underline"
                          target="_blank"
                        >
                          View
                        </Link>
                      </>
                    ) : null}
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
