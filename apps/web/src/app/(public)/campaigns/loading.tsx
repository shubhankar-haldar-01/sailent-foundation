import { Skeleton } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';

export default function LoadingCampaigns() {
  return (
    <Section>
      <PageShell>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
        <Skeleton className="mt-8 h-16 w-full" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="border-border overflow-hidden rounded-lg border">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    </Section>
  );
}
