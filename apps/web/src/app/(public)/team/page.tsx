import type { Metadata } from 'next';

import { TeamDirectory } from '@/components/team/team-directory';
import { buildMetadata } from '@/lib/seo/metadata';
import { getTeam } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Our team',
  description:
    'Meet our team: a dedicated group of people working together to support communities, create opportunities, and build a better tomorrow.',
  path: '/team',
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeamPage() {
  const members = await getTeam();

  return (
    // No banner (owner, 2026-11-22): the directory's header panel is the page
    // header — the breadcrumb, the h1, the team's faces and the search
    // (`AGENTS.md` §11 item 25).
    <div className="pb-20">
      <TeamDirectory initialMembers={members} />
    </div>
  );
}
