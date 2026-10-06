/**
 * Publication lifecycles for programmes and campaigns.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * The transition table is DATA, and it lives here — shared between the API
 * that enforces it and the admin UI that decides which buttons to render.
 *
 * One table, two readers, is the point. A UI with its own copy of the rules
 * offers a button the server then refuses, and the operator learns the rule by
 * hitting an error. The server remains the enforcement point regardless: the
 * UI uses this to be helpful, not to be trusted.
 * ══════════════════════════════════════════════════════════════════════════
 */

export type ProgramStatus = 'draft' | 'published' | 'archived';

export type CampaignStatus = 'draft' | 'published' | 'active' | 'paused' | 'completed' | 'archived';

/**
 * Programme lifecycle.
 *
 * `published → draft` is permitted — unpublishing is how a programme that went
 * out with a mistake comes back off the site quickly, and forcing an operator
 * to archive it instead would lose the distinction between "taken down to fix"
 * and "no longer running".
 */
export const PROGRAM_TRANSITIONS: Record<ProgramStatus, ProgramStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  // Terminal for a programme, but reversible by an explicit restore, because
  // "archived by mistake" is a thing that happens and a database edit is not
  // an acceptable recovery path.
  archived: ['draft'],
};

/**
 * Campaign lifecycle.
 *
 *   draft     → published            visible, not yet taking donations
 *   published → active               open for giving
 *   active    ⇄ paused               stop and resume giving
 *   active    → completed            the work is done or the goal is met
 *   completed → archived             out of the listings, URL still works
 *
 * `paused → completed` is allowed: a campaign paused for review is often
 * exactly the one that then gets wound up, and routing that through `active`
 * would mean briefly reopening donations to close them.
 *
 * Nothing returns from `archived` except to `draft`, and never straight to a
 * public state — an archived campaign is brought back deliberately, reviewed,
 * and republished.
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'active', 'archived'],
  active: ['paused', 'completed', 'archived'],
  paused: ['active', 'completed', 'archived'],
  completed: ['archived'],
  archived: ['draft'],
};

export function canTransitionProgram(from: ProgramStatus, to: ProgramStatus): boolean {
  return PROGRAM_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Which statuses the public may see.
 *
 * `paused` stays reachable: it was public a moment ago, and pulling the page
 * out from under everyone who has the link — including printed material and
 * anyone mid-donation — is worse than showing it with donations closed.
 * `completed` stays reachable as a historical record, which is most of what an
 * NGO's credibility is made of.
 *
 * `draft` and `archived` are 404 to the public, exactly as if they did not
 * exist. There is no query parameter that changes this.
 */
export const PUBLIC_CAMPAIGN_STATUSES: CampaignStatus[] = [
  'published',
  'active',
  'paused',
  'completed',
];

export function isPubliclyVisible(status: CampaignStatus): boolean {
  return PUBLIC_CAMPAIGN_STATUSES.includes(status);
}

/**
 * Whether a campaign may accept money.
 *
 * ONLY `active`. A published-but-not-yet-active campaign is a preview of
 * something that has not opened; a paused one has been stopped deliberately;
 * a completed one is finished. Taking a donation in any of those states means
 * accepting money the organisation has not agreed to accept yet, has asked to
 * stop accepting, or can no longer spend as described — and since donations
 * are final, each is a conversation nobody can put right afterwards.
 */
export function acceptsDonations(
  status: CampaignStatus,
  endDate?: Date | string | null,
  now: Date = new Date(),
): boolean {
  return status === 'active' && !hasEnded(endDate, now);
}

/** India Standard Time: +05:30 all year, no daylight saving. */
const IST_OFFSET_MS = 330 * 60_000;

/**
 * Whether a campaign's optional deadline has passed.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE END DATE IS THE LAST DAY YOU CAN GIVE.
 *
 * "Ends 13 Oct" means donations are taken all through 13 October, so this
 * closes at 23:59:59.999 India time ON that date — not at the midnight that
 * starts it, which would end the campaign a day before the page says. The day
 * is read in India time whatever the stored instant, so a date picked in the
 * admin form (midnight UTC) and one written with an explicit +05:30 offset
 * both land on the calendar day the administrator meant.
 *
 * No end date means no deadline: the campaign runs until an administrator
 * pauses or completes it. That is the default.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The ONE implementation: the public page, the cards and the checkout all ask
 * this, so none of them can say "open" while another says "closed".
 */
export function hasEnded(
  endDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!endDate) return false;
  const instant = new Date(endDate).getTime();
  if (Number.isNaN(instant)) return false;

  const day = new Date(instant + IST_OFFSET_MS).toISOString().slice(0, 10);
  const lastMoment = new Date(`${day}T23:59:59.999+05:30`).getTime();
  return now.getTime() > lastMoment;
}

/**
 * The instant before which an end date counts as ended: the start of today,
 * India time.
 *
 * `hasEnded(endDate, now)` is exactly `endDate < deadlineCutoff(now)` — an end
 * date earlier than today's IST midnight fell on a day that is over. This is
 * the form a database query can use (`end_date < $cutoff`), so a listing that
 * filters on the deadline agrees with `hasEnded` to the millisecond.
 */
export function deadlineCutoff(now: Date = new Date()): Date {
  const today = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return new Date(`${today}T00:00:00+05:30`);
}

/** What the donate control should say and do, given the campaign's state. */
export type DonationAvailability =
  | { state: 'open' }
  | { state: 'not-open'; reason: string }
  | { state: 'paused'; reason: string }
  | { state: 'completed'; reason: string }
  /** Active, but past its end date — closed by the deadline, not by a person. */
  | { state: 'ended'; reason: string }
  | { state: 'unavailable'; reason: string };

export function donationAvailability(
  status: CampaignStatus,
  endDate?: Date | string | null,
  now: Date = new Date(),
): DonationAvailability {
  if (status === 'active' && hasEnded(endDate, now)) {
    return {
      state: 'ended',
      reason: 'This campaign closed on its end date. Thank you to everyone who gave.',
    };
  }

  switch (status) {
    case 'active':
      return { state: 'open' };
    case 'published':
      return {
        state: 'not-open',
        reason: 'This campaign is not open for donations yet.',
      };
    case 'paused':
      return {
        state: 'paused',
        reason: 'Donations to this campaign are paused. It will reopen once work resumes.',
      };
    case 'completed':
      return {
        state: 'completed',
        reason: 'This campaign is complete. Thank you to everyone who gave.',
      };
    default:
      return { state: 'unavailable', reason: 'This campaign is not accepting donations.' };
  }
}
