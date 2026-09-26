import Link from 'next/link';
import { Button, EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';

export default function EventNotFound() {
  return (
    <Section>
      <PageShell>
        <EmptyState
          kind="no-content"
          title="We couldn’t find that event"
          description="It may have finished, or the link may be out of date."
          action={
            <Button asChild>
              <Link href="/events">See upcoming events</Link>
            </Button>
          }
        />
      </PageShell>
    </Section>
  );
}
