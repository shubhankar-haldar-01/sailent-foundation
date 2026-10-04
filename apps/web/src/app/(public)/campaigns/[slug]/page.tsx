import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { DonationBuilder } from '@/components/donations/donation-builder';
import { donationColumns } from '@/components/donations/donation-layout';
import { StickyRail } from '@/components/donations/sticky-rail';
import { CampaignAbout, hasAboutContent } from '@/components/campaigns/campaign-about';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CampaignFaqs } from '@/components/campaigns/campaign-faqs';
import { CampaignHero } from '@/components/campaigns/campaign-hero';
import { CampaignImpact } from '@/components/campaigns/campaign-impact';
import {
  CampaignSectionNav,
  type CampaignSectionLink,
} from '@/components/campaigns/campaign-section-nav';
import { CampaignStatusCard } from '@/components/campaigns/campaign-status-card';
import { CampaignAssurances } from '@/components/campaigns/campaign-trust';
import { RecentDonors } from '@/components/campaigns/recent-donors';
import { StoriesStrip } from '@/components/campaigns/stories-strip';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCampaign, getCampaignDonors, getCampaigns, getStories } from '@/lib/content';

export async function generateStaticParams() {
  const campaigns = await getCampaigns();
  return campaigns.map((campaign) => ({ slug: campaign.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const campaign = await getCampaign((await params).slug);
  if (!campaign)
    return buildMetadata({ title: 'Campaign not found', path: '/campaigns', noIndex: true });

  return buildMetadata({
    title: campaign.title,
    description: campaign.shortDescription,
    path: `/campaigns/${campaign.slug}`,
    // Archived campaigns stay reachable but should not be indexed.
    noIndex: campaign.status === 'archived',
  });
}

/**
 * The campaign page.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO COLUMNS: THE CAMPAIGN, AND THE DONATION CARD BESIDE ALL OF IT.
 *
 * The main column runs, in this order: photograph and facts, section links,
 * products, about (its photos first), stories, recent supporters, the
 * difference support makes, FAQs. An amount is chosen from the presets in the
 * donation card; the page has no separate panel for it. The side column is the
 * donation card and the assurances under it, sticky for the whole length of
 * the main column.
 *
 * When the campaign has products, the donation builder lays out both columns —
 * it owns the basket the grid and the card share — and this page hands it the
 * rest as slots. When it has none, nothing on the page takes money, and the
 * page lays out the same grid itself with a progress card in the side column.
 *
 * Below `lg` it is one column in the same order; the donation card becomes the
 * bottom sheet, and the progress and assurances close the page.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const campaign = await getCampaign((await params).slug);
  if (!campaign) notFound();

  const [allStories, siblings, donors] = await Promise.all([
    getStories(),
    getCampaigns({ programSlug: campaign.programSlug }),
    getCampaignDonors(campaign.slug, { limit: 5 }),
  ]);

  const relatedCampaigns = siblings.filter((item) => item.slug !== campaign.slug).slice(0, 3);

  /*
    Stories from this campaign first, TOPPED UP from the wider set — one on
    screen and up to three beside it. A campaign with one story of its own
    would otherwise show a layout built for four with three gaps in it.
  */
  const relatedStories = allStories.filter((story) => story.campaignSlug === campaign.slug);
  const stories = [
    ...relatedStories,
    ...allStories.filter((story) => !relatedStories.includes(story)),
  ].slice(0, 4);

  const hasProducts = campaign.products.length > 0;

  // Only sections that will actually render get a link.
  const sections: CampaignSectionLink[] = [
    ...(hasProducts ? [{ id: 'give', label: 'Products' }] : []),
    ...(hasAboutContent(campaign) ? [{ id: 'campaign-about', label: 'About' }] : []),
    ...(stories.length > 0 ? [{ id: 'campaign-stories', label: 'Stories' }] : []),
    { id: 'campaign-impact', label: 'Impact' },
    ...(campaign.faqs.length > 0 ? [{ id: 'campaign-faqs', label: 'FAQs' }] : []),
  ];

  const lead = (
    <>
      <CampaignHero campaign={campaign} />
      <CampaignSectionNav sections={sections} className="mt-6" />
    </>
  );

  const body = (
    <>
      <CampaignAbout campaign={campaign} />
      <StoriesStrip stories={stories} />
      <RecentDonors donors={donors} />
      <CampaignImpact campaign={campaign} />
      <CampaignFaqs faqs={campaign.faqs} />
    </>
  );

  const assurances = <CampaignAssurances />;

  return (
    <>
      <PageShell className="pb-12 pt-2 md:pb-16">
        {/*
          Above BOTH columns, so the photograph and the donation card start on
          the same line.
        */}
        <Breadcrumbs
          className="mb-2.5"
          entries={[
            { name: 'Home', path: '/' },
            { name: 'Campaigns', path: '/campaigns' },
            { name: campaign.title, path: `/campaigns/${campaign.slug}` },
          ]}
        />

        {hasProducts ? (
          <DonationBuilder
            campaign={campaign}
            lead={lead}
            assurances={assurances}
            showCustomAmountSection={false}
            preselectSmallestAmount
          >
            {body}
          </DonationBuilder>
        ) : (
          <div className={donationColumns}>
            <div className="min-w-0">
              {lead}
              {body}
            </div>
            <StickyRail>
              <CampaignStatusCard campaign={campaign} assurances={assurances} />
            </StickyRail>
          </div>
        )}
      </PageShell>

      {relatedCampaigns.length > 0 ? (
        <Section className="border-border bg-surface-sunken border-t">
          <PageShell>
            <h2 className="text-h1 font-bold">More in {campaign.programName}</h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCampaigns.map((item) => (
                <li key={item.slug}>
                  <CampaignCard campaign={item} />
                </li>
              ))}
            </ul>
          </PageShell>
        </Section>
      ) : null}
    </>
  );
}
