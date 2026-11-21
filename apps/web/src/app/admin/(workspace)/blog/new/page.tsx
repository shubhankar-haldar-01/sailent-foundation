import { notFound } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
import { BlogForm } from '@/components/admin/blog-form';
import { listMedia } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** A new post is always a draft. Publishing is a separate, permissioned step. */
export default async function NewBlogPostPage() {
  const actor = await currentActor();
  if (!can(actor, 'blog.create')) notFound();

  /*
    Neither of these may block writing. The picker and the category list are
    conveniences; an article can be drafted without either, and a media library
    that is briefly unavailable must not stop somebody starting a post.
  */
  const media = can(actor, 'media.read')
    ? await listMedia({ visibility: 'public', limit: 12 }).catch(() => null)
    : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Write article"
        breadcrumb={<AdminBackButton href="/admin/blog">Back to blog</AdminBackButton>}
        description="Saved as a draft. Nothing is made public until published deliberately."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Article details</CardTitle>
          <CardDescription>Compose title, slug, excerpt, content, and metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          <BlogForm mediaOptions={media?.items ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
