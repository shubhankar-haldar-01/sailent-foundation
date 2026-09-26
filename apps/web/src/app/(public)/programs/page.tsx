import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { ProgramCard } from '@/components/programs/program-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { getPrograms } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Programs',
  description:
    'Seven areas of long-term work across education, healthcare, child welfare, women’s empowerment, livelihoods, environment and animal welfare.',
  path: '/programs',
});

export default async function ProgramsPage() {
  const [lead, ...rest] = await getPrograms();

  return (
    <>
      <PageHero
        eyebrow="Programs"
        title="Long-term work, not one-off projects"
        lead="Programs run for years and are measured over years. Campaigns fund specific pieces of them, which is why a campaign always belongs to a program."
      />
      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Programs', path: '/programs' },
            ]}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lead ? (
              <ProgramCard program={lead} featured className="sm:col-span-2 lg:col-span-3" />
            ) : null}
            {rest.map((program) => (
              <ProgramCard key={program.slug} program={program} />
            ))}
          </div>
        </PageShell>
      </Section>
    </>
  );
}
