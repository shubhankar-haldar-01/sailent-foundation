import Link from 'next/link';
import { Button, EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';

export default function ProgramNotFound() {
  return (
    <Section>
      <PageShell>
        <EmptyState
          kind="no-content"
          title="We couldn’t find that program"
          description="The link may be out of date. All seven programs are listed together."
          action={
            <Button asChild>
              <Link href="/programs">View all programs</Link>
            </Button>
          }
        />
      </PageShell>
    </Section>
  );
}
