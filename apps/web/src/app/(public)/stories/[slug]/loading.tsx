import { Skeleton } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';

/**
 * Arriving at a story. The same shape as `page.tsx` — breadcrumb, eyebrow,
 * two-line title, lead, meta, the wide photograph, then the chapters beside
 * the sidebar — so nothing moves when the real page replaces this.
 */
export default function Loading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading story…
      </p>
      <PageShell className="pt-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-8 h-3.5 w-24" />
        <Skeleton className="mt-4 h-11 w-3/4 max-w-[40rem] lg:h-14" />
        <Skeleton className="mt-2 h-11 w-1/2 max-w-[26rem] lg:h-14" />
        <Skeleton className="mt-5 h-6 w-2/3 max-w-[32rem]" />
        <Skeleton className="mt-5 h-4 w-80" />
        <Skeleton className="mt-8 aspect-[4/3] w-full rounded-2xl sm:aspect-[2/1] lg:aspect-[32/11]" />
      </PageShell>
      <PageShell className="pb-14 pt-12 lg:pt-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-x-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:gap-x-20">
          <div className="space-y-10">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-5 sm:gap-x-7">
                <Skeleton className="size-16 rounded-full" />
                <div>
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="mt-4 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-11/12" />
                  <Skeleton className="mt-2 h-4 w-4/5" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-[28rem] rounded-2xl" />
        </div>
      </PageShell>
    </div>
  );
}
