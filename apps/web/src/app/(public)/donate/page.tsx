import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { HowDonationsWork } from '@/components/sections/how-donations-work';
import { DonateFlow } from '@/components/donations/donate-flow';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCampaigns } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Donate',
  description:
    'Fund a specific item — a school kit, a clinic day, a month of nutrition support — or give any amount to a campaign.',
  path: '/donate',
});

export default async function DonatePage() {
  const active = await getCampaigns({ status: 'active' });

  return (
    <>
      <PageHero
        eyebrow="Donate"
        title="Choose the thing, not just the amount"
        lead="Most donation pages ask for a number. We would rather tell you exactly what it pays for — because ₹900 means nothing and a school kit for one child for a year means something."
      />

      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Donate', path: '/donate' },
            ]}
          />

          <DonateFlow campaigns={active} />
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-t">
        <PageShell>
          <h2 className="text-h1 font-bold">How your donation works</h2>
          <HowDonationsWork className="mt-10" />
        </PageShell>
      </Section>
    </>
  );
}
