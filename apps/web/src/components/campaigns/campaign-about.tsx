import { CalendarDays, ArrowUp, FileText, Users } from 'lucide-react';

import { cn, formatCurrency, formatNumber } from '@sailent/ui';

import { cleanStory, cleanSupportProvides } from '@/components/campaigns/campaign-copy';
import { CampaignGallery } from '@/components/campaigns/campaign-gallery';
import { SectionHeading } from '@/components/sections/section-heading';
import type { Campaign } from '@/lib/mock/types';

const goalDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/**
 * About this campaign — the photographs, then four cards that each answer one
 * question.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY WORD UNDER A HEADING COMES FROM THE CAMPAIGN'S OWN RECORD.
 *
 * The headings are the approved design's. What sits under them is not written
 * here — this component only decides which existing field answers which
 * question:
 *
 *   Why This Campaign?              the campaign narrative, as written
 *   What Will Your Support Provide? a short summary of the products above
 *   Our Goal                        the target, the end date, the people
 *   Your impact                     how many reached so far, and who
 *
 * A card whose field is empty is left out rather than filled with something
 * plausible (decision A14). A page that says less is better than one that says
 * something nobody on the campaign team wrote.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * EACH CARD IS SHAPED BY WHAT IT HOLDS, in the page's own language — an icon
 * on a tinted tile, an extra-bold heading, left-aligned text:
 *
 *   - the narrative is a full-width story card, its first paragraph a lead;
 *   - what support provides is a short summary pointing back to the items,
 *     which are already listed, priced, under "Choose how you want to help";
 *   - the goal and the impact are figure cards side by side, the number large,
 *     the facts around it as small chips or a progress bar.
 *
 * THE CAMPAIGN'S PHOTOGRAPHS LEAD IT. When the campaign has a gallery, one
 * photo at a time sits under the heading, with arrows to step through the
 * rest, so the reader sees the work before reading about it.
 */
export function CampaignAbout({ campaign }: { campaign: Campaign }) {
  const products = campaign.products.filter((product) => product.status !== 'inactive');
  const context = campaign.beneficiaryContext.trim();
  const reached = campaign.beneficiariesReached;
  const target = campaign.beneficiaryTarget;
  const reachedPercent =
    target && target > 0 ? Math.min(100, Math.round((reached / target) * 100)) : null;
  const story = cleanStory(campaign.story);
  const supportProvides = cleanSupportProvides(campaign.supportProvides, story);
  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  const raisedPercent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null;
  const showGoal = goal > 0 || reached > 0 || context.length > 0;

  const documents = campaign.documents.filter((document) => document.fileUrl);

  if (!hasAboutContent(campaign)) return null;

  return (
    <section id="campaign-about" aria-labelledby="about-heading" className="mt-12 scroll-mt-32">
      <SectionHeading id="about-heading" size="md" title="About this campaign" />

      <CampaignGallery
        images={campaign.gallery}
        title={campaign.title}
        videoUrl={campaign.videoUrl}
      />

      <div className="@container mt-4">
        <div className="@2xl:grid-cols-2 grid gap-3">
          {/* Why — the narrative, full width ---------------------------------- */}
          {story.length > 0 ? (
            <AboutCard id="about-why" title="Why this campaign?" className="@2xl:col-span-2">
              {/* Held to a reading measure: lines across the full card are hard to
                  follow back to their start. */}
              <div className="max-w-[68ch] space-y-2.5">
                {story.map((paragraph, index) => (
                  <p
                    key={index}
                    className={
                      index === 0
                        ? 'text-body-lg text-foreground font-medium leading-relaxed'
                        : 'text-body text-muted-foreground-strong leading-relaxed'
                    }
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </AboutCard>
          ) : null}

          {/* What support provides — custom narrative or product summary -------- */}
          {supportProvides || products.length > 0 ? (
            <AboutCard
              id="about-provide"
              title="What will your support provide?"
              className="@2xl:col-span-2"
            >
              {/*
                A SUMMARY, NOT THE LIST AGAIN. If the campaign team entered a
                specific explanation of what support provides, show it; otherwise
                summarize the products attached above.
              */}
              <p className="text-body text-muted-foreground-strong max-w-[68ch] leading-relaxed">
                {supportProvides
                  ? supportProvides
                  : `Your support pays for ${products.length === 1 ? 'the item' : `the ${formatNumber(products.length)} items`} listed above, at the prices shown, delivered to the people this campaign serves. Choose items, give an amount of your own, or both — an amount you choose is used where it is needed most.`}
              </p>
              {products.length > 0 ? (
                <a
                  href="#give"
                  className="text-body-sm text-primary focus-visible:outline-ring mt-3 inline-flex items-center gap-1.5 rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                  See the items and their prices
                </a>
              ) : null}
            </AboutCard>
          ) : null}

          {/* Our goal — one stat block: the figures, the bar, the impact ---- */}
          {showGoal ? (
            <AboutCard id="about-goal" title="Our goal" className="@2xl:col-span-2">
              <dl className="@lg:grid-cols-4 grid grid-cols-2 gap-x-4 gap-y-3">
                {goal > 0 ? <Stat label="Goal" value={formatCurrency(goal)} /> : null}
                {goal > 0 ? <Stat label="Raised" value={formatCurrency(raised)} /> : null}
                {campaign.donorCount > 0 ? (
                  <Stat label="Donors" value={formatNumber(campaign.donorCount)} />
                ) : null}
                {reached > 0 ? (
                  <Stat
                    label={target ? `People helped of ${formatNumber(target)}` : 'People helped'}
                    value={formatNumber(reached)}
                  />
                ) : null}
              </dl>
              {raisedPercent !== null ? (
                <>
                  <div
                    role="img"
                    aria-label={`${raisedPercent}% of the ${formatCurrency(goal)} goal raised`}
                    className="bg-muted mt-4 h-2 overflow-hidden rounded-full"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${Math.max(raisedPercent, raised > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <p
                    data-numeric=""
                    className="text-caption text-muted-foreground mt-1.5 flex flex-wrap justify-between gap-x-3"
                  >
                    <span>{raisedPercent}% raised</span>
                    {campaign.endsAt ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        by {goalDate.format(new Date(campaign.endsAt))}
                      </span>
                    ) : null}
                  </p>
                </>
              ) : null}
              {reachedPercent === null && target && reached === 0 ? (
                <p className="text-body-sm text-muted-foreground mt-3 inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden="true" />
                  {formatNumber(target)} people in need
                </p>
              ) : null}
              {context ? (
                <p className="text-body text-muted-foreground-strong mt-4 max-w-[68ch] leading-relaxed">
                  {context}
                </p>
              ) : null}
            </AboutCard>
          ) : null}
        </div>
      </div>

      {/*
        ══════════════════════════════════════════════════════════════════════
        THE ONLY PLACE A DOCUMENT REACHES A VISITOR.

        §4.20: "No public document library … the only documents a visitor sees
        are ones explicitly attached to a campaign and marked public." The API
        has already filtered on `visibility = 'public' AND published_at IS NOT
        NULL` in the WHERE clause, so a private document is not merely hidden
        here — it was never fetched, and `fileUrl` comes back null for anything
        that is not public even if it were.

        The size is printed so somebody on a metered connection knows what they
        are about to pull down.
        ══════════════════════════════════════════════════════════════════════
      */}
      {documents.length > 0 ? (
        <section aria-labelledby="campaign-documents" className="mt-6">
          <h3 id="campaign-documents" className="text-h4 font-semibold">
            Documents
          </h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {documents.map((document) => (
              <li key={document.id}>
                <a
                  href={document.fileUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border bg-surface hover:bg-muted/50 focus-visible:outline-ring flex h-full items-start gap-3 rounded-xl border p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <FileText
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="text-body-sm block font-semibold">{document.title}</span>
                    {document.description ? (
                      <span className="text-body-sm text-muted-foreground mt-0.5 block">
                        {document.description}
                      </span>
                    ) : null}
                    <span className="text-caption text-muted-foreground mt-1 block">
                      {/* Announced as part of the link text, so a screen reader
                          reaches "opens in a new tab" before the tab opens. */}
                      {(document.sizeBytes / (1024 * 1024)).toFixed(1)} MB · opens in a new tab
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

/**
 * Whether the About section will render anything — the page's section links
 * ask, so "About" is never offered for a section that is not there.
 */
export function hasAboutContent(campaign: Campaign): boolean {
  return (
    cleanStory(campaign.story).length > 0 ||
    Boolean(cleanSupportProvides(campaign.supportProvides, cleanStory(campaign.story))) ||
    Boolean(campaign.videoUrl?.trim()) ||
    campaign.products.some((product) => product.status !== 'inactive') ||
    campaign.goalAmount > 0 ||
    campaign.beneficiaryContext.trim().length > 0 ||
    campaign.beneficiariesReached > 0 ||
    campaign.documents.some((document) => document.fileUrl) ||
    campaign.gallery.length > 0
  );
}

/**
 * One About card: a plain heading, then whatever the card holds, on a
 * bordered, unshadowed surface (cards are border-first and only clickable
 * ones lift; this one is not clickable). The pastel icon tile was retired
 * for clean typography (visual polish Phase 3, 2026-11-21).
 */
function AboutCard({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string | null;
  children: React.ReactNode;
}) {
  return (
    <article aria-labelledby={id} className={cn('card-standard rounded-2xl p-5 sm:p-6', className)}>
      <h3 id={id} className="text-h4 font-semibold leading-tight">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </article>
  );
}

/** One figure in the goal block: the label over its value. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd data-numeric="" className="text-h4 text-foreground mt-0.5 font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
