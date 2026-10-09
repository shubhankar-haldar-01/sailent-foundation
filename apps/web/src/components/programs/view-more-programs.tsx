import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { SprigFlourish } from './decor';

/**
 * "View More Programs" — the soft orange pill under the grid, with a small
 * hand-drawn sprig beside it, as the owner's design draws it.
 *
 * A link to the next page of the same listing, never a script: the server
 * renders the longer list, so it works without JavaScript and can be opened
 * in a new tab. It does not scroll — the new cards land below the ones
 * already read. The page leaves it out once every programme is showing.
 */
export function ViewMorePrograms({ href }: { href: string }) {
  return (
    <div className="mt-10 flex justify-center md:mt-12">
      <div className="relative">
        <Link
          href={href}
          scroll={false}
          className="bg-(--cta-50) text-primary hover:bg-(--cta-100) dark:bg-primary/10 dark:hover:bg-primary/15 focus-visible:outline-ring group inline-flex h-12 items-center justify-center gap-2 rounded-full px-9 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-[3.25rem] sm:min-w-[25rem] sm:text-[1.0625rem]"
        >
          View More Programs
          <ArrowRight
            className="duration-(--duration-base) size-[1.125rem] transition-transform motion-safe:group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
        <SprigFlourish className="text-cta-glow/80 absolute -right-11 -top-4 h-9 w-11 max-sm:hidden" />
      </div>
    </div>
  );
}
