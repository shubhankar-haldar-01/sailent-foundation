import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDate } from '@sailent/ui';

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

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/pages" className="hover:text-foreground">
          Pages
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{page.title}</span>
      </nav>

      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">{page.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
          <StatusPill status={page.status} />
          <span>·</span>
          <span>/{page.slug === 'home' ? '' : page.slug}</span>
          <span>·</span>
          <span>version {page.version}</span>
          <span>·</span>
          <span>Updated {formatDate(page.updatedAt)}</span>
          {page.isLive ? (
            <>
              <span>·</span>
              <Link
                href={page.slug === 'home' ? '/' : `/${page.slug}`}
                className="hover:text-foreground underline"
              >
                View it live
              </Link>
            </>
          ) : null}
        </p>
      </header>

      {can(actor, 'page.publish') ? <PageStatusControls page={page} /> : null}

      <PageComposer page={page} />

      <section aria-labelledby="revisions-heading" className="border-border border-t pt-6">
        <h2 id="revisions-heading" className="text-h4 mb-3 font-semibold">
          Version history
        </h2>
        <PageRevisions page={page} />
      </section>
    </div>
  );
}
