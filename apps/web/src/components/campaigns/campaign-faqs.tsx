import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@sailent/ui';

import type { Campaign } from '@/lib/mock/types';

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
    <section id="campaign-faqs" aria-labelledby="faqs-heading" className="mt-12 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="faqs-heading" className="text-h2 font-bold">
            FAQs
          </h2>
          <p className="text-body-sm text-muted-foreground mt-1">
            Find answers to common questions about this campaign.
          </p>
        </div>
        <Link
          href="/faq"
          className="text-body-sm text-info-action focus-visible:outline-ring inline-flex items-center gap-1.5 rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          View All FAQs
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <Accordion type="single" collapsible className="mt-4 space-y-2">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={faq.question}
            value={`faq-${index}`}
            className="border-border bg-surface rounded-lg border px-4"
          >
            <AccordionTrigger className="text-body-sm py-3 font-semibold">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-body-sm leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
