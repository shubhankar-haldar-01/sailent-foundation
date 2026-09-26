import Link from 'next/link';

import { Button, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  AdminApiError,
  listStories,
  type AdminStorySummary,
  type Paginated,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Success stories.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DRAFTS ARE VISIBLE HERE AND NOWHERE ELSE, which is the reason `story.read`
 * is a permission separate from the public listing: a draft about a named
 * beneficiary who has not yet consented is exactly what the publish gate
 * exists to keep off the public site.
 *
 * The consent column is not decoration. It is the first thing an editor needs
 * to know about a story they are about to publish.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  let data: Paginated<AdminStorySummary> | null = null;
  let failure: string | null = null;

  try {
    data = await listStories({ status: params.status, q: params.q, page: params.page });
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return (
        <ReauthPanel
          returnTo="/admin/stories"
          what="Drafts can name people who have not consented."
        />
      );
    }
    failure = error instanceof AdminApiError ? error.message : 'Could not load stories just now.';
  }

  const statuses = ['all', 'draft', 'published', 'archived'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Success stories</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data ? `${data.pagination.total} total. ` : ''}
            Each one is somebody’s account of their own life. A story that names a person cannot be
            published until they have agreed, or it has been anonymised.
          </p>
        </div>
        {can(actor, 'story.create') ? (
          <Button asChild>
            <Link href="/admin/stories/new">Draft a story</Link>
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
              href={status === 'all' ? '/admin/stories' : `/admin/stories?status=${status}`}
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

        <form className="ml-auto flex gap-2" action="/admin/stories">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search title, person or place"
            aria-label="Search stories"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data && data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          {params.q ? `No story matches “${params.q}”.` : 'No story matches this view.'}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <caption className="sr-only">Success stories</caption>
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Person
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Consent
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((story) => (
                <tr key={story.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/stories/${story.id}`}
                      className="hover:text-primary font-medium"
                    >
                      {story.title}
                    </Link>
                    <p className="text-caption text-muted-foreground">
                      {story.programTitle ?? story.campaignTitle ?? story.location ?? '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={story.status} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {story.subjectName ?? 'Nobody named'}
                  </td>
                  <td className="px-4 py-3">
                    <ConsentCell story={story} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{formatDate(story.updatedAt)}</td>
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

/** Says what is true, and — where it matters — what it prevents. */
function ConsentCell({ story }: { story: AdminStorySummary }) {
  if (!story.subjectName) return <span className="text-muted-foreground">Not needed</span>;
  if (story.isAnonymised) return <span className="text-muted-foreground">Anonymised</span>;
  if (story.consentObtained) return <span className="text-success">Recorded</span>;
  return <span className="text-warning font-medium">Missing — cannot publish</span>;
}

function pageHref(params: { status?: string; q?: string }, page: number) {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  search.set('page', String(page));
  return `/admin/stories?${search.toString()}`;
}
