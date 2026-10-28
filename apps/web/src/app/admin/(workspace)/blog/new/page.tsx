import { notFound } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { BlogForm } from '@/components/admin/blog-form';
import { adminFetch, listMedia, type AdminCategory } from '@/lib/admin/api';
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
  /*
    `{ items }`, not a bare array: the API's response interceptor wraps a list
    in that envelope, which every other caller of this endpoint already knows.
    Typing it as an array typechecked perfectly and then failed at runtime with
    "c.map is not a function" — on the server, so the whole page 500'd.

    No `kind` filter, deliberately. Reusing the shared taxonomy is the point:
    an article about the education programme belongs under the education the
    rest of the site already names, so every category is offered.
  */
  const categories = await adminFetch<{ items: AdminCategory[] }>('admin/categories')
    .then((result) => result.items)
    .catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Write Article"
        description="Saved as a draft. Nothing is made public until published deliberately."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Article Details</CardTitle>
          <CardDescription>Compose title, slug, excerpt, content, and metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          <BlogForm mediaOptions={media?.items ?? []} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
