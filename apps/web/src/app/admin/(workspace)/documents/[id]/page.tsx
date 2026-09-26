import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  DocumentDetailsForm,
  DownloadButton,
  VisibilityBadge,
  VisibilityControls,
} from '@/components/admin/document-library';
import { DOCUMENT_TYPE_LABELS, formatBytes } from '@/lib/admin/documents';
import { AdminApiError, getDocument } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One document.
 *
 * The visibility control is its own panel rather than a field in the metadata
 * form, because it is the one action on this screen that can disclose
 * something — and a field inside a "Save changes" form is a field somebody
 * changes on the way past.
 */
export default async function AdminDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let document;
  try {
    document = await getDocument(id);
  } catch (error) {
    if (error instanceof AdminApiError) {
      if (error.code === 'REAUTH_REQUIRED') {
        return (
          <ReauthPanel returnTo={`/admin/documents/${id}`} what="This document may be private." />
        );
      }
      if (error.status === 404) notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/documents" className="hover:text-foreground">
          Reports &amp; documents
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold tracking-tight">{document.title}</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {DOCUMENT_TYPE_LABELS[document.documentType] ?? document.documentType} ·{' '}
            {formatBytes(document.sizeBytes)} · {document.fileName}
          </p>
          <p className="mt-2">
            <VisibilityBadge visibility={document.visibility} />
          </p>
        </div>
        {can(actor, 'document.read') ? (
          <DownloadButton id={document.id} visibility={document.visibility} />
        ) : null}
      </header>

      <dl className="border-border text-body-sm grid gap-x-8 gap-y-2 rounded-lg border p-5 sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">Financial year</dt>
          <dd className="font-medium">{document.financialYear ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">Attached to</dt>
          <dd className="font-medium">
            {document.relatedType === 'campaign' && document.relatedId ? (
              <Link
                href={`/admin/campaigns/${document.relatedId}/edit`}
                className="hover:text-info-action underline"
              >
                A campaign
              </Link>
            ) : (
              'Nothing'
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">First published</dt>
          <dd className="font-medium">
            {document.publishedAt ? new Date(document.publishedAt).toLocaleDateString() : 'Never'}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">Times opened</dt>
          <dd className="font-medium">{document.downloadCount}</dd>
        </div>
      </dl>

      {document.relatedType !== 'campaign' && document.visibility === 'public' ? (
        <p
          role="status"
          className="border-warning/40 bg-warning/5 text-body-sm rounded-lg border p-4"
        >
          This document is public but attached to nothing, so no visitor can reach it. A public
          document appears only on the campaign it is attached to — there is no public document
          library.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {can(actor, 'document.manage') ? (
          <section className="border-border rounded-lg border p-5">
            <h2 className="text-h4 mb-4 font-semibold">Details</h2>
            <DocumentDetailsForm document={document} />
          </section>
        ) : null}

        {can(actor, 'document.change_visibility') ? (
          <VisibilityControls document={document} />
        ) : null}
      </div>
    </div>
  );
}
