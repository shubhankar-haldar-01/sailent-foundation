import 'server-only';

import { STAFF_SESSION } from './session-refresh';
import { createSessionStore, type StoredSession } from './token-store';

/**
 * The STAFF session.
 *
 * The cookie mechanics live in `token-store.ts`, shared with the donor session
 * so that a fix to the refresh path cannot land on one audience and miss the
 * other. What is specific to staff is here: the cookie name, the seven-day
 * lifetime that matches the staff refresh token, and the permission helper.
 *
 * A DONOR SESSION IS A DIFFERENT COOKIE ENTIRELY — see `donor-session.ts`. The
 * two tokens are signed with different keys and `actor.id` means a different
 * thing in each, so there is deliberately no way to read one through the other.
 */

export interface StaffActor {
  id: string;
  permissions: string[];
}

export type StaffSession = StoredSession<StaffActor>;

const store = createSessionStore<StaffActor>(STAFF_SESSION);

export const readSession = store.read;
export const writeSession = store.write;
export const clearSession = store.clear;
export const getAccessToken = store.accessToken;

/** The signed-in staff member, or null. Used by the admin layout and nav. */
export const currentActor = store.actor;

/**
 * Permission check for rendering.
 *
 * COSMETIC ONLY. It decides whether to draw a button; the API decides whether
 * the action happens, and re-checks on every request. Nothing here is a
 * security control.
 */
export function can(actor: StaffActor | null, permission: string): boolean {
  return actor?.permissions.includes(permission) ?? false;
}
