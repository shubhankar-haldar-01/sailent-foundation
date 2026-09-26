import Link from 'next/link';

import { currentDonor } from '@/lib/auth/donor-session';

/**
 * The signed-in donor's initials, linking to their dashboard.
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
 * RENDERS NOTHING FOR A VISITOR WHO IS NOT SIGNED IN. No "Sign in" link beside
 * the Donate button: the header carries exactly one call to action by design,
 * and a second one competing with it costs more than an account link is worth.
 * Signed-out people reach their account from the footer.
 *
 * THE NAME COMES FROM THE SESSION, NOT FROM AN API CALL.
 *
 * This component is in the header, so it renders on EVERY page. It used to
 * fetch `/me` for the initials, which meant a signed-in donor reading five
 * campaign pages spent five authenticated round trips on two letters in a
 * 40px circle. The name is now stored with the tokens at sign-in, where it
 * costs nothing to read.
 *
 * It also stopped the e2e suite being pushed past the API's 100-per-minute
 * limit, which is how the cost got noticed — but the cost was real in
 * production too, and would only have been noticed there as latency.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function AccountBadge() {
  const donor = await currentDonor();
  if (!donor) return null;

  const name = (donor.name ?? '').trim();
  const initials =
    name
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
      aria-label={name ? `Your account — ${name}` : 'Your account'}
      className="bg-success focus-visible:outline-ring grid size-10 shrink-0 place-items-center rounded-full text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span aria-hidden="true" className="text-caption font-semibold">
        {initials}
      </span>
    </Link>
  );
}
