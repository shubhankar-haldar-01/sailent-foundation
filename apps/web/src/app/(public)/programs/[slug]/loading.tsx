import { PageShell, Section } from '@/components/layout/page-shell';
import { ArticleSkeleton } from '@/components/sections/skeletons';

export default function Loading() {
  return (
    <Section>
      <PageShell>
        <ArticleSkeleton />
      </PageShell>
    </Section>
  );
}
