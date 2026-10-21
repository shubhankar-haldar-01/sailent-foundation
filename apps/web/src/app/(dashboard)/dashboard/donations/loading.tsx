export default function DonationsLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading donations">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="bg-muted h-4 w-28 rounded" />
        <div className="bg-muted h-9 w-64 rounded-lg" />
        <div className="bg-muted/70 h-4 w-96 max-w-full rounded" />
      </div>

      {/* 3 Summary Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-elevated gap-4.5 flex items-center rounded-2xl p-5">
            <div className="size-13 bg-muted shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-3.5 w-20 rounded" />
              <div className="bg-muted h-7 w-28 rounded" />
              <div className="bg-muted/60 h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search skeleton */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex gap-3">
          <div className="bg-muted h-10 w-64 rounded-full" />
          <div className="bg-muted h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="card-standard overflow-hidden rounded-2xl p-4">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="border-border/40 flex items-center justify-between gap-4 border-b py-2 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="bg-muted size-11 shrink-0 rounded-xl" />
                <div className="space-y-1.5">
                  <div className="bg-muted h-4 w-44 rounded" />
                  <div className="bg-muted/70 h-3 w-24 rounded" />
                </div>
              </div>
              <div className="bg-muted hidden h-4 w-24 rounded sm:block" />
              <div className="bg-muted hidden h-4 w-32 rounded md:block" />
              <div className="bg-muted h-5 w-20 rounded-full" />
              <div className="bg-muted h-5 w-16 rounded" />
              <div className="bg-muted h-8 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
