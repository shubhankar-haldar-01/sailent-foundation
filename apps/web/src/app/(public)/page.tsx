import type { Metadata } from 'next';

import { CampaignBrowser } from '@/components/home/campaign-browser';
import { CampaignShowcase } from '@/components/home/campaign-showcase';
import { CommunityCta } from '@/components/home/community-cta';
import { HeroSection } from '@/components/home/hero-section';
import { ImpactStats } from '@/components/home/impact-stats';
import { NewsletterSection } from '@/components/home/newsletter-section';
import { PartnersSection } from '@/components/home/partners-section';
import { StoriesAndEvents } from '@/components/home/stories-and-events';
import { Testimonials } from '@/components/home/testimonials';
import { WhoWeAre } from '@/components/home/who-we-are';
import { ComposedSections } from '@/components/home/section-renderer';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  getComposedPage,
  getCampaigns,
  getEvents,
  getHeadlineMetrics,
  getStories,
} from '@/lib/content';
import { readDonorViewer } from '@/lib/donor/viewer';

export const metadata: Metadata = buildMetadata({
  /**
   * The homepage names the organization FIRST — it is the one page reached by
   * searching for "Sailent Foundation", and the name should be the first thing
   * in the result rather than trailing after a strapline.
   */
  titleOverride: 'Sailent Foundation | Empowering People, Transforming Lives',
  title: 'Empowering People, Transforming Lives',
  description:
    'Sailent Foundation works across education, healthcare, food security, disaster relief, livelihoods, women’s empowerment and animal welfare to build stronger, more inclusive communities.',
  path: '/',
});

/**
 * Homepage.
 *
 * Section order follows the approved design. Three rules shape it:
 *
 *   • ONE primary action above the fold. The donation widget and the Donate
 *     button are the same ask; everything else is outlined, blue, or a link.
 *   • Every statistic is a live database aggregate (decision A14). Bands with
 *     nothing to report do not render, which is why several sections guard on
 *     length rather than showing an empty state — on the most prominent page
 *     we have, absence is quieter and more honest than an apology.
 *   • Content before asks. Programs, campaigns, stories and results come
 *     before the closing community panel.
 *
 * The campaigns band sits above "Who we are": someone who arrived ready to
 * give reaches the ask without scrolling past the explanation, and someone who
 * wants the explanation still meets it before the stories.
 */
export default async function HomePage() {
  // Five independent reads, issued together. Awaited one after another this
  // page would be as slow as their sum, and the homepage is the one nobody
  // waits for.
  const [headlineMetrics, featuredCampaigns, stories, events, composed, viewer] = await Promise.all(
    [
      getHeadlineMetrics(),
      /*
      Twenty-four, not six.

      The row still shows three at a time, but the focus-area strip now filters
      it in the browser — so anything not fetched cannot be found. At a limit of
      six, an area whose campaigns happened to sort seventh would show "no
      campaign running" while one was. The cap is generous rather than absent
      because the band is a teaser: past two dozen, "View all campaigns" is the
      honest answer and it queries the server.
    */
      getCampaigns({ status: 'active', sort: 'createdAt', limit: 24 }),
      getStories(),
      getEvents('upcoming'),
      getComposedPage('home'),
      // Signed in, and what they saved — so the campaign cards' save hearts
      // draw themselves correctly, as they do on the campaigns listing.
      readDonorViewer(),
    ],
  );

  const data = {
    metrics: headlineMetrics,
    campaigns: featuredCampaigns,
    stories,
    events,
    viewer,
  };

  /*
    ══════════════════════════════════════════════════════════════════════════
    COMPOSED FROM THE DATABASE WHEN A PUBLISHED `home` PAGE EXISTS, and from
    the order below when it does not.

    Phase 10.9's composer stores which approved sections this page shows and in
    what order. The fallback is not a placeholder: it is the canonical order,
    and it means the homepage cannot be broken by an empty table, an
    unreachable API, or a page somebody archived by mistake. The site has a
    homepage whatever the CMS says.

    Every section renders through the SAME components either way — see
    `components/home/section-renderer.tsx`.
    ══════════════════════════════════════════════════════════════════════════
  */
  if (composed && composed.sections.length > 0) {
    return <ComposedSections sections={composed.sections} data={data} />;
  }

  return (
    <>
      {/* The NGO / Organization JSON-LD is emitted once by the root layout,
          so it is not repeated here — two blocks describing one organization
          is a validation warning and no benefit. */}
      <HeroSection metrics={headlineMetrics} />
      {/*
        The featured campaigns band, straight after the hero. The focus-area
        strip that sat between them was removed at the client's request.

        Campaigns come BEFORE "Who we are", swapped with it. The two kept their
        own band colours rather than trading those as well, so each section
        still looks like itself, and the tinted impact strip still separates
        the two halves.
      */}
      <CampaignBrowser campaigns={featuredCampaigns} viewer={viewer} />
      <ImpactStats metrics={headlineMetrics} />
      {/*
        The campaigns page's grid — cause tiles, two rows of cards and "View
        More Campaigns" — directly before "Who we are". An ADDITION to the
        featured band above, with its own cause selection.
      */}
      <CampaignShowcase campaigns={featuredCampaigns} viewer={viewer} />
      <WhoWeAre />
      <StoriesAndEvents stories={stories.slice(0, 3)} events={events.slice(0, 3)} />
      <Testimonials />
      <CommunityCta />
      <PartnersSection />
      <NewsletterSection />
    </>
  );
}
