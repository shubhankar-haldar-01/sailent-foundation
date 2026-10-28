import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Plus, Search, FolderKanban } from 'lucide-react';

import { Button, Card, CardContent, formatDate, PageHeader } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { adminFetch, type AdminProgram, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
] as const;

/**
 * Program list.
 *
 * Programs form the structural pillar under which fundraising campaigns are organized.
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FolderKanban className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">No programs found</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {params.q
                ? `No programs match “${params.q}”.`
                : 'No programs match the selected status filter.'}
            </p>
          </CardContent>
        </Card>
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
                  <th scope="col" className="px-5 py-3.5">
                    Thematic Category
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
                    <td className="text-muted-foreground px-5 py-3.5 text-xs">
                      {program.category ?? '—'}
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
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/programs/${program.id}/edit`}>Edit</Link>
                        </Button>
                        {program.status === 'published' ? (
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
  query: { status?: string; q?: string };
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    if (query.status && query.status !== 'all') search.set('status', query.status);
    if (query.q) search.set('q', query.q);
    search.set('page', String(target));
    return `/admin/programs?${search.toString()}`;
  };

  return (
    <nav aria-label="Programs pagination" className="flex items-center justify-between pt-2">
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
