import type { Metadata } from 'next';

import { PageShell } from '@/components/layout/page-shell';
import { TeamHero } from '@/components/team/team-hero';
import { TeamDirectory } from '@/components/team/team-directory';
import { buildMetadata } from '@/lib/seo/metadata';
import { getTeam } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Our Team',
  description:
    'Meet our team: a dedicated group of people working together to support communities, create opportunities, and build a better tomorrow.',
  path: '/team',
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeamPage() {
  const members = await getTeam();

  return (
    <div className="bg-[#F8FAFC]/50 pb-20 pt-2 dark:bg-[#0A101D]">
      <PageShell>
        {/* Hero Section */}
        <TeamHero />

        {/* Interactive Directory: Toolbar, Leadership, and Our Team Grid */}
        <TeamDirectory initialMembers={members} />
      </PageShell>
    </div>
  );
}
