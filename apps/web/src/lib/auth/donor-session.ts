import 'server-only';

import { DONOR_SESSION } from './session-refresh';
import { createSessionStore, type StoredSession } from './token-store';

/**
 * The DONOR session.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SEPARATE COOKIE FROM THE STAFF SESSION, AND THAT IS NOT TIDINESS.
 *
 * The two audiences sign their tokens with different keys, so neither token
 * verifies as the other — but the more important difference is what `actor.id`
 * MEANS. On a donor token it is a `donors.id`; on a staff token it is a
 * `users.id`. Every donor endpoint scopes its queries by that id. Sharing one
 * cookie would make "which id is this?" a runtime question, and the only thing
 * standing between a wrong answer and someone else's giving history would be
 * that the two id spaces do not happen to collide.
 *
 * Someone can hold both at once — a staff member who also donates is a normal
 * person, not an edge case — and the two sessions are independent. Signing out
 * of one does not sign out of the other, which is the correct behaviour: they
 * are different accounts.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THIRTY DAYS, matching the donor refresh-token lifetime. Longer than staff on
 * purpose: a donor visits a few times a year and being signed out between
 * visits is the difference between checking a receipt and giving up.
 */

export interface DonorActor {
  id: string;
  permissions: string[];
  /**
   * A display name, stored at sign-in.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * IT IS HERE TO KEEP THE HEADER FROM CALLING THE API ON EVERY PAGE.
   *
   * `AccountBadge` shows a signed-in donor's initials. It used to fetch `/me`
   * for them, which meant one authenticated round trip per page view — on
   * every public page, for two letters. The name comes back with the session
   * that issues the tokens, so storing it here removes the call entirely.
   *
   * OPTIONAL, and the badge falls back to a generic label without it. A
   * session written before this field existed has none, and must keep working
   * rather than logging somebody out over a decoration.
   *
   * It can go stale by exactly one edit — a donor who renames themselves — so
   * `updateDonorProfile` rewrites it. Everything that MATTERS about identity
   * is the token and the id beside it; this is a label.
   * ══════════════════════════════════════════════════════════════════════════
   */
  name?: string | null;
}

export type DonorSession = StoredSession<DonorActor>;

const store = createSessionStore<DonorActor>(DONOR_SESSION);

export const readDonorSession = store.read;
export const writeDonorSession = store.write;
export const clearDonorSession = store.clear;
export const getDonorAccessToken = store.accessToken;

/** The signed-in donor, or null. */
export const currentDonor = store.actor;
