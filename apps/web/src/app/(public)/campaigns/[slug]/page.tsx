import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FileText, Quote } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  formatDate,
  formatNumber,
} from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { MediaFigure } from '@/components/media/media-frame';
import { DonationBuilder } from '@/components/donations/donation-builder';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CampaignHero } from '@/components/campaigns/campaign-hero';
import { FocusAreasStrip } from '@/components/campaigns/focus-areas-strip';
import { RecentDonors } from '@/components/campaigns/recent-donors';
import { StoriesStrip } from '@/components/campaigns/stories-strip';
import { SaveCampaignPanel } from '@/components/dashboard/save-campaign-panel';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site-config';
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

  const relatedStories = allStories.filter((story) => story.campaignSlug === campaign.slug);
  const relatedCampaigns = siblings.filter((item) => item.slug !== campaign.slug).slice(0, 3);

  return (
    <>
      <CampaignHero campaign={campaign} />

      <PageShell className="py-8 md:py-10">
        {/*
          TABS SWITCH THE TOP BLOCK ONLY.

          Everything below them — the stories, the description, the donors, the
          focus areas — stays on the page whichever tab is open. They are what
          somebody reads while deciding, and hiding them behind a tab nobody
          clicks is how a page ends up with one section anyone ever sees.

          Products is the default because this campaign is asking for specific
          things, and the ask should be the first thing under the title.
        */}
        <Tabs defaultValue={campaign.products.length > 0 ? 'products' : 'story'}>
          <TabsList className="border-border -mt-8 mb-8 w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
            {campaign.products.length > 0 ? (
              <CampaignTab value="products">Products</CampaignTab>
            ) : null}
            <CampaignTab value="story">Story</CampaignTab>
            <CampaignTab value="impact">Impact</CampaignTab>
            {campaign.faqs.length > 0 ? <CampaignTab value="faqs">FAQs</CampaignTab> : null}
          </TabsList>

          {/*
            NO `id` ON THE PANEL BELOW.

            It carried `id="give"` as a scroll anchor, which overwrote the id
            Radix generates — and Radix had already written that id into the
            tab's `aria-controls`. The result was a critical
            `aria-valid-attr-value` failure: the selected tab pointed at an
            element that no longer existed, so assistive tech could not find the
            panel the tab controls. The anchor lives on a wrapper inside.
          */}
          {campaign.products.length > 0 ? (
            <TabsContent value="products">
              <div id="give" className="scroll-mt-24" />
              <DonationBuilder
                campaign={campaign}
                saveSlot={
                  <SaveCampaignPanel
                    campaignId={campaign.id}
                    title={campaign.title}
                    slug={campaign.slug}
                  />
                }
              />
            </TabsContent>
          ) : null}

          <TabsContent value="story">
            <div className="grid gap-10 lg:grid-cols-3">
              <div className="prose-measure space-y-5 lg:col-span-2">
                {campaign.story.map((paragraph, index) => (
                  <p key={index} className="text-body leading-relaxed">
                    {paragraph}
                  </p>
                ))}

                <div className="border-border bg-surface-sunken rounded-lg border p-5">
                  <h3 className="text-body font-semibold">Who this reaches</h3>
                  <p className="text-body-sm text-muted-foreground mt-2">
                    {campaign.beneficiaryContext}
                  </p>
                </div>

                {campaign.updates.length > 0 ? (
                  <section aria-labelledby="campaign-updates" className="pt-4">
                    <h3 id="campaign-updates" className="text-h3 font-semibold">
                      Progress updates
                    </h3>
                    <ol className="mt-4 space-y-8">
                      {campaign.updates.map((update) => (
                        <li key={update.id} className="border-border border-l-2 pl-5">
                          <time
                            dateTime={update.publishedAt}
                            className="text-caption text-muted-foreground"
                          >
                            {formatDate(update.publishedAt)}
                          </time>
                          <h4 className="text-h4 mt-1 font-semibold">
                            {/*
                              A progress update IS an impact record, and since
                              Phase 9 it has a page carrying the figure and how
                              it was counted. Linking here is what turns "we
                              reached 1,240 children" from a claim on a campaign
                              page into something a reader can check.

                              Guarded on the slug: this list also renders from
                              the fixture fallback, which has none.
                            */}
                            {update.slug ? (
                              <Link
                                href={`/impact/${update.slug}`}
                                className="focus-visible:outline-ring rounded-sm hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                              >
                                {update.title}
                              </Link>
                            ) : (
                              update.title
                            )}
                          </h4>
                          <p className="text-body text-muted-foreground mt-2 leading-relaxed">
                            {update.body}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {/*
                  ══════════════════════════════════════════════════════════
                  THE ONLY PLACE A DOCUMENT REACHES A VISITOR.

                  §4.20: "No public document library … the only documents a
                  visitor sees are ones explicitly attached to a campaign and
                  marked public." The API has already filtered on
                  `visibility = 'public' AND published_at IS NOT NULL` in the
                  WHERE clause, so a private document is not merely hidden
                  here — it was never fetched, and `fileUrl` comes back null
                  for anything that is not public even if it were.

                  The link is the public bucket's own URL. Nothing is signed,
                  because nothing here is private; and the size is printed so
                  somebody on a metered connection knows what they are about
                  to pull down.
                  ══════════════════════════════════════════════════════════
                */}
                {campaign.documents.length > 0 ? (
                  <section aria-labelledby="campaign-documents" className="pt-4">
                    <h3 id="campaign-documents" className="text-h3 font-semibold">
                      Documents
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {campaign.documents
                        .filter((document) => document.fileUrl)
                        .map((document) => (
                          <li key={document.id}>
                            <a
                              href={document.fileUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border-border hover:bg-muted/50 focus-visible:outline-ring flex items-start gap-3 rounded-lg border p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                              <FileText
                                className="text-muted-foreground mt-0.5 size-5 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="min-w-0">
                                <span className="text-body block font-semibold">
                                  {document.title}
                                </span>
                                {document.description ? (
                                  <span className="text-body-sm text-muted-foreground mt-0.5 block">
                                    {document.description}
                                  </span>
                                ) : null}
                                <span className="text-caption text-muted-foreground mt-1 block">
                                  {/* Announced as part of the link text, so a
                                      screen reader reaches "opens in a new tab"
                                      before the tab opens. */}
                                  {(document.sizeBytes / (1024 * 1024)).toFixed(1)} MB · opens in a
                                  new tab
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                    </ul>
                  </section>
                ) : null}
              </div>

              {campaign.gallery.length > 0 ? (
                <div className="space-y-4">
                  {campaign.gallery.map((media) => (
                    <MediaFigure key={media.seed} media={media} aspect="photo" />
                  ))}
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="impact">
            {campaign.impactNotes.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                  {campaign.impactNotes.map((note) => (
                    <div key={note.label}>
                      <p data-numeric="" className="font-display text-h1 font-semibold">
                        {formatNumber(note.value)}
                        {note.unit ? (
                          <span className="text-body-lg text-muted-foreground ml-1 font-normal">
                            {note.unit}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-body-sm text-muted-foreground">{note.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-body-sm text-muted-foreground mt-6 max-w-prose">
                  These figures come from program records maintained by the field team. Read{' '}
                  <Link
                    href="/impact"
                    className="text-primary focus-visible:outline-ring rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    how we measure impact
                  </Link>
                  , including what we do not count.
                </p>
              </>
            ) : (
              <p className="text-body text-muted-foreground">
                This campaign has not yet reported measurable outcomes. Updates are published as the
                work progresses.
              </p>
            )}
          </TabsContent>

          {campaign.faqs.length > 0 ? (
            <TabsContent value="faqs">
              <Accordion type="single" collapsible className="prose-measure">
                {campaign.faqs.map((faq, index) => (
                  <AccordionItem key={faq.question} value={`faq-${index}`}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>
          ) : null}
        </Tabs>

        {/*
          Stories from this campaign first, TOPPED UP to three from the wider
          set. A campaign with one story of its own would otherwise show a strip
          built for three with a single card marooned on the left.
        */}
        <StoriesStrip
          stories={[
            ...relatedStories,
            ...allStories.filter((story) => !relatedStories.includes(story)),
          ].slice(0, 3)}
        />

        {/* About ----------------------------------------------------------- */}
        <section aria-labelledby="about-heading" className="mt-14">
          <h2 id="about-heading" className="text-h1 font-bold">
            About This Campaign
          </h2>

          <div className="mt-3 space-y-3">
            {campaign.story.slice(0, 2).map((paragraph, index) => (
              <p key={index} className="text-body-sm text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/*
            A pull quote, attributed to the organisation rather than to a named
            person. Putting a real person's name on a sentence nobody recorded
            them saying is the kind of invention decision A14 exists to stop.
          */}
          <blockquote className="bg-wash-mint/40 border-success mt-5 flex gap-4 rounded-lg border-l-4 p-5">
            <Quote
              className="text-success size-7 shrink-0 -scale-x-100 opacity-70"
              aria-hidden="true"
            />
            <div>
              <p className="text-body font-medium leading-relaxed">
                “We may not be able to stop natural disasters, but together we can ensure no family
                faces them alone.”
              </p>
              <footer className="text-body-sm text-muted-foreground mt-2">
                — {siteConfig.name}
              </footer>
            </div>
          </blockquote>
        </section>

        <RecentDonors donors={donors} />

        <FocusAreasStrip />
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

/**
 * One tab in the campaign's own tab bar.
 *
 * The design-system `TabsTrigger` is a filled pill; the approved design here is
 * an underlined row, so the trigger is restyled rather than a second tabs
 * component being introduced. Keeping the primitive means the roving focus, the
 * arrow-key navigation and the `aria-selected` wiring all still come for free.
 */
function CampaignTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'text-body-sm data-[state=active]:text-success relative min-h-11 rounded-none border-0 bg-transparent px-1 pb-3 font-semibold shadow-none',
        'text-muted-foreground hover:text-foreground',
        // The underline is a pseudo-element on the trigger, so it tracks the
        // selected tab without a second element to keep in sync.
        'after:bg-success after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:opacity-0 data-[state=active]:after:opacity-100',
      )}
    >
      {children}
    </TabsTrigger>
  );
}
