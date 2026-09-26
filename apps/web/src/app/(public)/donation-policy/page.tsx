import type { Metadata } from 'next';

import { LegalPage } from '@/components/sections/legal-page';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Donation policy',
  description: 'What we accept, what we decline, and how donated funds are allocated.',
  path: '/donation-policy',
});

export default function DonationPolicyPage() {
  return (
    <LegalPage
      title="Donation policy"
      path="/donation-policy"
      updated="19 September 2026"
      lead="What we accept, what we decline, and how your money is allocated once we have it."
      sections={[
        {
          heading: 'What we accept',
          paragraphs: [
            // Phase 6 removed recurring giving. This page told donors monthly
            // donations were supported, which the platform cannot honour.
            'We accept donations in Indian rupees from Indian payment instruments — UPI, debit and credit cards, netbanking and wallets. All donations are one-time; we do not take monthly or recurring payments.',
          ],
        },
        {
          heading: 'What we cannot accept',
          paragraphs: [
            'We are not registered under the Foreign Contribution (Regulation) Act, so we cannot accept foreign contributions in any amount. International payment instruments are disabled at checkout rather than failing silently.',
            'We decline donations where the source of funds is unclear, where acceptance would create a conflict of interest, or where a condition is attached that we cannot honour.',
          ],
        },
        {
          heading: 'How funds are allocated',
          paragraphs: [
            'Where you fund a specific product, the money is applied to that component of that campaign. Where you give an amount to a campaign, the program team allocates it within that campaign.',
            'If a campaign exceeds its goal, the campaign page states in advance what happens to additional funds — usually extending the same work to the next location on our list. Campaigns configured to stop at their goal say so.',
            'A proportion of donations covers administration: finance, compliance, audit and the staff who run programs. The actual figure is published each year in the fund utilisation report rather than claimed as a round number.',
          ],
        },
        {
          heading: 'Restricted gifts',
          paragraphs: [
            'We accept gifts restricted to a program or a district. We do not accept gifts restricted to an individual beneficiary, because selecting recipients by donor preference is not compatible with how programs identify need.',
          ],
        },
        {
          heading: 'Anonymity',
          paragraphs: [
            'You may mark a donation anonymous, which removes your name from public listings. Our finance team can always identify a donor, because statutory record-keeping requires it.',
          ],
        },
        {
          heading: 'Receipts and 80G',
          paragraphs: [
            'A payment receipt is emailed as soon as the payment is confirmed. This is not the 80G certificate: that is Form 10BE, issued after we file the annual statement of donations, by 31 May following the end of the financial year. To be included, we need your PAN or another accepted identification number.',
          ],
        },
      ]}
    />
  );
}
