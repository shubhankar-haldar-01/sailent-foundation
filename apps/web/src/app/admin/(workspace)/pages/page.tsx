import Link from 'next/link';
import { Plus, LayoutTemplate } from 'lucide-react';

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
      <PageHeader
        title="Page Composer"
        description="Configure which approved sections appear on primary site routes and their display sequence."
        count={data?.pagination.total}
        actions={
          can(actor, 'page.create') ? (
            <Button asChild>
              <Link href="/admin/pages/new">
                <Plus className="mr-1.5 size-4" />
                Compose Page
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

      <div className="flex flex-wrap items-center gap-1.5">
        {statuses.map((status) => (
          <Link
            key={status}
            href={status === 'all' ? '/admin/pages' : `/admin/pages?status=${status}`}
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
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutTemplate className="text-primary size-4" />
            Configured Layouts
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} pages configured` : 'Composed layouts'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              No page matches this view.
            </div>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="border-border/70 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Route & Title</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Active Sections</TableHead>
                    <TableHead className="font-semibold">Version</TableHead>
                    <TableHead className="text-right font-semibold">Last Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="max-w-md">
                        <Link
                          href={`/admin/pages/${page.id}`}
                          className="text-body-sm hover:text-primary block font-semibold transition-colors"
                        >
                          {page.title}
                        </Link>
                        <p className="text-caption text-muted-foreground/80 mt-0.5 font-mono">
                          /{page.slug === 'home' ? '' : page.slug}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={page.status} />
                        {page.scheduledAt && new Date(page.scheduledAt) > new Date() ? (
                          <p className="text-caption text-warning mt-1">
                            from {formatDate(page.scheduledAt)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {page.sectionCount}
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground font-mono">
                        v{page.version}
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground text-right">
                        {formatDate(page.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
