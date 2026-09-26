import Link from 'next/link';
import { Button, EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';

export default function PostNotFound() {
  return (
    <Section>
      <PageShell>
        <EmptyState
          kind="no-content"
          title="We couldn’t find that article"
          description="It may have moved. All published articles are listed together."
          action={
            <Button asChild>
              <Link href="/blog">Read the blog</Link>
            </Button>
          }
        />
      </PageShell>
    </Section>
  );
}
