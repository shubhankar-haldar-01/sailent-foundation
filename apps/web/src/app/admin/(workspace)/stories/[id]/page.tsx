import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { StoryForm, StoryStatusControls } from '@/components/admin/story-form';
import { AdminApiError, getStory, type AdminStory } from '@/lib/admin/api';
import { listMedia } from '@/lib/admin/api';
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
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/stories" className="hover:text-foreground">
          Success stories
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{story.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">{story.title}</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            /stories/{story.slug}
            {story.status === 'published' ? (
              <>
                {' · '}
                <Link href={`/stories/${story.slug}`} className="hover:text-foreground underline">
                  View on the site
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <StatusPill status={story.status} />
      </header>

      {can(actor, 'story.publish') ? (
        <section className="space-y-3">
          <h2 className="text-h3 font-semibold">Publishing</h2>
          <StoryStatusControls story={story} canArchive={can(actor, 'story.archive')} />
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">Edit</h2>
        {can(actor, 'story.update') ? (
          <StoryForm story={story} mediaOptions={media?.items ?? []} />
        ) : (
          <p className="text-body-sm text-muted-foreground">
            You do not have permission to edit stories.
          </p>
        )}
      </section>
    </div>
  );
}
