import type { Metadata } from 'next';

import { LegalPage } from '@/components/sections/legal-page';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of use',
  description: 'The terms that apply when you use this website.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      path="/terms"
      updated="19 September 2026"
      lead="The terms that apply when you use this website or make a donation through it."
      sections={[
        {
          heading: 'Using this site',
          paragraphs: [
            'You may use this website to learn about our work, donate, apply to volunteer and register for events. You may not attempt to disrupt the service, access accounts or data that are not yours, or use automated systems to extract content at scale.',
          ],
        },
        {
          heading: 'Accuracy of content',
          paragraphs: [
            'We take care that program descriptions, campaign figures and impact reporting are accurate at the time of publication. Campaign progress figures reflect payments confirmed by our payment provider and update continuously.',
            'Where a result is preliminary or a figure is an estimate, we say so on the page rather than presenting it as settled.',
          ],
        },
        {
          heading: 'Donations',
          paragraphs: [
            'A donation is a voluntary gift. It is complete once our server has independently confirmed the payment — not when your browser reports success. Until that confirmation, a donation is shown as pending.',
            'Where you fund a specific item, we apply the money to that program component. If a campaign raises more than its goal, the campaign page states in advance what happens to the additional funds.',
          ],
        },
        {
          heading: 'Volunteering and events',
          paragraphs: [
            'Applying to volunteer does not guarantee acceptance. Registering for an event does not guarantee a place if capacity is reached; waitlisted registrants are promoted in order.',
          ],
        },
        {
          heading: 'Intellectual property',
          paragraphs: [
            'Content on this site belongs to Sailent Foundation unless stated otherwise. You may share and quote it with attribution. Photographs of identifiable people may not be reused without permission, because consent was given for our use rather than for general distribution.',
          ],
        },
        {
          heading: 'Changes to these terms',
          paragraphs: [
            'We may update these terms. Material changes will be noted on this page with a revised date.',
          ],
        },
      ]}
    />
  );
}
