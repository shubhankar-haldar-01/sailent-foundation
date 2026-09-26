import Link from 'next/link';

import { Button, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  AdminApiError,
  listBlogPosts,
  type AdminBlogSummary,
  type Paginated,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * The blog.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DRAFTS ARE VISIBLE HERE AND NOWHERE ELSE, which is why `blog.read` is a
 * permission separate from the public listing. A draft is an article the
 * organisation has not decided to stand behind, and it reads exactly like a
 * published one — so the only safe place for it is behind this screen.
 *
 * There is NO DELETE. Archiving keeps the row, its audit trail and its slug,
 * so a URL that was once live never becomes a lie.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  let data: Paginated<AdminBlogSummary> | null = null;
  let failure: string | null = null;

  try {
    data = await listBlogPosts({ status: params.status, q: params.q, page: params.page });
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return <ReauthPanel returnTo="/admin/blog" what="Drafts are unpublished work." />;
    }
    failure = error instanceof AdminApiError ? error.message : 'Could not load posts just now.';
  }

  const statuses = ['all', 'draft', 'published', 'archived'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Blog</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data ? `${data.pagination.total} total. ` : ''}
            Articles published under the organisation’s name. Drafts are never public.
          </p>
        </div>
        {can(actor, 'blog.create') ? (
          <Button asChild>
            <Link href="/admin/blog/new">Write a post</Link>
          </Button>
        ) : null}
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
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={status === 'all' ? '/admin/blog' : `/admin/blog?status=${status}`}
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

        <form className="ml-auto flex gap-2" action="/admin/blog">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search title or summary"
            aria-label="Search posts"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data && data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          {params.q ? `No post matches “${params.q}”.` : 'No post matches this view.'}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        /*
          The table scrolls sideways on a narrow screen rather than reflowing
          into cards. An editor scanning status and dates wants the columns
          aligned; the container is what keeps the page itself from scrolling.
        */
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <caption className="sr-only">Blog posts</caption>
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Author
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Published
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((post) => (
                <tr key={post.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="hover:text-primary font-medium"
                    >
                      {post.title}
                    </Link>
                    <p className="text-caption text-muted-foreground">/blog/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={post.status} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{post.categoryName ?? '—'}</td>
                  <td className="text-muted-foreground px-4 py-3">{post.authorName ?? '—'}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {post.publishedAt ? formatDate(post.publishedAt) : '—'}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{formatDate(post.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function pageHref(params: { status?: string; q?: string }, page: number) {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  search.set('page', String(page));
  return `/admin/blog?${search.toString()}`;
}
