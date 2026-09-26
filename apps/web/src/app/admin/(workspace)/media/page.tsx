import Link from 'next/link';

import { Button } from '@sailent/ui';

import { MediaTile, UploadPanel } from '@/components/admin/media-library';
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

  const filters = ['all', 'public', 'private'] as const;
  const active = params.visibility ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Media</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data ? `${data.pagination.total} images. ` : ''}
            Every image carries alt text, because one that does not is unusable to anybody reading
            the site with a screen reader.
          </p>
        </div>
        {can(actor, 'media.create') ? <UploadPanel /> : null}
      </header>

      {failure ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {failure}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by visibility" className="flex flex-wrap gap-1.5">
          {filters.map((filter) => (
            <Link
              key={filter}
              href={filter === 'all' ? '/admin/media' : `/admin/media?visibility=${filter}`}
              aria-current={active === filter ? 'page' : undefined}
              className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
                active === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter}
            </Link>
          ))}
        </nav>

        <form className="ml-auto flex gap-2" action="/admin/media">
          <input type="hidden" name="visibility" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search alt text or caption"
            aria-label="Search media"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data && data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          {params.q
            ? `No image matches “${params.q}”.`
            : 'Nothing here yet. Upload an image to get started.'}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((item) => (
            <Link key={item.id} href={`/admin/media/${item.id}`} className="contents">
              <MediaTile item={item} />
            </Link>
          ))}
        </ul>
      ) : null}

      {data && data.pagination.totalPages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between">
          <p className="text-body-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            {data.pagination.page > 1 ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={pageHref(params, data.pagination.page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {data.pagination.page < data.pagination.totalPages ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={pageHref(params, data.pagination.page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </nav>
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
