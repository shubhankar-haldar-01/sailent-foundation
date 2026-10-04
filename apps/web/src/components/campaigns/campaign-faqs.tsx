import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@sailent/ui';

import type { Campaign } from '@/lib/mock/types';
import { SectionHeading } from '@/components/sections/section-heading';

/**
 * The campaign's own questions, as separate rows.
 *
 * The design-system accordion does the work — Radix's disclosure wiring,
 * `aria-expanded`, Enter and Space, the rotating chevron — and only its frame
 * changes here: each question is its own bordered row rather than a line in a
 * ruled list, so the section reads as a stack of things to open.
 *
 * Renders nothing when the campaign has no questions of its own; the link to
 * the general FAQ page is not a reason to show an empty section.
 */
export function CampaignFaqs({ faqs }: { faqs: Campaign['faqs'] }) {
  if (faqs.length === 0) return null;

  return (
    <section id="campaign-faqs" aria-labelledby="faqs-heading" className="mt-12 scroll-mt-32">
      <SectionHeading
        id="faqs-heading"
        size="md"
        title="FAQs"
        lead="Find answers to common questions about this campaign."
        viewAll={{ href: '/faq', label: 'View All FAQs' }}
      />

      <Accordion type="single" collapsible className="mt-4 space-y-2">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={faq.question}
            value={`faq-${index}`}
            className="border-border bg-surface data-[state=open]:border-success/50 rounded-xl border px-4 shadow-sm transition-colors"
          >
            <AccordionTrigger className="text-body py-3.5 font-semibold">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-body text-muted-foreground-strong leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
