import Link from 'next/link';
import { Button, EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';

export default function StoryNotFound() {
  return (
    <Section>
      <PageShell>
        <EmptyState
          kind="no-content"
          title="We couldn’t find that story"
          description="It may have moved. All published stories are listed together."
          action={
            <Button asChild>
              <Link href="/stories">Read our stories</Link>
            </Button>
          }
        />
      </PageShell>
    </Section>
  );
}
