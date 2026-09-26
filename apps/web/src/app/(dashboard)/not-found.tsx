import Link from 'next/link';

import { Button } from '@sailent/ui';

/**
 * Not found, inside the dashboard.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS WHAT A DONOR SEES WHEN THEY ASK FOR SOMEBODY ELSE'S DONATION.
 *
 * The API scopes every donor query by the session's donor id, so a donation
 * belonging to another donor does not come back forbidden — it does not come
 * back at all, and the page calls `notFound()`. That is deliberate: 403 would
 * confirm the id exists, which is precisely what an id-guessing attacker is
 * after. 404 says nothing.
 *
 * So this page has to work for two quite different visitors — somebody who
 * followed a stale link to their own deleted thing, and somebody probing ids —
 * and it must read identically to both. No "this belongs to another account",
 * no "you do not have access": those sentences are the disclosure the 404 was
 * chosen to avoid.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default function DashboardNotFound() {
  return (
    <div className="py-12 text-center">
      <p data-numeric="" className="text-muted-foreground text-caption font-semibold">
        404
      </p>
      <h1 className="text-h2 mt-2 font-bold">We couldn’t find that</h1>
      <p className="text-body text-muted-foreground mx-auto mt-3 max-w-prose">
        It may have moved, or the link may be out of date.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild size="md">
          <Link href="/dashboard">Back to your account</Link>
        </Button>
        <Button asChild size="md" variant="secondary">
          <Link href="/dashboard/donations">Your donations</Link>
        </Button>
      </div>
    </div>
  );
}
