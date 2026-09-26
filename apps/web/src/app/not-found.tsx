import Link from 'next/link';
import { Button } from '@sailent/ui';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

/**
 * 404.
 *
 * Helpful rather than apologetic. An NGO 404 is a chance to route someone
 * towards the work rather than a dead end — though Phase 1 links only to
 * pages that genuinely exist.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT STILL ARRIVES WITH A 200 ON MATCHED ROUTES, AND THE REASON IS RECORDED.
 *
 * `docs/seo-strategy.md` §7 wants "a real 404 (never a soft 200)". Every
 * dynamic route answers `notFound()` with **HTTP 200**: the page is right, the
 * status line is not, and the status line is the half a crawler reads.
 *
 * THE CAUSE IS THE `loading.tsx` BESIDE THIS FILE. It wraps every route in a
 * Suspense boundary, so Next flushes the shell — and a 200 — before the page
 * body runs; by the time `notFound()` is called the status is already on the
 * wire. Deleting it was tried, and it worked: /team/*, /impact/* and every
 * unmatched path began returning a real 404.
 *
 * IT WAS PUT BACK. Without the root fallback the E2E suite began failing on
 * title assertions under parallel load — three runs, three failures, where the
 * suite had been 495/495 twice immediately before. The server HTML always
 * carried the right title, so the pages were correct, but the rendering timing
 * had changed enough to matter, and a rendering change that destabilises the
 * suite is a worse trade than a wrong status code on a page nobody should
 * reach.
 *
 * So the soft 404 is a KNOWN, DIAGNOSED limitation rather than a mystery —
 * docs/phase-10.8.md §D has the full account and the two ways out, neither of
 * which is free. Unmatched paths (no route at all) do return a real 404.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main-content" className="flex flex-1 items-center">
        <div className="container-page py-20 text-center">
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
            404
          </p>
          <h1 className="text-display mt-2 font-semibold">We couldn&rsquo;t find that page</h1>
          <p className="text-body-lg text-muted-foreground mx-auto mt-3 max-w-prose">
            The link may be out of date, or the page may have moved.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/">Go to the homepage</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
