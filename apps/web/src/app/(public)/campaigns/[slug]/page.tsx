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
 * products, other ways to support (any amount, typed), about (its photos
 * first), stories, recent supporters, the difference support makes, FAQs. The
 * side column is the donation card and the assurances under it, sticky for the
 * whole length of the main column.
 *
 * When the campaign has products, the donation builder lays out both columns —
 * it owns the basket the grid and the card share — and this page hands it the
 * rest as slots. When it has none, nothing on the page takes money, and the
 * page lays out the same grid itself with a progress card in the side column.
 *
 * Below `lg` it is one column in the same order, and nothing is fixed to the
 * screen: the donation card sits in the page straight after the ways of
 * giving, and scrolls with it.
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
    /*
      Only when the campaign belongs to a programme. An empty slug is no filter
      at all, so a stand-alone campaign would list every campaign under a
      "More in" heading with no programme name in it.
    */
    campaign.programSlug ? getCampaigns({ programSlug: campaign.programSlug }) : [],
    getCampaignDonors(campaign.slug, { limit: 5 }),
  ]);

  const relatedCampaigns = siblings.filter((item) => item.slug !== campaign.slug).slice(0, 3);

  /*
    THIS CAMPAIGN'S OWN STORIES, and only those when it has any. Topping them
    up from the wider set put another campaign's result under this one's name.

    A campaign with none borrows — its programme's first, then the rest — and
    the strip labels them as coming from elsewhere (`fromElsewhere`).
  */
  const ownStories = allStories.filter(
    (story) => story.campaignId === campaign.id || story.campaignSlug === campaign.slug,
  );
  const storiesFromElsewhere = ownStories.length === 0;
  const programmeCampaignIds = new Set(siblings.map((item) => item.id));
  const isFromProgramme = (story: (typeof allStories)[number]) =>
    (story.campaignId != null && programmeCampaignIds.has(story.campaignId)) ||
    (campaign.programSlug !== '' && story.programSlug === campaign.programSlug);
  const stories = (
    storiesFromElsewhere
      ? [
          ...allStories.filter(isFromProgramme),
          ...allStories.filter((story) => !isFromProgramme(story)),
        ]
      : ownStories
  ).slice(0, 4);

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
      <StoriesStrip stories={stories} fromElsewhere={storiesFromElsewhere} />
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
