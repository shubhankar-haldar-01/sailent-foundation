import Link from 'next/link';
import type { Metadata } from 'next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { buildMetadata } from '@/lib/seo/metadata';
import { jsonLd } from '@/lib/seo/structured-data';
import { faqCategories, faqs, getFaqsByCategory } from '@/lib/mock';

export const metadata: Metadata = buildMetadata({
  title: 'Frequently asked questions',
  description:
    'Questions about donating, campaigns, volunteering, events and how we account for what we do.',
  path: '/faq',
});

export default function FaqPage() {
  /**
   * FAQPage structured data is emitted only because every question below is
   * genuinely rendered on this page. Marking up questions that are not visible
   * is a search-guidelines violation.
   */
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqSchema)} />

      <PageHero
        eyebrow="FAQ"
        title="Questions people actually ask"
        lead="If your question is not here, ask us directly — we answer within three working days."
      />

      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'FAQ', path: '/faq' },
            ]}
          />

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <nav
              aria-label="FAQ categories"
              className="lg:sticky lg:top-24 lg:col-span-3 lg:self-start"
            >
              <h2 className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
                Categories
              </h2>
              <ul className="mt-3 space-y-1">
                {faqCategories.map((category) => (
                  <li key={category.id}>
                    <a
                      href={`#${category.id}`}
                      className="text-body-sm hover:bg-muted focus-visible:outline-ring flex min-h-10 items-center rounded-md px-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {category.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-12 lg:col-span-9">
              {faqCategories.map((category) => {
                const entries = getFaqsByCategory(category.id);
                if (entries.length === 0) return null;

                return (
                  <section key={category.id} id={category.id} className="scroll-mt-24">
                    <h2 className="text-h2 font-semibold">{category.label}</h2>
                    <p className="text-body-sm text-muted-foreground mt-1">
                      {category.description}
                    </p>

                    <Accordion type="single" collapsible className="mt-4">
                      {entries.map((faq) => (
                        <AccordionItem key={faq.id} value={faq.id}>
                          <AccordionTrigger>{faq.question}</AccordionTrigger>
                          <AccordionContent>{faq.answer}</AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </section>
                );
              })}

              <div className="border-border bg-surface-sunken rounded-lg border p-6">
                <h2 className="text-h4 font-semibold">Still have a question?</h2>
                <p className="text-body-sm text-muted-foreground mt-2">
                  We answer within three working days, and we would rather you asked than guessed.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/contact">Contact us</Link>
                </Button>
              </div>
            </div>
          </div>
        </PageShell>
      </Section>
    </>
  );
}
