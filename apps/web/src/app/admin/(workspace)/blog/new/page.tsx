import Link from 'next/link';
import { notFound } from 'next/navigation';

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
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/blog" className="hover:text-foreground">
          Blog
        </Link>
        <span aria-hidden="true"> / </span>
        <span>New</span>
      </nav>

      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Write a post</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Saved as a draft. Nothing is public until you publish it deliberately.
        </p>
      </header>

      <BlogForm mediaOptions={media?.items ?? []} categories={categories} />
    </div>
  );
}
