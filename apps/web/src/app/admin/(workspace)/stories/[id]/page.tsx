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
} from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { StoryForm, StoryStatusControls } from '@/components/admin/story-form';
import { AdminApiError, getStory, type AdminStory, listMedia } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One story: edit it, and decide whether it goes live.
 *
 * Reading is not `@Sensitive()` — an editor works on a draft over several
 * sittings — but the STATUS change is, because publishing puts a named
 * person's account of their own life on a public website.
 */
export default async function AdminStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let story: AdminStory | null = null;

  try {
    story = await getStory(id);
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return (
        <ReauthPanel
          returnTo={`/admin/stories/${id}`}
          what="This story may name somebody who has not consented."
        />
      );
    }
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const media = can(actor, 'media.read')
    ? await listMedia({ visibility: 'public', limit: 10 }).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={story.title}
        description={`Slug: /stories/${story.slug}`}
        status={<StatusPill status={story.status} />}
        actions={
          story.status === 'published' ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/stories/${story.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-4" />
                View live
              </Link>
            </Button>
          ) : null
        }
      />

      {can(actor, 'story.publish') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishing Controls</CardTitle>
            <CardDescription>
              Consent verification is required before making any story public.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StoryStatusControls story={story} canArchive={can(actor, 'story.archive')} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Story Content & Metadata</CardTitle>
          <CardDescription>
            Subject details, quotes, narrative, media attachments, and permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {can(actor, 'story.update') ? (
            <StoryForm story={story} mediaOptions={media?.items ?? []} />
          ) : (
            <p className="text-body-sm text-muted-foreground">
              You do not have permission to edit stories.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
