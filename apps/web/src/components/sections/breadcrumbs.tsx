import { Fragment } from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@sailent/ui';

import { breadcrumbSchema, jsonLd, type BreadcrumbEntry } from '@/lib/seo/structured-data';

/**
 * Breadcrumbs, rendered visibly and as BreadcrumbList structured data from the
 * SAME array — markup that disagrees with the visible page is a search
 * guidelines violation, so they cannot drift apart.
 *
 * NOTE ON STRUCTURE: the separator is a SIBLING of the item, never a child.
 * `BreadcrumbSeparator` renders an `<li>`, and an `<li>` inside an `<li>` is
 * invalid HTML — the browser silently repairs it, which makes the client tree
 * differ from the server tree and produces a hydration failure on every page
 * carrying breadcrumbs. It cost a while to find because the symptom (a minified
 * React #418) looks nothing like the cause.
 */
export function Breadcrumbs({ entries }: { entries: BreadcrumbEntry[] }) {
  return (
    <>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          {entries.map((entry, index) => {
            const isLast = index === entries.length - 1;
            return (
              <Fragment key={entry.path}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{entry.name}</BreadcrumbPage>
                  ) : (
                    <Link
                      href={entry.path}
                      className="hover:text-foreground focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {entry.name}
                    </Link>
                  )}
                </BreadcrumbItem>
                {!isLast ? <BreadcrumbSeparator /> : null}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbSchema(entries))}
      />
    </>
  );
}
