import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { BlogForm, BlogStatusControls } from '@/components/admin/blog-form';
import {
  AdminApiError,
  adminFetch,
  getBlogPost,
  listMedia,
  type AdminBlogPost,
  type AdminCategory,
} from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One post: edit it, and decide whether it goes live.
 *
 * Reading is not `@Sensitive()` — an editor works on an article over several
 * sittings — but the STATUS change is, because publishing puts the
 * organisation's name behind it and archiving takes down something that may
 * already be linked.
 */
export default async function AdminBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let post: AdminBlogPost | null = null;

  try {
    post = await getBlogPost(id);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return (
        <ReauthPanel returnTo={`/admin/blog/${id}`} what="This post may be unpublished work." />
      );
    }
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

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
        <span>{post.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">{post.title}</h1>
          <p className="text-body-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <StatusPill status={post.status} />
            <span>·</span>
            <span>{post.authorName ?? 'No author recorded'}</span>
            <span>·</span>
            <span>Updated {formatDate(post.updatedAt)}</span>
            {post.status === 'published' ? (
              <>
                <span>·</span>
                <Link href={`/blog/${post.slug}`} className="hover:text-foreground underline">
                  View it live
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </header>

      {can(actor, 'blog.publish') ? <BlogStatusControls post={post} /> : null}

      <BlogForm post={post} mediaOptions={media?.items ?? []} categories={categories} />
    </div>
  );
}
