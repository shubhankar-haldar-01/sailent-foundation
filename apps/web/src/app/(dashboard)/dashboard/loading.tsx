import { Skeleton } from '@sailent/ui';

import { Panel } from '@/components/dashboard/panel';

/**
 * The dashboard's shape while its data loads — the hero, three figures,
 * payment rows, campaign rows and the profile card — so nothing jumps when
 * the real content lands.
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your dashboard"
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18.5rem]"
    >
      <div className="min-w-0 space-y-6">
        <Skeleton className="h-52 rounded-2xl sm:h-60" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl sm:col-span-2 xl:col-span-1" />
        </div>
        <Panel className="space-y-3 p-5 sm:p-6">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-10" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </Panel>
        <Panel className="space-y-3 p-5 sm:p-6">
          <Skeleton className="h-6 w-60" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel className="space-y-4 p-5 sm:p-6">
          <Skeleton className="h-6 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
        </Panel>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    </div>
  );
}
