import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  formatDate,
} from '@sailent/ui';

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

  const categories = await adminFetch<{ items: AdminCategory[] }>('admin/categories')
    .then((result) => result.items)
    .catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={post.title}
        description={`Author: ${post.authorName ?? 'None recorded'} · Last updated ${formatDate(
          post.updatedAt,
        )}`}
        status={<StatusPill status={post.status} />}
        actions={
          post.status === 'published' ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-4" />
                View live
              </Link>
            </Button>
          ) : null
        }
      />

      {can(actor, 'blog.publish') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishing & Status</CardTitle>
            <CardDescription>Control publication status and public visibility.</CardDescription>
          </CardHeader>
          <CardContent>
            <BlogStatusControls post={post} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Article Content & Metadata</CardTitle>
          <CardDescription>Edit title, category, media, excerpt, and body content.</CardDescription>
        </CardHeader>
        <CardContent>
          <BlogForm post={post} mediaOptions={media?.items ?? []} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
