import { currentDonor } from '@/lib/auth/donor-session';
import { donorFetch, type Paginated, type SavedCampaign } from '@/lib/donor/api';

/**
 * Who is looking at a page of campaign cards: signed in or not, and which
 * campaigns they have saved — what each card's save heart needs to draw
 * itself correctly.
 *
 * `savedIds` is an ARRAY, not a Set, because it crosses into client
 * components, and a Set does not survive that serialisation.
 */
export interface DonorViewer {
  signedIn: boolean;
  savedIds: string[];
}

/**
 * Read once for a whole grid of cards rather than per card. A failure here
 * must not take the page down — not knowing what someone saved is no reason
 * to hide the campaigns — so it degrades to "nothing saved yet".
 */
export async function readDonorViewer(): Promise<DonorViewer> {
  const donor = await currentDonor();
  if (!donor) return { signedIn: false, savedIds: [] };

  try {
    const saved = await donorFetch<Paginated<SavedCampaign>>('me/saved-campaigns', {
      query: { limit: 100 },
    });
    return { signedIn: true, savedIds: saved.items.map((item) => item.campaignId) };
  } catch {
    return { signedIn: true, savedIds: [] };
  }
}
