import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDate } from '@sailent/ui';

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
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/media" className="hover:text-foreground">
          Media
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{item.altText}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="border-border bg-surface-sunken overflow-hidden rounded-lg border">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={item.altText} className="w-full object-contain" />
            ) : (
              <p className="text-body-sm text-muted-foreground p-10 text-center">
                No preview — storage is not configured.
              </p>
            )}
          </div>

          <dl className="border-border text-body-sm divide-border divide-y rounded-lg border">
            <Row label="Type">{item.mimeType}</Row>
            <Row label="Size">{Math.round(item.sizeBytes / 1024)} KB</Row>
            <Row label="Dimensions">
              {item.width && item.height ? `${item.width} × ${item.height}` : 'Unknown'}
            </Row>
            <Row label="Visibility">{item.visibility}</Row>
            <Row label="Uploaded">{formatDate(item.createdAt)}</Row>
            {/*
              The storage key is shown because an administrator chasing a
              missing image needs it, and this screen is already behind
              `media.read`. It is never on a public response.
            */}
            <Row label="Storage key">
              <code className="break-all text-xs">{item.storageKey}</code>
            </Row>
          </dl>

          {item.visibility === 'private' ? (
            <p className="text-caption text-muted-foreground">
              This is a private image. The preview above uses a link that expires — it is not a
              permanent address and must not be shared.
            </p>
          ) : null}
        </div>

        <div>
          {can(actor, 'media.update') ? (
            <MediaDetailPanel item={item} />
          ) : (
            <p className="text-body-sm text-muted-foreground">
              You do not have permission to edit media.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
