import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'sailent:permissions';
export const AUDIENCE_KEY = 'sailent:audience';
export const SENSITIVE_KEY = 'sailent:sensitive';

/**
 * Authorization decorators (decision A9, docs/rbac.md).
 *
 * Guards check PERMISSIONS, never role names. Hard-coding roles into guards
 * produces a codebase where adding a seventh role means auditing every guard.
 *
 * Phase 1 defines the contract; the guards that enforce it land in Phase 3
 * alongside the RBAC tables.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Restrict a route to one token audience. Checked BEFORE any permission lookup. */
export const RequireAudience = (audience: 'donor' | 'staff') => SetMetadata(AUDIENCE_KEY, audience);

export const AUTHENTICATED_ONLY_KEY = 'sailent:authenticated-only';

/**
 * "Authentication is the whole requirement", stated deliberately.
 *
 * Deny-by-default means a staff route carrying no permission is unreachable —
 * which is the right failure for a route whose protection was FORGOTTEN. But a
 * few routes genuinely need nothing beyond a valid session: `/auth/me` must
 * answer for a staff member who holds no permissions at all, or the admin UI
 * cannot even tell them they have none.
 *
 * This decorator is that exception, made explicit and greppable, so it shows up
 * in review the way `@Public()` does instead of being a hole in the guard.
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);

/**
 * Marks an operation as sensitive: requires re-authentication within the last
 * 5 minutes and always writes an audit row. Donor exports, role changes,
 * visibility changes, deletions.
 */
export const Sensitive = () => SetMetadata(SENSITIVE_KEY, true);
