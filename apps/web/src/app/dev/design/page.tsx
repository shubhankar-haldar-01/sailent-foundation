import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { campaignFaqsWithDefaults } from '@/components/campaigns/campaign-default-faqs';
import { DesignDirections } from '@/components/design-preview/design-directions';
import { getCampaign, getCampaignFilters, getCampaigns, getPrograms } from '@/lib/content';
import { getOrganisationRecords } from '@/lib/content/organisation';

export const metadata: Metadata = {
  title: 'Design directions (development)',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Two design directions on real content, for the owner to choose (visual
 * polish brief, Phase 1, 2026-11-21). Not part of the product: production
 * answers 404, like the other /dev routes.
 */
export default async function DesignPage() {
  if (process.env.APP_ENV === 'production') notFound();

  const full =
    (await getCampaign('school-kits-jharkhand')) ??
    (await getCampaigns()).find((item) => item.status === 'active');
  if (!full) notFound();

  const [organisation, programmes, filters] = await Promise.all([
    getOrganisationRecords(),
    getPrograms(),
    getCampaignFilters().catch(() => ({ categories: [], locations: [] })),
  ]);
  const faqs = campaignFaqsWithDefaults(full, {
    organisationName: organisation.name,
    programmes: programmes.map((programme) => programme.name),
    causes: filters.categories,
  });

  return <DesignDirections campaign={full} faqs={faqs} />;
}
