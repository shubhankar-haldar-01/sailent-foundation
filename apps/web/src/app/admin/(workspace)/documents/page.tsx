import Link from 'next/link';

import {
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
} from '@sailent/ui';

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
      <PageHeader
        title="Institutional Documents"
        description="Audited financials, compliance filings, governance policies, and internal reports. Documents remain internal unless marked public and attached to a campaign."
        count={data?.pagination.total}
        actions={can(actor, 'document.manage') ? <UploadPanel campaigns={campaigns} /> : null}
      />

      {failure ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="text-body-sm text-destructive p-4">{failure}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => {
          const href =
            filter === 'all' ? '/admin/documents' : `/admin/documents?visibility=${filter}`;
          const isActive = active === filter;
          return (
            <Link
              key={filter}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {filter === 'all' ? 'All' : filter === 'admin_only' ? 'Admin only' : filter}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Document Repository</CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} documents catalogued` : 'Document files'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              No documents yet. Annual reports, audited statements and policies live here.
            </div>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="border-border/70 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Document Title</TableHead>
                    <TableHead className="font-semibold">Document Type</TableHead>
                    <TableHead className="font-semibold">Visibility</TableHead>
                    <TableHead className="font-semibold">Financial Year</TableHead>
                    <TableHead className="text-right font-semibold">File Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="max-w-md">
                        <Link
                          href={`/admin/documents/${document.id}`}
                          className="text-body-sm hover:text-primary block font-semibold transition-colors"
                        >
                          {document.title}
                        </Link>
                        <p className="text-caption text-muted-foreground/80 mt-0.5 font-mono">
                          {document.fileName}
                        </p>
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[document.documentType] ?? document.documentType}
                      </TableCell>
                      <TableCell>
                        <VisibilityBadge visibility={document.visibility} />
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground font-mono">
                        {document.financialYear ?? '—'}
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground text-right font-mono">
                        {formatBytes(document.sizeBytes)}
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
