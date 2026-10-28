import { notFound } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

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
      <PageHeader
        title="Draft Success Story"
        description="Saved as a draft. Nothing is public until verified and published deliberately."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Story Details & Subject</CardTitle>
          <CardDescription>
            Record beneficiary quotes, subject consent, location, and associated campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StoryForm mediaOptions={media?.items ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
