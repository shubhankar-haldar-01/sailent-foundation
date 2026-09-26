import { Skeleton } from '@sailent/ui';

/**
 * Loading skeletons.
 *
 * Dimensions match the real layouts so nothing shifts when content arrives — a
 * skeleton that changes size on load is worse than no skeleton.
 */
export function CardGridSkeleton({
  count = 6,
  withMedia = true,
}: {
  count?: number;
  withMedia?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border-border overflow-hidden rounded-lg border">
          {withMedia ? <Skeleton className="aspect-video w-full rounded-none" /> : null}
          <div className="space-y-3 p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-11 w-3/4 max-w-xl" />
      <Skeleton className="h-5 w-full max-w-2xl" />
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div className="prose-measure space-y-4" aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="mt-8 aspect-video w-full" />
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}
