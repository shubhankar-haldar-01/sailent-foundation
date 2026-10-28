import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, FileSpreadsheet } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { ReauthPanel } from '@/components/admin/reauth-panel';
import {
  DocumentDetailsForm,
  DownloadButton,
  VisibilityBadge,
  VisibilityControls,
  DeleteDocumentControls,
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
      <PageHeader
        title={document.title}
        description={`${DOCUMENT_TYPE_LABELS[document.documentType] ?? document.documentType} · ${formatBytes(
          document.sizeBytes,
        )} · ${document.fileName}`}
        status={<VisibilityBadge visibility={document.visibility} />}
        actions={
          can(actor, 'document.read') ? (
            <DownloadButton id={document.id} visibility={document.visibility} />
          ) : null
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="text-primary size-4" />
            Document Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="text-body-sm grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-border/60 bg-muted/20 rounded-md border p-3">
              <dt className="text-caption text-muted-foreground">Financial Year</dt>
              <dd className="mt-1 font-semibold">{document.financialYear ?? '—'}</dd>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-md border p-3">
              <dt className="text-caption text-muted-foreground">Campaign Attachment</dt>
              <dd className="mt-1 font-semibold">
                {document.relatedType === 'campaign' && document.relatedId ? (
                  <Link
                    href={`/admin/campaigns/${document.relatedId}/edit`}
                    className="text-primary hover:underline"
                  >
                    View Campaign
                  </Link>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </dd>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-md border p-3">
              <dt className="text-caption text-muted-foreground">Published Date</dt>
              <dd className="mt-1 font-semibold">
                {document.publishedAt
                  ? new Date(document.publishedAt).toLocaleDateString()
                  : 'Unpublished'}
              </dd>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-md border p-3">
              <dt className="text-caption text-muted-foreground">Download Count</dt>
              <dd className="mt-1 font-mono font-semibold">{document.downloadCount}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {document.relatedType !== 'campaign' && document.visibility === 'public' ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="text-warning mt-0.5 size-5 shrink-0" />
            <p className="text-body-sm text-foreground">
              This document is marked public but attached to nothing, so no visitor can reach it.
              Public documents are surfaced only on the campaign to which they are linked.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {can(actor, 'document.manage') ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Document Properties</CardTitle>
              <CardDescription>Edit title, description, and campaign relationship.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentDetailsForm document={document} />
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-6">
          {can(actor, 'document.change_visibility') ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Access & Visibility</CardTitle>
                <CardDescription>
                  Modify who is permitted to access and download this file.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VisibilityControls document={document} />
              </CardContent>
            </Card>
          ) : null}

          {can(actor, 'document.delete') ? (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive text-base">Danger Zone</CardTitle>
                <CardDescription>Permanently delete this document from storage.</CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteDocumentControls document={document} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
