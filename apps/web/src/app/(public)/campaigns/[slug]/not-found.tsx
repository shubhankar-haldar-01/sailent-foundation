import Link from 'next/link';
import { Button, EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';

export default function CampaignNotFound() {
  return (
    <Section>
      <PageShell>
        <EmptyState
          kind="no-content"
          title="We couldn’t find that campaign"
          description="It may have been archived, or the link may be out of date. All current campaigns are listed together."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/campaigns">Browse campaigns</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/programs">View programs</Link>
              </Button>
            </div>
          }
        />
      </PageShell>
    </Section>
  );
}
