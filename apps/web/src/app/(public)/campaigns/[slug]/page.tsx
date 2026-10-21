import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageShell } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { DonationBuilder } from '@/components/donations/donation-builder';
import { CampaignAbout, hasAboutContent } from '@/components/campaigns/campaign-about';
import { CampaignFaqs } from '@/components/campaigns/campaign-faqs';
import { CampaignHero } from '@/components/campaigns/campaign-hero';
import {
  CampaignSectionNav,
  type CampaignSectionLink,
} from '@/components/campaigns/campaign-section-nav';
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
 * first), stories, recent supporters, FAQs (the "difference your support can
 * make" block was taken off at the owner's request, 2026-10-16). The
 * side column is the donation card and the assurances under it, sticky for the
 * whole length of the main column.
 *
 * The donation builder lays out both columns for EVERY campaign — it owns the
 * basket the grid and the card share — and this page hands it the rest as
 * slots. A campaign with no products simply has no product grid: its main
 * column opens on "Choose an amount", and the card beside it takes the gift
 * exactly as it does on a campaign that lists items. One design for every
 * campaign page, whichever page it was reached from (owner, 2026-10-16); the
 * progress-only side card that product-less campaigns used to get is retired.
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
      The programme's other campaigns, so the stories strip can prefer that
      programme's stories when this campaign has none of its own. Only when the
      campaign belongs to a programme: an empty slug is no filter at all.

      (They are no longer listed on the page: the "More in <programme>" row
      after the FAQs was taken off at the owner's request, 2026-10-16.)
    */
    campaign.programSlug ? getCampaigns({ programSlug: campaign.programSlug }) : [],
    getCampaignDonors(campaign.slug, { limit: 5 }),
  ]);

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
    // The ask comes first on every campaign: the product grid when there is
    // one, otherwise the amount panel — both carry `id="give"`.
    { id: 'give', label: hasProducts ? 'Products' : 'Donate' },
    ...(hasAboutContent(campaign) ? [{ id: 'campaign-about', label: 'About' }] : []),
    ...(stories.length > 0 ? [{ id: 'campaign-stories', label: 'Stories' }] : []),
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
      <CampaignFaqs faqs={campaign.faqs} />
    </>
  );

  const assurances = <CampaignAssurances />;

  return (
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

      <DonationBuilder
        campaign={campaign}
        lead={lead}
        assurances={assurances}
        preselectSmallestAmount
      >
        {body}
      </DonationBuilder>
    </PageShell>
  );
}
