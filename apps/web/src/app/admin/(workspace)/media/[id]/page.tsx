import { notFound } from 'next/navigation';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  formatDate,
} from '@sailent/ui';

import { MediaDetailPanel } from '@/components/admin/media-library';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { AdminApiError, getMedia, type AdminMediaDetail } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminMediaItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let item: AdminMediaDetail | null = null;

  try {
    item = await getMedia(id);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return <ReauthPanel returnTo={`/admin/media/${id}`} what="Media includes private images." />;
    }
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const src = item.url ?? item.signedUrl ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.altText || 'Media Asset'}
        description={`Uploaded ${formatDate(item.createdAt)} · ${Math.round(item.sizeBytes / 1024)} KB`}
        status={
          <Badge variant={item.visibility === 'public' ? 'success' : 'neutral'}>
            {item.visibility}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset Preview</CardTitle>
              <CardDescription>
                {item.visibility === 'private'
                  ? 'Private asset using temporary signed preview URL.'
                  : 'Public asset rendered from permanent storage CDN.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-border/60 bg-muted/20 flex min-h-[260px] items-center justify-center overflow-hidden rounded-lg border p-2">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={item.altText}
                    className="max-h-[380px] w-full rounded object-contain"
                  />
                ) : (
                  <p className="text-body-sm text-muted-foreground p-10 text-center">
                    No preview available — storage driver not initialized.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Technical Specifications</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="text-body-sm divide-border/60 divide-y">
                <Row label="MIME Type">{item.mimeType}</Row>
                <Row label="File Size">{Math.round(item.sizeBytes / 1024)} KB</Row>
                <Row label="Resolution">
                  {item.width && item.height ? `${item.width} × ${item.height} px` : 'Unknown'}
                </Row>
                <Row label="Visibility Policy">
                  <Badge variant={item.visibility === 'public' ? 'success' : 'neutral'}>
                    {item.visibility}
                  </Badge>
                </Row>
                <Row label="Uploaded At">{formatDate(item.createdAt)}</Row>
                <Row label="Storage Object Key">
                  <code className="text-caption text-muted-foreground break-all font-mono">
                    {item.storageKey}
                  </code>
                </Row>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata & Accessibility</CardTitle>
              <CardDescription>
                Configure alt text, descriptive captions, and visibility settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {can(actor, 'media.update') ? (
                <MediaDetailPanel item={item} />
              ) : (
                <p className="text-body-sm text-muted-foreground py-4">
                  You do not have permission to edit media properties.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
