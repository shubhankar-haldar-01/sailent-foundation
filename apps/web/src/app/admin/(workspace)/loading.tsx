import { Skeleton, SkeletonTableRow } from '@sailent/ui';

/**
 * Any admin page while its data loads (docs/ui-feedback.md, Phase 4).
 *
 * The workspace shell (sidebar, header) stays put; only the page area shows
 * the usual shape of an admin page: a header with its icon and an action,
 * the filter row, and a table. The skeletons appear only after 300ms, so a
 * quick page shows nothing at all rather than a flash.
 */
export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <p role="status" className="sr-only">
        Loading…
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-11 rounded-2xl sm:size-12" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-64 max-w-[60vw]" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-14 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg sm:w-64" />
      </div>

      <div className="border-border overflow-hidden rounded-xl border">
        <table className="w-full">
          <tbody className="divide-border divide-y">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonTableRow key={index} columns={4} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
