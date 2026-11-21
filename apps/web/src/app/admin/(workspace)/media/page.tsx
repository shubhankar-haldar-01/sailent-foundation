import Link from 'next/link';
import { Search, X, Globe, Lock, Layers } from 'lucide-react';

import { Button, Card, CardContent, PageHeader } from '@sailent/ui';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { MediaGallery, UploadPanel } from '@/components/admin/media-library';
import { AdminApiError, listMedia, type AdminMedia, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * The media library.
 *
 * Paginated at 24 a page rather than loading the table — a library grows
 * without bound and every tile is an image request.
 */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ visibility?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  let data: Paginated<AdminMedia> | null = null;
  let failure: string | null = null;

  try {
    data = await listMedia({ visibility: params.visibility, q: params.q, page: params.page });
  } catch (error) {
    failure =
      error instanceof AdminApiError ? error.message : 'Could not load the media library just now.';
  }

  const filters = [
    { key: 'all', label: 'All assets', icon: Layers },
    { key: 'public', label: 'Public', icon: Globe },
    { key: 'private', label: 'Private', icon: Lock },
  ] as const;
  const active = params.visibility ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media assets"
        description="Public and private media assets. Every image requires accessible alt text before publication."
        count={data?.pagination.total}
        actions={can(actor, 'media.create') ? <UploadPanel /> : null}
      />

      {failure ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="text-body-sm text-destructive p-4">{failure}</CardContent>
        </Card>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="border-border/70 bg-surface shadow-xs flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by visibility" className="flex flex-wrap items-center gap-1.5">
          {filters.map((filter) => {
            const Icon = filter.icon;
            const isCurrent = active === filter.key;
            return (
              <Link
                key={filter.key}
                href={
                  filter.key === 'all'
                    ? params.q
                      ? `/admin/media?q=${encodeURIComponent(params.q)}`
                      : '/admin/media'
                    : params.q
                      ? `/admin/media?visibility=${filter.key}&q=${encodeURIComponent(params.q)}`
                      : `/admin/media?visibility=${filter.key}`
                }
                aria-current={isCurrent ? 'page' : undefined}
                className={`text-caption flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{filter.label}</span>
              </Link>
            );
          })}
        </nav>

        <form className="flex items-center gap-2" action="/admin/media">
          {active !== 'all' ? <input type="hidden" name="visibility" value={active} /> : null}
          <div className="relative flex-1 sm:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search alt text, caption..."
              aria-label="Search media"
              className="border-input bg-surface text-body-sm shadow-xs focus-visible:outline-ring h-9 w-full rounded-md border pl-8 pr-8 focus-visible:outline-2"
            />
            {params.q ? (
              <Link
                href={active !== 'all' ? `/admin/media?visibility=${active}` : '/admin/media'}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
              >
                <X className="size-3.5" />
              </Link>
            ) : null}
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-9">
            Search
          </Button>
        </form>
      </div>

      {/* Main Gallery Area */}
      <MediaGallery items={data?.items ?? []} query={params.q} />

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 ? (
        <AdminPagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.total}
          ariaLabel="Media pagination"
          makeHref={(p) => pageHref(params, p)}
        />
      ) : null}
    </div>
  );
}

function pageHref(params: { visibility?: string; q?: string }, page: number) {
  const search = new URLSearchParams();
  if (params.visibility && params.visibility !== 'all') search.set('visibility', params.visibility);
  if (params.q) search.set('q', params.q);
  search.set('page', String(page));
  return `/admin/media?${search.toString()}`;
}
