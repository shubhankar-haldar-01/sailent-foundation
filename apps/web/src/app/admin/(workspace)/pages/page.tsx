import Link from 'next/link';

import { Button, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { AdminApiError, listPages, type AdminPageSummary, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Composed pages.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A PAGE HERE DOES NOT CREATE A ROUTE. The routes exist and are rendered by
 * the app; a row decides which approved sections one of them shows and in what
 * order. A slug nothing renders is simply a row nothing reads.
 *
 * There is no delete. A page is archived at most — its revisions are the record
 * of who changed the homepage and to what.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  let data: Paginated<AdminPageSummary> | null = null;
  let failure: string | null = null;

  try {
    data = await listPages({ status: params.status, page: params.page });
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return <ReauthPanel returnTo="/admin/pages" what="Drafts are unpublished layouts." />;
    }
    failure = error instanceof AdminApiError ? error.message : 'Could not load pages just now.';
  }

  const statuses = ['all', 'draft', 'published', 'archived'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Pages</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data ? `${data.pagination.total} total. ` : ''}
            Which approved sections a page shows, and in what order. A route without a published
            page falls back to its built-in order.
          </p>
        </div>
        {can(actor, 'page.create') ? (
          <Button asChild>
            <Link href="/admin/pages/new">Compose a page</Link>
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

      <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {statuses.map((status) => (
          <Link
            key={status}
            href={status === 'all' ? '/admin/pages' : `/admin/pages?status=${status}`}
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

      {data && data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No page matches this view.
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <caption className="sr-only">Composed pages</caption>
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Route
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Sections
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Version
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((page) => (
                <tr key={page.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pages/${page.id}`}
                      className="hover:text-primary font-medium"
                    >
                      {page.title}
                    </Link>
                    <p className="text-caption text-muted-foreground">
                      /{page.slug === 'home' ? '' : page.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={page.status} />
                    {page.scheduledAt && new Date(page.scheduledAt) > new Date() ? (
                      <p className="text-caption text-warning mt-1">
                        from {formatDate(page.scheduledAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{page.sectionCount}</td>
                  <td className="text-muted-foreground px-4 py-3">v{page.version}</td>
                  <td className="text-muted-foreground px-4 py-3">{formatDate(page.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
