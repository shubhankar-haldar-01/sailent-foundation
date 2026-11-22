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
      'I have given to a lot of organizations and this is the first one that told me a program had not worked. That is the reason I keep coming back to give.',
    authorName: 'Ananya R.',
    authorRole: 'Donor since 2024',
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
];

export function getTestimonialsByKind(kind: Testimonial['kind']): Testimonial[] {
  return testimonials.filter((testimonial) => testimonial.kind === kind);
}
