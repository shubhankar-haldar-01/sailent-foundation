import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  formatDate,
} from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { PageComposer, PageRevisions, PageStatusControls } from '@/components/admin/page-composer';
import { AdminApiError, getPage, type AdminPage } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One page: compose it, decide whether it goes live, and restore an old version.
 *
 * Reading is not `@Sensitive()` — an editor works on a layout over several
 * sittings — but the STATUS change and the REVERT are, because both replace
 * what visitors see.
 */
export default async function AdminPageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let page: AdminPage | null = null;

  try {
    page = await getPage(id);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return (
        <ReauthPanel returnTo={`/admin/pages/${id}`} what="This may be an unpublished layout." />
      );
    }
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const liveHref = page.slug === 'home' ? '/' : `/${page.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={page.title}
        description={`Target route: /${page.slug === 'home' ? '' : page.slug} · Version ${
          page.version
        } · Updated ${formatDate(page.updatedAt)}`}
        status={<StatusPill status={page.status} />}
        actions={
          page.isLive ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={liveHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-4" />
                View live
              </Link>
            </Button>
          ) : null
        }
      />

      {can(actor, 'page.publish') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishing & Status</CardTitle>
            <CardDescription>
              Control publication status and scheduling for this route layout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PageStatusControls page={page} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Section Structure</CardTitle>
          <CardDescription>
            Arrange approved sections, configure section options, and save layout updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PageComposer page={page} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version History & Rollbacks</CardTitle>
          <CardDescription>
            Audit changes made to this route layout and revert to previous versions if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PageRevisions page={page} />
        </CardContent>
      </Card>
    </div>
  );
}
