import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { DonationStatus } from '@/components/donations/donation-status';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your donation',
  description: 'The status of your donation to Sailent Foundation.',
  path: '/donation',
  // A reference in a URL is a capability. It must not reach an index, a
  // sitemap, or a referrer header pointing at someone else's receipt.
  noIndex: true,
});

/**
 * ONE PAGE FOR EVERY OUTCOME — success, failure, and the wait in between.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Separate `/donation/success` and `/donation/failed` routes are the obvious
 * design and the wrong one, because at the moment of redirect NOBODY KNOWS
 * which it is.
 *
 * The browser's success callback is not proof. The webhook may not have arrived
 * yet. A donor whose connection dropped between paying and returning has a
 * completed payment and no client-side evidence of it. Routing to a page named
 * "failed" on that evidence tells somebody their money vanished when it did
 * not, and the predictable next thing they do is pay again.
 *
 * So this page asks the SERVER what happened, and keeps asking for a short
 * while, because the server is the only party that knows. What it shows is
 * whatever the answer turns out to be.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function DonationStatusPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  return (
    <Section>
      <PageShell className="max-w-2xl">
        <DonationStatus reference={reference} />
      </PageShell>
    </Section>
  );
}
