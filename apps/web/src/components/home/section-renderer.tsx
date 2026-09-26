import type { PageSection } from '@sailent/validation';

import { CampaignBrowser } from '@/components/home/campaign-browser';
import { CommunityCta } from '@/components/home/community-cta';
import { HeroSection } from '@/components/home/hero-section';
import { ImpactStats } from '@/components/home/impact-stats';
import { NewsletterSection } from '@/components/home/newsletter-section';
import { PartnersSection } from '@/components/home/partners-section';
import { StoriesAndEvents } from '@/components/home/stories-and-events';
import { Testimonials } from '@/components/home/testimonials';
import { WhoWeAre } from '@/components/home/who-we-are';
import type { Campaign, SailentEvent, Story } from '@/lib/mock/types';
import type { ImpactMetric } from '@/lib/content';

/**
 * Render a composed page's sections, in the order an editor put them.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SECTIONS ARE THE COMPONENTS THE SITE ALREADY HAD.
 *
 * There is no parallel set of "CMS blocks". `docs/information-architecture.md`
 * §3.6 says every homepage section is a component consumed elsewhere and all of
 * them are options in the composer, so the composer reorders exactly those —
 * which means a section cannot look different, or break, depending on whether
 * it arrived from the database or from the fallback below.
 *
 * DATA IS FETCHED BY THE PAGE, NOT CARRIED IN THE SECTION. An editor chooses
 * which sections appear and in what order; the campaigns, stories, events and
 * metrics come from the content layer exactly as they always have. That is the
 * line between a composer and a page builder, and it is why `props` are so
 * thin: a heading override and a count, never content.
 *
 * NOTHING HERE RENDERS MARKUP FROM THE DATABASE. A `type` is looked up in this
 * switch or ignored; a prop is passed to a typed React component. There is no
 * path by which a stored string becomes HTML.
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface SectionData {
  metrics: ImpactMetric[];
  campaigns: Campaign[];
  stories: Story[];
  events: SailentEvent[];
}

export function renderSection(section: PageSection, data: SectionData, key: string) {
  /*
    `props` DEFAULTED HERE, because this reads from the database.

    The write path parses through Zod, which fills `props` in — but a renderer
    that assumes its input was parsed is one restored revision, one hand-written
    row or one future code path away from `Cannot read properties of undefined`
    on the homepage. Defaulting costs nothing and removes the whole class.
  */
  const props = (section.props ?? {}) as Record<string, number | string | undefined>;
  const limit = typeof props.limit === 'number' ? props.limit : undefined;

  switch (section.type) {
    case 'hero':
      return <HeroSection key={key} metrics={data.metrics} />;

    case 'campaigns':
      return (
        <CampaignBrowser
          key={key}
          campaigns={data.campaigns.slice(0, limit ?? data.campaigns.length)}
        />
      );

    case 'impact':
      return <ImpactStats key={key} metrics={data.metrics} />;

    case 'about':
      return <WhoWeAre key={key} />;

    case 'storiesAndEvents':
      return (
        <StoriesAndEvents
          key={key}
          stories={data.stories.slice(0, limit ?? 3)}
          events={data.events.slice(0, limit ?? 3)}
        />
      );

    case 'testimonials':
      return <Testimonials key={key} />;

    case 'community':
      return <CommunityCta key={key} />;

    case 'partners':
      return <PartnersSection key={key} />;

    case 'newsletter':
      return <NewsletterSection key={key} />;

    default:
      /*
        Unreachable while the registry and this switch agree — the API refuses
        an unapproved type on write, so nothing unknown can be stored.

        It renders NOTHING rather than throwing. If a section type is ever
        retired while a published page still names it, the right outcome is a
        homepage missing one band, not a homepage that is a stack trace.
      */
      return null;
  }
}

/** The whole composition. */
export function ComposedSections({
  sections,
  data,
}: {
  sections: PageSection[];
  data: SectionData;
}) {
  return (
    <>
      {sections.map((section, index) => renderSection(section, data, `${section.type}-${index}`))}
    </>
  );
}
