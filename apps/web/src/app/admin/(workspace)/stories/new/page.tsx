import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StoryForm } from '@/components/admin/story-form';
import { listMedia } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** A new story is always a draft. Publishing is a separate, permissioned step. */
export default async function NewStoryPage() {
  const actor = await currentActor();
  if (!can(actor, 'story.create')) notFound();

  /*
    PUBLIC images only, and a failure here must not block drafting a story —
    the picker is a convenience and the field still accepts a pasted URL.
  */
  const media = can(actor, 'media.read')
    ? await listMedia({ visibility: 'public', limit: 10 }).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/stories" className="hover:text-foreground">
          Success stories
        </Link>
        <span aria-hidden="true"> / </span>
        <span>New</span>
      </nav>

      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Draft a story</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Saved as a draft. Nothing is public until you publish it deliberately.
        </p>
      </header>

      <StoryForm mediaOptions={media?.items ?? []} />
    </div>
  );
}
