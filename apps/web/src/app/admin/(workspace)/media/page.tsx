import Link from 'next/link';
import { Search, Image as ImageIcon } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@sailent/ui';

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
      <PageHeader
        title="Media Assets"
        description="Public and private media assets. Every image requires accessible alt text before public publication."
        count={data?.pagination.total}
        actions={can(actor, 'media.create') ? <UploadPanel /> : null}
      />

      {failure ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="text-body-sm text-destructive p-4">{failure}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by visibility" className="flex flex-wrap gap-1.5">
          {filters.map((filter) => (
            <Link
              key={filter}
              href={filter === 'all' ? '/admin/media' : `/admin/media?visibility=${filter}`}
              aria-current={active === filter ? 'page' : undefined}
              className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                active === filter
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {filter}
            </Link>
          ))}
        </nav>

        <form className="flex items-center gap-2" action="/admin/media">
          <input type="hidden" name="visibility" value={active} />
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search alt text, caption..."
              aria-label="Search media"
              className="border-input bg-surface text-body-sm shadow-xs focus-visible:outline-ring h-9 w-64 rounded-md border pl-8 pr-3 focus-visible:outline-2"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="text-primary size-4" />
            Image Library
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} assets found` : 'Asset gallery'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              {params.q
                ? `No image matches “${params.q}”.`
                : 'Nothing here yet. Upload an image to get started.'}
            </div>
          ) : null}

          {data && data.items.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/media/${item.id}`}
                    className="focus-visible:outline-ring block rounded-lg"
                  >
                    <MediaTile item={item} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {data && data.pagination.totalPages > 1 ? (
            <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
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
            </div>
          ) : null}
        </CardContent>
      </Card>
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
