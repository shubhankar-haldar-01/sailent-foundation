import Link from 'next/link';
import { Plus, Search, FileText } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatDate,
} from '@sailent/ui';

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
      <PageHeader
        title="Blog Articles"
        description="Editorial content published under the organisation’s voice. Drafts remain internal until publication."
        count={data?.pagination.total}
        actions={
          can(actor, 'blog.create') ? (
            <Button asChild>
              <Link href="/admin/blog/new">
                <Plus className="mr-1.5 size-4" />
                Write Article
              </Link>
            </Button>
          ) : null
        }
      />

      {failure ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="text-body-sm text-destructive p-4">{failure}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={status === 'all' ? '/admin/blog' : `/admin/blog?status=${status}`}
              aria-current={active === status ? 'page' : undefined}
              className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                active === status
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <form className="flex items-center gap-2" action="/admin/blog">
          <input type="hidden" name="status" value={active} />
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search title or summary..."
              aria-label="Search posts"
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
            <FileText className="text-primary size-4" />
            All Publications
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} articles match current criteria` : 'Articles list'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              {params.q ? `No post matches “${params.q}”.` : 'No post matches this view.'}
            </div>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="border-border/70 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Article Title</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">Author</TableHead>
                    <TableHead className="font-semibold">Published</TableHead>
                    <TableHead className="text-right font-semibold">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="max-w-md">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          className="text-body-sm hover:text-primary block truncate font-semibold transition-colors"
                        >
                          {post.title}
                        </Link>
                        <p className="text-caption text-muted-foreground/80 mt-0.5 font-mono">
                          /blog/{post.slug}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={post.status} />
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground">
                        {post.categoryName ?? '—'}
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground">
                        {post.authorName ?? '—'}
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground">
                        {post.publishedAt ? formatDate(post.publishedAt) : '—'}
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground text-right">
                        {formatDate(post.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {data && data.pagination.totalPages > 1 ? (
            <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
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

function pageHref(params: { status?: string; q?: string }, page: number) {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  search.set('page', String(page));
  return `/admin/blog?${search.toString()}`;
}
