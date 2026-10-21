import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@sailent/ui';

/**
 * "View More Programs" — the blue outlined pill centred under the grid, as
 * the owner's design (2026-10-14) draws it. The shared secondary button, so
 * it matches every other blue outline on the site.
 *
 * A link to the next page of the same listing, never a script: the server
 * renders the longer list, so it works without JavaScript and can be opened
 * in a new tab. It does not scroll — the new cards land below the ones
 * already read. The page leaves it out once every programme is showing.
 */
export function ViewMorePrograms({ href }: { href: string }) {
  return (
    <div className="mt-6 flex justify-center md:mt-7">
      <Button
        asChild
        variant="secondary"
        size="lg"
        className="group h-12 px-10 text-[0.9375rem] shadow-none sm:h-[3.25rem] sm:px-12 sm:text-[0.9375rem]"
      >
        <Link href={href} scroll={false}>
          View More Programs
          <ArrowRight
            className="duration-(--duration-base) transition-transform motion-safe:group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </Button>
    </div>
  );
}
