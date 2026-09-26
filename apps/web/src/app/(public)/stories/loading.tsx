import { PageShell, Section } from '@/components/layout/page-shell';
import { CardGridSkeleton } from '@/components/sections/skeletons';
import { PageHeaderSkeleton } from '@/components/sections/skeletons';

export default function Loading() {
  return (
    <Section>
      <PageShell>
        <PageHeaderSkeleton />
        <div className="mt-10">
          <CardGridSkeleton />
        </div>
      </PageShell>
    </Section>
  );
}
