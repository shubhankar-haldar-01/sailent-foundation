import Link from 'next/link';
import { Plus, Search, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

import {
  Badge,
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
      <PageHeader
        title="Impact Stories"
        description="First-person beneficiary accounts. Named subjects require recorded consent prior to publication."
        count={data?.pagination.total}
        actions={
          can(actor, 'story.create') ? (
            <Button asChild>
              <Link href="/admin/stories/new">
                <Plus className="mr-1.5 size-4" />
                Draft Story
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
              href={status === 'all' ? '/admin/stories' : `/admin/stories?status=${status}`}
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

        <form className="flex items-center gap-2" action="/admin/stories">
          <input type="hidden" name="status" value={active} />
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search title, person, place..."
              aria-label="Search stories"
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
            <BookOpen className="text-primary size-4" />
            Stories Library
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} stories in current view` : 'Story entries'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              {params.q ? `No story matches “${params.q}”.` : 'No story matches this view.'}
            </div>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="border-border/70 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Story Title & Context</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Subject Person</TableHead>
                    <TableHead className="font-semibold">Consent Verification</TableHead>
                    <TableHead className="text-right font-semibold">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((story) => (
                    <TableRow key={story.id}>
                      <TableCell className="max-w-md">
                        <Link
                          href={`/admin/stories/${story.id}`}
                          className="text-body-sm hover:text-primary block truncate font-semibold transition-colors"
                        >
                          {story.title}
                        </Link>
                        <p className="text-caption text-muted-foreground/80 mt-0.5">
                          {story.programTitle ?? story.campaignTitle ?? story.location ?? '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={story.status} />
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground">
                        {story.subjectName ?? <span className="italic">Nobody named</span>}
                      </TableCell>
                      <TableCell>
                        <ConsentCell story={story} />
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground text-right">
                        {formatDate(story.updatedAt)}
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

/** Says what is true, and — where it matters — what it prevents. */
function ConsentCell({ story }: { story: AdminStorySummary }) {
  if (!story.subjectName) {
    return <span className="text-caption text-muted-foreground">Not needed</span>;
  }
  if (story.isAnonymised) {
    return <Badge variant="neutral">Anonymised</Badge>;
  }
  if (story.consentObtained) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="size-3" />
        Recorded
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1">
      <AlertCircle className="size-3" />
      Missing Consent
    </Badge>
  );
}

function pageHref(params: { status?: string; q?: string }, page: number) {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  search.set('page', String(page));
  return `/admin/stories?${search.toString()}`;
}
