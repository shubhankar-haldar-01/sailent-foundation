import type { Metadata } from 'next';

import { PageShell } from '@/components/layout/page-shell';
import { DonationStatus, type ReceiptOrganisation } from '@/components/donations/donation-status';
import { getOrganisationRecords } from '@/lib/content/organisation';
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
  /*
    Only what the organisation has entered: this page speaks as a record, so
    a demo PAN or 80G number in development would be a false statement.
  */
  const organisation = await getOrganisationRecords();
  const receiptOrganisation: ReceiptOrganisation = {
    name: organisation.name,
    email: organisation.email,
    phoneDisplay: organisation.phoneDisplay,
    phoneHref: organisation.phoneHref,
    pan: organisation.registration.pan,
    section80G: organisation.registration.section80G,
    section12A: organisation.registration.section12A,
    registrationNumber: organisation.registration.registrationNumber,
  };

  /*
    Not the standard `Section` rhythm (96px above and below from `md`): the
    paid state is sized to fit a laptop screen under the header without
    scrolling (owner, 2026-11-19), and that padding alone would push it off.
  */
  return (
    <section className="py-6 lg:pb-7 lg:pt-5">
      <PageShell>
        <DonationStatus reference={reference} organisation={receiptOrganisation} />
      </PageShell>
    </section>
  );
}
