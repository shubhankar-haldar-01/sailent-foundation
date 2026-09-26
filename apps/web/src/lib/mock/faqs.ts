import type { FaqEntry } from './types';

/**
 * FAQ fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT. Answers are written to be accurate about how the
 * platform is designed to work. Where an answer would require a statutory
 * registration number, it says the number is published on the transparency
 * page rather than inventing one.
 */

export const faqs: FaqEntry[] = [
  {
    id: 'd1',
    category: 'donations',
    question: 'Is my donation eligible for tax deduction under Section 80G?',
    answer:
      'Donations to organizations registered under Section 80G are eligible for deduction. Our registration details are published in full on the transparency page. Note that the receipt you receive immediately after donating is a payment receipt — the 80G certificate (Form 10BE) is issued separately after the annual statement of donations is filed, by 31 May following the end of the financial year.',
  },
  {
    id: 'd2',
    category: 'donations',
    question: 'What is the difference between choosing a product and giving an amount?',
    answer:
      'Choosing a product means your donation funds a specific, priced item — a school kit, a medicine kit, a month of nutrition support. Giving an amount lets the program team allocate it where it is most needed within that campaign. You can do both in the same donation.',
  },
  {
    id: 'd3',
    category: 'donations',
    question: 'Can I give monthly instead of once?',
    answer:
      'Yes. Monthly giving can be set up during the donation flow and managed entirely from your account afterwards — pause, change or cancel, without contacting us.',
  },
  {
    id: 'd4',
    category: 'donations',
    question: 'Can I donate from outside India?',
    answer:
      'Not at present. Accepting foreign contributions requires registration under the Foreign Contribution (Regulation) Act, which we do not currently hold. Donations are accepted in Indian rupees from Indian payment instruments only. We would rather say this here than let you discover it at the payment screen.',
  },
  {
    id: 'd5',
    category: 'donations',
    question: 'What if I was charged twice, or for a payment I did not make?',
    /*
      The refund question this replaced was removed in Phase 9 §59, which bars
      refund policy, links, information and terms from the site.

      This one is kept because it is NOT a refund question: a duplicate or
      unrecognised charge is a payment dispute, handled by the card network,
      and someone in that situation needs to know where to go. Leaving them
      with nothing would not make the charge go away.
    */
    answer:
      'That is a payment dispute rather than a question about your gift, and your bank or card issuer is the place to raise it — they can investigate it through the payment network. Tell us as well and we will help their investigation with whatever records we hold. A payment that failed or was abandoned never reached us at all; if your bank is showing an amount held against one, your bank releases it, usually within a few working days.',
  },
  {
    id: 'd6',
    category: 'donations',
    question: 'Will my donation be shown publicly?',
    answer:
      'Only if you choose. You can mark a donation anonymous during checkout, which removes your name from any public listing. Note that anonymity is public-facing only — our finance team can always identify a donor, because statutory record-keeping requires it.',
  },
  {
    id: 'c1',
    category: 'campaigns',
    question: 'What happens if a campaign raises more than its goal?',
    answer:
      'Each campaign states on its own page what happens to funds beyond the goal — usually extending the same program to additional locations. Some campaigns are configured to stop accepting donations once the goal is met, and those say so.',
  },
  {
    id: 'c2',
    category: 'campaigns',
    question: 'Why do some campaigns show a deadline and others do not?',
    answer:
      'Because only some campaigns have one. A school kit campaign has a genuine deadline tied to the academic year. A water infrastructure campaign follows the monsoon calendar and has no fundraising deadline, so we do not display a countdown to manufacture urgency.',
  },
  {
    id: 'c3',
    category: 'campaigns',
    question: 'How is campaign progress calculated?',
    answer:
      'The amount raised reflects payments that have been confirmed by our payment provider, not payments that have been started. A donation appears in the total once it is verified server-side, which is usually within a minute.',
  },
  {
    id: 'v1',
    category: 'volunteering',
    question: 'What is the minimum commitment?',
    answer:
      'One day a month for six months. We would rather have someone reliable once a month than someone enthusiastic for three weeks — the training we invest in each volunteer only pays back over time.',
  },
  {
    id: 'v2',
    category: 'volunteering',
    question: 'Do I need specific skills or qualifications?',
    answer:
      'For most field work, no. Distribution days, registration support and event assistance need reliability rather than credentials. Some roles — medical camps, vocational training, accounting support — do call for specific skills, and those are listed as such.',
  },
  {
    id: 'v3',
    category: 'volunteering',
    question: 'What happens after I apply?',
    answer:
      'Your application is reviewed, usually within two weeks. If approved you receive a permanent volunteer ID and an invitation to the next orientation session. Attendance at orientation is required before a first field assignment.',
  },
  {
    id: 'v4',
    category: 'volunteering',
    question: 'Can I volunteer remotely?',
    answer:
      'Some roles yes — translation, design, data entry and research support. Field programs require being present in the districts where we work.',
  },
  {
    id: 'v5',
    category: 'volunteering',
    question: 'Will I receive a certificate?',
    answer:
      'Yes, based on verified hours. Certificates state the hours actually recorded and confirmed by a program manager, which is why volunteers cannot edit their own attendance.',
  },
  {
    id: 'e1',
    category: 'events',
    question: 'What happens if an event is full?',
    answer:
      'You can join the waitlist. Places open up regularly, and waitlisted registrants are promoted automatically in order and notified.',
  },
  {
    id: 'e2',
    category: 'events',
    question: 'Are events free to attend?',
    answer:
      'Yes. We do not charge for events. Travel to field locations is usually your own arrangement, and the event page says so where that applies.',
  },
  {
    id: 't1',
    category: 'transparency',
    question: 'How much of my donation reaches the program?',
    answer:
      'The proportion of funds spent on programs versus administration is published annually in the fund utilisation report, available on the transparency page. We publish the actual figure each year rather than a claimed percentage.',
  },
  {
    id: 't2',
    category: 'transparency',
    question: 'Are your accounts independently audited?',
    answer:
      'Yes. Audited financial statements, certified by an independent chartered accountant, are published for each financial year on the transparency page.',
  },
  {
    id: 't3',
    category: 'transparency',
    question: 'How do you decide what counts as impact?',
    answer:
      'Every public figure traces either to a database aggregate or to a dated record with a stated method. The impact page explains how each number is derived, including what we deliberately do not count.',
  },
  {
    id: 'g1',
    category: 'general',
    question: 'How do I contact someone directly?',
    answer:
      'Use the contact form, or the email and phone number listed on the contact page. We aim to respond within three working days.',
  },
  {
    id: 'g2',
    category: 'general',
    question: 'How is my personal data handled?',
    answer:
      'We collect only what is needed to process your donation, issue a receipt and meet statutory record-keeping requirements. Details are in the privacy policy, including how to request deletion and what we are legally required to retain.',
  },
];

export const faqCategories: { id: FaqEntry['category']; label: string; description: string }[] = [
  { id: 'donations', label: 'Donations', description: 'Giving, receipts and tax' },
  {
    id: 'campaigns',
    label: 'Campaigns',
    description: 'How campaigns work and how progress is counted',
  },
  {
    id: 'volunteering',
    label: 'Volunteering',
    description: 'Applying, commitment and certification',
  },
  { id: 'events', label: 'Events', description: 'Registration, capacity and attendance' },
  {
    id: 'transparency',
    label: 'Transparency',
    description: 'Accounts, audits and how we measure impact',
  },
  { id: 'general', label: 'General', description: 'Contact and data handling' },
];

export function getFaqsByCategory(category: FaqEntry['category']): FaqEntry[] {
  return faqs.filter((faq) => faq.category === category);
}

/** A short set for contextual FAQ blocks on other pages. */
export function getFaqsFor(categories: FaqEntry['category'][], limit = 5): FaqEntry[] {
  return faqs.filter((faq) => categories.includes(faq.category)).slice(0, limit);
}
