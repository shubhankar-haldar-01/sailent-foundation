import type { Testimonial } from './types';

/**
 * Testimonial fixtures.
 *
 * ⚠️ DEVELOPMENT CONTENT. Fictional quotations from fictional people, used to
 * exercise the component. No real supporter is quoted.
 */

export const testimonials: Testimonial[] = [
  {
    id: 't1',
    kind: 'donor',
    quote:
      'I have given to a lot of organizations and this is the first one that told me a program had not worked. That is the reason I set up a monthly donation.',
    authorName: 'Ananya R.',
    authorRole: 'Monthly donor since 2024',
  },
  {
    id: 't2',
    kind: 'volunteer',
    quote:
      'The orientation was blunt about what field days actually involve — long, hot and often administrative. I appreciated knowing that before I signed up rather than after.',
    authorName: 'Karthik S.',
    authorRole: 'Volunteer, education program',
  },
  {
    id: 't3',
    kind: 'donor',
    quote:
      'Being able to fund a specific thing — two school kits, not a vague contribution — is what made me finish the donation rather than close the tab.',
    authorName: 'Meera J.',
    authorRole: 'Donor',
  },
  {
    id: 't4',
    kind: 'partner',
    quote:
      'They asked our school management committee what we needed before proposing anything. That is rarer than it should be.',
    authorName: 'Head teacher',
    authorRole: 'Partner school, Ranchi district',
  },
  {
    id: 't5',
    kind: 'volunteer',
    quote:
      'My certificate lists the hours I actually did, verified by the program manager. It meant something when I used it in a job application.',
    authorName: 'Divya P.',
    authorRole: 'Volunteer, healthcare program',
  },
];

export function getTestimonialsByKind(kind: Testimonial['kind']): Testimonial[] {
  return testimonials.filter((testimonial) => testimonial.kind === kind);
}
