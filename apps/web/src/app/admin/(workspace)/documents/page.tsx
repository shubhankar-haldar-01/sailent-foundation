import Link from 'next/link';

import { ReauthPanel } from '@/components/admin/reauth-panel';
import { UploadPanel, VisibilityBadge } from '@/components/admin/document-library';
import { DOCUMENT_TYPE_LABELS, formatBytes } from '@/lib/admin/documents';
import {
  AdminApiError,
  adminFetch,
  listDocuments,
  type AdminCampaign,
  type AdminDocument,
  type Paginated,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Reports & documents.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE HEADING SAYS WHAT THIS IS NOT.
 *
 * `docs/information-architecture.md` §1.2 removed `/reports` and
 * `/transparency` outright: "The platform does not publish documents to the
 * public at all … a half-empty document library damages trust more than no
 * library does." So this screen is the ONLY place documents live, and an
 * administrator arriving here should not be left guessing whether uploading
 * something puts it on the website. It does not, unless they make it public
 * AND attach it to a campaign.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ visibility?: string; documentType?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  let data: Paginated<AdminDocument> | null = null;
  let failure: string | null = null;
  let campaigns: { id: string; title: string }[] = [];

  try {
    data = await listDocuments({
      visibility: params.visibility,
      documentType: params.documentType,
      page: params.page,
    });
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return (
        <ReauthPanel
          returnTo="/admin/documents"
          what="This library holds audited financials, internal policy papers and other private files."
        />
      );
    }
    failure =
      error instanceof AdminApiError ? error.message : 'Could not load the documents just now.';
  }

  if (can(actor, 'document.manage')) {
    try {
      // Only for the "attach to a campaign" picker. A failure here must not
      // take the library down with it.
      const list = await adminFetch<Paginated<AdminCampaign>>('admin/campaigns', {
        query: { limit: 100 },
      });
      campaigns = list.items.map((campaign) => ({ id: campaign.id, title: campaign.title }));
    } catch {
      campaigns = [];
    }
  }

  const active = params.visibility ?? 'all';
  const filters = ['all', 'public', 'private', 'admin_only'] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Reports &amp; documents</h1>
          <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
            {data ? `${data.pagination.total} documents. ` : ''}
            Nothing here is published to the website. A document reaches a visitor only when it is
            marked public <em>and</em> attached to a campaign — there is no public document library.
          </p>
        </div>
        {can(actor, 'document.manage') ? <UploadPanel campaigns={campaigns} /> : null}
      </header>

      {failure ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {failure}
        </p>
      ) : null}

      <nav aria-label="Filter by visibility" className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const href =
            filter === 'all' ? '/admin/documents' : `/admin/documents?visibility=${filter}`;
          return (
            <Link
              key={filter}
              href={href}
              aria-current={active === filter ? 'page' : undefined}
              className={
                active === filter
                  ? 'bg-foreground text-background text-body-sm rounded-full px-3 py-1.5 font-semibold'
                  : 'border-border text-body-sm hover:bg-muted rounded-full border px-3 py-1.5'
              }
            >
              {filter === 'all'
                ? 'All'
                : filter === 'admin_only'
                  ? 'Admin only'
                  : filter[0]!.toUpperCase() + filter.slice(1)}
            </Link>
          );
        })}
      </nav>

      {data && data.items.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          No documents yet. Annual reports, audited statements and policies live here.
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[46rem] text-left">
            <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Visibility
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Year
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Size
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.items.map((document) => (
                <tr key={document.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/documents/${document.id}`}
                      className="text-body-sm hover:text-info-action font-semibold"
                    >
                      {document.title}
                    </Link>
                    <p className="text-caption text-muted-foreground mt-0.5">{document.fileName}</p>
                  </td>
                  <td className="text-body-sm px-4 py-3">
                    {DOCUMENT_TYPE_LABELS[document.documentType] ?? document.documentType}
                  </td>
                  <td className="px-4 py-3">
                    <VisibilityBadge visibility={document.visibility} />
                  </td>
                  <td className="text-body-sm text-muted-foreground px-4 py-3">
                    {document.financialYear ?? '—'}
                  </td>
                  <td className="text-body-sm text-muted-foreground px-4 py-3">
                    {formatBytes(document.sizeBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
