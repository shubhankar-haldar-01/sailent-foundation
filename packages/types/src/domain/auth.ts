/**
 * Authentication contracts (decision A8).
 *
 * Donor and staff are separate, non-interchangeable audiences. A donor token
 * presented to a staff endpoint fails on audience alone, before any permission
 * lookup. Phase 1 defines the shape only — issuing and verification land in Phase 3.
 */

export type TokenAudience = 'donor' | 'staff';

export interface AccessTokenClaims {
  /** Subject: donor id or user id depending on `aud`. */
  sub: string;
  aud: TokenAudience;
  /*
    NO PERMISSION LIST LIVES HERE.

    It used to. Collapsing the five staff roles into one SUPER_ADMIN meant a
    single token carried all 94 permission strings — a 2.5KB JWT inside a
    4.6KB session cookie, past the 4096-byte limit a browser will store, and
    sent on every request for the life of the session.

    The size was the symptom. The defect was that a permission baked in at
    login could not be taken away until the token expired, which is the same
    argument this file already makes for `reauthenticatedAt`. Permissions are
    now resolved from the database per request, so revoking one means now.
  */
  /** Unix seconds. */
  iat: number;
  exp: number;
  /** Session family, for refresh-token reuse detection. */
  sid: string;
}

export interface AuthenticatedActor {
  id: string;
  audience: TokenAudience;
  permissions: string[];
  sessionId: string;
  /**
   * When this session last re-authenticated (decision A9).
   *
   * Read from the session row on every request rather than from the token, so
   * that it cannot be forged and so that it reflects the present rather than
   * whatever was true when the token was minted. Sensitive operations require
   * this to be recent.
   */
  reauthenticatedAt?: Date | null;
  /**
   * A display name, present only on the response that ISSUES a session.
   *
   * Not on the actor the guard resolves per request — nothing server-side
   * needs it, and putting it there would mean reading the donor row on every
   * authenticated call to serve two initials. It exists so the client can
   * store the name alongside the tokens and stop asking `/me` for it on every
   * page view.
   */
  name?: string | null;
}

/** Health of the current request's auth state, for UI branching. */
export type AuthState =
  { status: 'anonymous' } | { status: 'authenticated'; actor: AuthenticatedActor };
