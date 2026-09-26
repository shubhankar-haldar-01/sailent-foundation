import Link from 'next/link';
import { Heart } from 'lucide-react';

import { SaveCampaignButton } from './save-campaign-button';
import { currentDonor } from '@/lib/auth/donor-session';
import { donorFetch, type Paginated, type SavedCampaign } from '@/lib/donor/api';

/**
 * "Save for later" on a public campaign page.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SERVER COMPONENT, SO A SIGNED-OUT VISITOR NEVER SEES A CONTROL THAT WOULD
 * FAIL.
 *
 * Saving needs an account, and an account is created by a donation — so most
 * people reading a campaign page cannot save it. Rendering the button for
 * everybody and failing on click would be the worse design twice over: it
 * wastes the tap, and it tells anyone who tries that saving is for people who
 * have donated, which is a fact about the visitor we would rather state up
 * front than reveal through an error.
 *
 * So a signed-out visitor gets a quiet line pointing at sign-in, and a
 * signed-in donor gets a button whose state is already correct.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE SAVED STATE IS READ ON THE SERVER, not assumed. A button that always says
 * "Save" and silently does nothing the second time is a worse lie than one
 * round trip.
 */
export async function SaveCampaignPanel({
  campaignId,
  title,
  slug,
}: {
  campaignId: string;
  title: string;
  /** Used to send a signed-out visitor back here after signing in. */
  slug?: string;
}) {
  const donor = await currentDonor();

  if (!donor) {
    /*
      READS "Save Campaign" EVEN SIGNED OUT, and goes to sign-in.

      It used to say "Sign in to save this for later", which is honest but puts
      the obstacle before the offer — somebody scanning the rail sees a sentence
      about accounts rather than the thing they might want to do. The label now
      names the action, as the approved design does, and the destination is
      still the sign-in page, so nothing is promised that does not happen.

      `next` carries the campaign back, so signing in returns here rather than
      dropping somebody on their dashboard having forgotten what they wanted.
    */
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(`/campaigns/${slug ?? ''}`)}`}
        className="text-caption text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 font-medium transition-colors focus-visible:outline-2"
      >
        <Heart className="size-4" aria-hidden="true" />
        Save Campaign
      </Link>
    );
  }

  // A failure here must not take down the campaign page — being unable to say
  // whether it is already saved is not a reason to hide the campaign.
  let saved = false;
  try {
    const result = await donorFetch<Paginated<SavedCampaign>>('me/saved-campaigns', {
      query: { limit: 100 },
    });
    saved = result.items.some((item) => item.campaignId === campaignId);
  } catch {
    saved = false;
  }

  return (
    <div className="mt-3 flex justify-center">
      <SaveCampaignButton campaignId={campaignId} title={title} saved={saved} />
    </div>
  );
}
