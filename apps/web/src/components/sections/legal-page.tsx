import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

/**
 * Shared legal page template.
 *
 * The copy below each page supplies is a DRAFT describing how the platform is
 * designed to behave. Final legal text is reviewed and approved by the
 * organization before launch — the notice at the top says so on every page,
 * because a policy nobody has approved should not read as though they had.
 */
export function LegalPage({
  title,
  lead,
  updated,
  sections,
  path,
}: {
  title: string;
  lead: string;
  updated: string;
  sections: LegalSection[];
  path: string;
}) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} lead={lead} />
      <Section>
        <PageShell width="content">
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: title, path },
            ]}
          />

          <p className="border-warning/25 bg-warning-subtle text-body-sm text-warning-foreground rounded-lg border p-4">
            <span className="font-semibold">Draft.</span> This describes how the platform is
            designed to work. Final wording is reviewed and approved by Sailent Foundation before
            launch.
          </p>

          <p className="text-caption text-muted-foreground mt-6">Last updated: {updated}</p>

          <div className="mt-8 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-h2 font-semibold">{section.heading}</h2>
                {section.paragraphs?.map((paragraph, index) => (
                  <p key={index} className="text-body text-muted-foreground mt-3 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                {section.list ? (
                  <ul className="text-body text-muted-foreground mt-3 list-disc space-y-2 pl-5 leading-relaxed">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </PageShell>
      </Section>
    </>
  );
}
