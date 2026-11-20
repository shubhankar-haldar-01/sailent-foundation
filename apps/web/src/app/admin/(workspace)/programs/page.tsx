import Link from 'next/link';
import { ExternalLink, Plus, Search, FolderKanban } from 'lucide-react';

import { Button, Card, formatDate, PageHeader } from '@sailent/ui';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminListEmpty, isFiltered } from '@/components/admin/list-empty';
import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminProgram, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
] as const;

/**
 * Program list.
 *
 * Programs form the structural pillar under which fundraising campaigns are organized.
 */
export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<AdminProgram>>('admin/programs', {
    query: {
      status: params.status ?? 'all',
      q: params.q,
      page: params.page,
      limit: 10,
      sort: params.sort ?? '-createdAt',
    },
  });

  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programs"
        count={data.pagination.total}
        description="Thematic program pillars. Every campaign belongs to a program to maintain organizational accountability."
        actions={
          can(actor, 'program.create') ? (
            <Button asChild className="gap-1.5">
              <Link href="/admin/programs/new">
                <Plus className="size-4" aria-hidden="true" />
                New program
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
            const href = `/admin/programs?status=${status.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
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
          action="/admin/programs"
        >
          {active !== 'all' ? <input type="hidden" name="status" value={active} /> : null}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search programs..."
              aria-label="Search programs"
              className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/programs${active !== 'all' ? `?status=${active}` : ''}`}>
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </div>

      {data.items.length === 0 ? (
        <AdminListEmpty
          icon={FolderKanban}
          noun="programs"
          filtered={isFiltered(params)}
          clearHref="/admin/programs"
          filteredDescription={
            params.q
              ? `No programs match “${params.q}”.`
              : 'No programs match the selected status filter.'
          }
          emptyDescription="New programs appear here, starting as drafts."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Programs with associated campaigns count and publication status.
              </caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Program
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Campaigns
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
                {data.items.map((program) => (
                  <tr key={program.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/programs/${program.id}/edit`}
                        className="text-foreground hover:text-primary font-medium transition-colors"
                      >
                        {program.title}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 text-xs">/{program.slug}</p>
                    </td>
                    <td
                      data-numeric=""
                      className="text-foreground px-5 py-3.5 text-right text-xs font-semibold tabular-nums"
                    >
                      {program.campaignCount}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={program.status} />
                    </td>
                    <td className="text-muted-foreground px-5 py-3.5 text-xs">
                      {formatDate(program.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      {program.status === 'published' ? (
                        <div className="flex items-center justify-end">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Link
                              href={`/programs/${program.slug}`}
                              target="_blank"
                              aria-label={`View ${program.title} on public site`}
                            >
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                            </Link>
                          </Button>
                        </div>
                      ) : null}
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
        ariaLabel="Programs pagination"
        makeHref={(p) => {
          const search = new URLSearchParams();
          if (params.status && params.status !== 'all') search.set('status', params.status);
          if (params.q) search.set('q', params.q);
          search.set('page', String(p));
          return `/admin/programs?${search.toString()}`;
        }}
      />
    </div>
  );
}
