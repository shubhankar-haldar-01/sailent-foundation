import type { Metadata } from 'next';

import { LegalPage } from '@/components/sections/legal-page';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy policy',
  description:
    'What personal data we collect, why, how long we keep it, and how to have it removed.',
  path: '/privacy-policy',
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      path="/privacy-policy"
      updated="19 September 2026"
      lead="What we collect, why we collect it, how long we keep it, and what you can ask us to delete."
      sections={[
        {
          heading: 'What we collect',
          paragraphs: [
            'When you donate we collect your name, email address and mobile number, because we need them to issue a receipt and to contact you about the donation. An address and a tax identification number are optional, and are only needed if you want an 80G certificate.',
            'When you apply to volunteer we collect contact details, skills, availability and an emergency contact. Emergency contacts are used only in the event of an incident during field work.',
            'We do not receive or store your card or bank details at any point. Payments are handled entirely by our payment provider.',
          ],
        },
        {
          heading: 'Why we collect it',
          list: [
            'To process a donation and issue the receipt you are entitled to',
            'To meet statutory record-keeping and tax-reporting obligations',
            'To contact you about a donation, an application or an event you registered for',
            'To send updates, only where you have opted in',
          ],
        },
        {
          heading: 'How long we keep it',
          paragraphs: [
            'Financial records — donations, payments and receipts — are retained for eight years because tax law requires it. This applies even if you ask us to delete your data; we will tell you exactly what must be retained and why.',
            'Volunteer records are kept for the duration of your engagement and three years after. Analytics data is retained for fourteen months.',
          ],
        },
        {
          heading: 'Who can see it',
          paragraphs: [
            'Access is restricted by role. Someone managing content cannot see donor records. Sensitive fields such as tax identification numbers are restricted further and every access to them is logged.',
            'We do not sell personal data, and we do not share it with other organizations for their own marketing.',
          ],
        },
        {
          heading: 'Anonymous donations',
          paragraphs: [
            'Marking a donation anonymous removes your name from any public listing. It does not make the donation anonymous to us — our finance team can always identify a donor, because statutory record-keeping requires it. We would rather state this plainly than let the word imply more than it means.',
          ],
        },
        {
          heading: 'Cookies and analytics',
          paragraphs: [
            'Analytics load only after you consent, and declining is remembered. The site works identically either way. We exclude personal information from analytics entirely — no names, no email addresses, no exact donation amounts tied to an identifiable person.',
          ],
        },
        {
          heading: 'Your rights',
          list: [
            'Ask what personal data we hold about you',
            'Ask us to correct anything inaccurate',
            'Ask us to delete your data, subject to the statutory retention above',
            'Withdraw consent for communications at any time',
          ],
        },
        {
          heading: 'How to contact us',
          paragraphs: [
            'Use the contact form or email us. We respond to data requests within thirty days, and usually much sooner.',
          ],
        },
      ]}
    />
  );
}
