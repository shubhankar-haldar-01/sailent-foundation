import { SkeletonText } from '@sailent/ui';

import { PageHeaderSkeleton } from '@/components/sections/skeletons';

/**
 * Any page without a loading screen of its own (docs/ui-feedback.md).
 *
 * The shape of a page, a heading and its paragraphs, not a spinner: a first
 * load gets a skeleton. It appears only after 300ms, so a quick page shows
 * nothing at all.
 */
export default function Loading() {
  return (
    <div className="container-page py-12 md:py-16" aria-busy="true">
      <p role="status" className="sr-only">
        Loading page…
      </p>
      <PageHeaderSkeleton />
      <SkeletonText lines={5} className="mt-10 max-w-3xl" />
    </div>
  );
}
