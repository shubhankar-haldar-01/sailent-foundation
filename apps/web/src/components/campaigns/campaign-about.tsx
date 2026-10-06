import {
  CalendarDays,
  ArrowUp,
  FileText,
  HeartHandshake,
  Lightbulb,
  PackageCheck,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn, formatCurrency, formatNumber } from '@sailent/ui';

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
 *   Your Impact                     how many reached so far, and who
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
 *     which are already listed, priced, under "Choose How You Want to Help";
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
  const showGoal = campaign.goalAmount > 0;
  const showImpact = context.length > 0 || reached > 0;

  const documents = campaign.documents.filter((document) => document.fileUrl);

  if (!hasAboutContent(campaign)) return null;

  return (
    <section id="campaign-about" aria-labelledby="about-heading" className="mt-12 scroll-mt-32">
      <SectionHeading id="about-heading" size="md" title="About This Campaign" />

      <CampaignGallery images={campaign.gallery} title={campaign.title} />

      <div className="@container mt-4">
        <div className="@2xl:grid-cols-2 grid gap-3">
          {/* Why — the narrative, full width ---------------------------------- */}
          {campaign.story.length > 0 ? (
            <AboutCard
              id="about-why"
              icon={Lightbulb}
              tone="bg-wash-blue text-wash-blue-ink"
              title="Why This Campaign?"
              className="@2xl:col-span-2"
            >
              {/* Held to a reading measure: lines across the full card are hard to
                  follow back to their start. */}
              <div className="max-w-[68ch] space-y-2.5">
                {campaign.story.map((paragraph, index) => (
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

          {/* What support provides — a checklist with prices -------------------- */}
          {products.length > 0 ? (
            <AboutCard
              id="about-provide"
              icon={PackageCheck}
              tone="bg-wash-mint text-wash-mint-ink-strong"
              title="What Will Your Support Provide?"
              className="@2xl:col-span-2"
            >
              {/*
                A SUMMARY, NOT THE LIST AGAIN. Every item, its price and what it
                is are on the cards under "Choose How You Want to Help"; this
                says what giving them means and points back up to them.
              */}
              <p className="text-body text-muted-foreground-strong max-w-[68ch] leading-relaxed">
                Your support pays for{' '}
                {products.length === 1 ? 'the item' : `the ${formatNumber(products.length)} items`}{' '}
                listed above, at the prices shown, delivered to the people this campaign serves.
                Choose items, give an amount of your own, or both — an amount you choose is used
                where it is needed most.
              </p>
              <a
                href="#give"
                className="text-body-sm text-primary focus-visible:outline-ring mt-3 inline-flex items-center gap-1.5 rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
                See the items and their prices
              </a>
            </AboutCard>
          ) : null}

          {/* Our goal — the target, large ----------------------------------------- */}
          {showGoal ? (
            <AboutCard
              id="about-goal"
              icon={Target}
              tone="bg-wash-amber text-wash-amber-ink"
              title="Our Goal"
              className={showImpact ? null : '@2xl:col-span-2'}
            >
              <p className="text-muted-foreground text-body-sm">To raise</p>
              <p
                data-numeric=""
                className="text-h2 text-foreground font-extrabold tabular-nums leading-tight tracking-tight"
              >
                {formatCurrency(campaign.goalAmount)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {campaign.endsAt ? (
                  <Chip icon={CalendarDays}>by {goalDate.format(new Date(campaign.endsAt))}</Chip>
                ) : null}
                {target ? <Chip icon={Users}>{formatNumber(target)} people in need</Chip> : null}
              </div>
            </AboutCard>
          ) : null}

          {/* Your impact — reached so far ----------------------------------------- */}
          {showImpact ? (
            <AboutCard
              id="about-impact"
              icon={HeartHandshake}
              tone="bg-wash-violet text-wash-violet-ink"
              title="Your Impact"
              className={showGoal ? null : '@2xl:col-span-2'}
            >
              {reached > 0 ? (
                <>
                  <p className="text-muted-foreground text-body-sm">Reached so far</p>
                  <p className="leading-tight">
                    <span
                      data-numeric=""
                      className="text-h2 text-wash-violet-ink font-extrabold tabular-nums tracking-tight"
                    >
                      {formatNumber(reached)}
                    </span>{' '}
                    <span className="text-body text-foreground font-semibold">people</span>
                  </p>
                  {reachedPercent !== null && target ? (
                    <>
                      <div
                        role="img"
                        aria-label={`${formatNumber(reached)} of ${formatNumber(target)} people reached`}
                        className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-wash-violet-ink block h-full rounded-full"
                          style={{ width: `${Math.max(reachedPercent, 2)}%` }}
                        />
                      </div>
                      <p
                        data-numeric=""
                        aria-hidden="true"
                        className="text-caption text-muted-foreground mt-1.5"
                      >
                        {reachedPercent}% of {formatNumber(target)} people
                      </p>
                    </>
                  ) : null}
                </>
              ) : null}
              {context ? (
                <p
                  className={cn(
                    'text-body text-muted-foreground-strong leading-relaxed',
                    reached > 0 ? 'mt-3' : null,
                  )}
                >
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
          <h3 id="campaign-documents" className="text-h4 font-bold">
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
    campaign.story.length > 0 ||
    campaign.products.some((product) => product.status !== 'inactive') ||
    campaign.goalAmount > 0 ||
    campaign.beneficiaryContext.trim().length > 0 ||
    campaign.beneficiariesReached > 0 ||
    campaign.documents.some((document) => document.fileUrl) ||
    campaign.gallery.length > 0
  );
}

/**
 * One About card: an icon on a tinted tile beside an extra-bold heading, then
 * whatever the card holds. White easing into the page's soft blue, a hairline
 * border and the light shadow every card on the page shares.
 */
function AboutCard({
  id,
  icon: Icon,
  tone,
  title,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  className?: string | null;
  children: React.ReactNode;
}) {
  return (
    <article
      aria-labelledby={id}
      className={cn(
        'border-border/70 from-surface via-surface to-surface-tint rounded-2xl border bg-gradient-to-br p-5 shadow-sm sm:p-6',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone)}
        >
          <Icon className="size-5" />
        </span>
        <h3 id={id} className="text-h4 font-extrabold leading-tight tracking-tight">
          {title}
        </h3>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

/** A small fact beside a figure: an icon and a few words, on a pale chip. */
function Chip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="border-border/70 bg-surface text-body-sm text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold">
      <Icon className="text-muted-foreground size-4" aria-hidden="true" />
      <span data-numeric="">{children}</span>
    </span>
  );
}
