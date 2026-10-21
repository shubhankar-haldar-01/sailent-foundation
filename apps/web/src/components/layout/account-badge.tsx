import Link from 'next/link';

import { currentDonor } from '@/lib/auth/donor-session';
import { donorFetch, type DonorProfile } from '@/lib/donor/api';

/**
 * The signed-in donor's avatar or initials, linking to their dashboard.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SERVER COMPONENT, PASSED INTO THE HEADER AS A SLOT.
 *
 * `SiteHeader` is a client component — it owns the mobile drawer and the
 * dropdown menus — so it cannot read a session. Rather than lifting the whole
 * header to the server or shipping a session fetch to the browser, the finished
 * element is handed down. The header stays interactive and the session stays
 * where sessions belong.
 *
 * RENDERS NOTHING FOR A VISITOR WHO IS NOT SIGNED IN. The header shows its
 * "Login / Sign Up" button in that case (owner request, 2026-10-08); the
 * layouts tell it which with `signedIn`.
 *
 * AVATAR RESOLUTION:
 * When `avatarUrl` is explicitly passed (e.g. from the dashboard layout where
 * `/me` is already loaded), no additional request is made.
 * On public layouts or standalone views where `avatarUrl` is not provided,
 * it checks the session avatar, falling back to `/me` if needed so uploaded
 * profile photos appear across all public pages as well.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function AccountBadge({ avatarUrl }: { avatarUrl?: string | null } = {}) {
  const donor = await currentDonor();
  if (!donor) return null;

  let resolvedAvatar = avatarUrl !== undefined ? avatarUrl : (donor.avatarUrl ?? null);
  let resolvedName = (donor.name ?? '').trim();

  if (avatarUrl === undefined && !resolvedAvatar) {
    try {
      const profile = await donorFetch<DonorProfile>('me');
      resolvedAvatar = profile?.avatarUrl ?? null;
      if (!resolvedName && profile) {
        resolvedName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      }
    } catch {
      resolvedAvatar = null;
    }
  }

  const initials =
    resolvedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'ME';

  return (
    <Link
      href="/dashboard"
      // The accessible name is the person, not the letters — "SK" read aloud is
      // two letters, and the initials are decorative once the name is there.
      aria-label={resolvedName ? `Your account — ${resolvedName}` : 'Your account'}
      className="bg-success focus-visible:outline-ring text-success-foreground relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {resolvedAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedAvatar} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="text-caption font-semibold">
          {initials}
        </span>
      )}
    </Link>
  );
}
