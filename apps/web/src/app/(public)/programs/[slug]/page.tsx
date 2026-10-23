import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { ProgramDetailHero } from '@/components/programs/program-detail-hero';
import { ProgramAboutSection } from '@/components/programs/program-about-section';
import { ProgramCampaignsSection } from '@/components/programs/program-campaigns-section';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCampaignsByProgram, getProgramPage } from '@/lib/content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const page = await getProgramPage((await params).slug);
  if (!page) return buildMetadata({ title: 'Program not found', path: '/programs', noIndex: true });

  const { program } = page;
  return buildMetadata({
    title: program.name,
    description: program.shortDescription,
    path: `/programs/${program.slug}`,
  });
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;

  const page = await getProgramPage(slug);
  if (!page) notFound();

  const { program } = page;

  const relatedCampaigns = await getCampaignsByProgram(slug);

  return (
    <>
      <ProgramDetailHero program={program} />

      {/* About this program card section matching exact design */}
      <ProgramAboutSection program={program} />

      {/* Campaigns supporting this program section matching exact design */}
      <ProgramCampaignsSection program={program} campaigns={relatedCampaigns} />
    </>
  );
}
