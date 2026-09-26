import type { Metadata } from 'next';

import { EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { TeamMemberCard } from '@/components/team/team-member-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { getTeamGrouped } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Our team',
  description: 'The people who run the programs, manage the finances and govern the organization.',
  path: '/team',
});

export default async function TeamPage() {
  const groups = await getTeamGrouped();

  return (
    <>
      <PageHero
        eyebrow="Our team"
        title="Who runs this"
        lead="A small staff team, a field team in each district, and a board that reviews the work quarterly and independently of the executive."
      />
      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Our team', path: '/team' },
            ]}
          />

          {/*
            An empty directory is a real state, not an impossible one: a fresh
            deployment has nobody published yet, and the fixture fallback is
            development-only. Without this the page rendered a hero and a
            breadcrumb over nothing, which reads as broken rather than as new.
          */}
          {groups.length === 0 ? (
            <EmptyState
              kind="no-content"
              title="Team information will be available soon"
              description="We are still preparing the profiles of the people behind this work."
              className="mt-6"
            />
          ) : null}

          <div className="space-y-16">
            {groups.map(({ department, members }) => {
              return (
                <section key={department} aria-labelledby={`dept-${department.toLowerCase()}`}>
                  <h2
                    id={`dept-${department.toLowerCase()}`}
                    className="border-border text-h2 border-b pb-3 font-semibold"
                  >
                    {department}
                  </h2>
                  <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {members.map((member) => (
                      <TeamMemberCard key={member.slug} member={member} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </PageShell>
      </Section>
    </>
  );
}
