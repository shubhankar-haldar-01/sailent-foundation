import { FileText, Sparkle } from 'lucide-react';

import { formatCurrency, formatNumber } from '@sailent/ui';

import { CampaignGallery } from '@/components/campaigns/campaign-gallery';
import type { Campaign } from '@/lib/mock/types';

const goalDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/**
 * About this campaign — four short blocks of text and nothing else.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY WORD UNDER A HEADING COMES FROM THE CAMPAIGN'S OWN RECORD.
 *
 * The headings are the approved design's. What sits under them is not written
 * here — this component only decides which existing field answers which
 * question:
 *
 *   Why This Campaign?              the campaign narrative, as written
 *   What Will Your Support Provide? the products and what each one is
 *   Our Goal                        the target, the end date, the people
 *   Your Impact                     who it reaches, and how many so far
 *
 * A block whose field is empty is left out rather than filled with something
 * plausible (decision A14). A page that says less is better than one that says
 * something nobody on the campaign team wrote.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE CAMPAIGN'S PHOTOGRAPHS LEAD IT. When the campaign has a gallery, one
 * photo at a time sits under the heading, with arrows to step through the
 * rest, so the reader sees the work before reading about it.
 */
export function CampaignAbout({ campaign }: { campaign: Campaign }) {
  const blocks: { key: string; heading: string; body: React.ReactNode }[] = [];

  if (campaign.story.length > 0) {
    blocks.push({
      key: 'why',
      heading: 'Why This Campaign?',
      body: campaign.story.map((paragraph, index) => <p key={index}>{paragraph}</p>),
    });
  }

  const products = campaign.products.filter((product) => product.status !== 'inactive');
  if (products.length > 0) {
    blocks.push({
      key: 'provide',
      heading: 'What Will Your Support Provide?',
      body: (
        <ul className="space-y-1.5">
          {products.map((product) => (
            <li key={product.id}>
              <strong className="text-foreground font-semibold">{product.name}</strong>
              {product.description ? <> — {product.description}</> : null}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (campaign.goalAmount > 0) {
    blocks.push({
      key: 'goal',
      heading: 'Our Goal',
      body: (
        <p>
          To raise <Strong>{formatCurrency(campaign.goalAmount)}</Strong>
          {campaign.endsAt ? (
            <>
              {' '}
              by <Strong>{goalDate.format(new Date(campaign.endsAt))}</Strong>
            </>
          ) : null}
          {campaign.beneficiaryTarget ? (
            <>
              {' '}
              and reach <Strong>{formatNumber(campaign.beneficiaryTarget)}</Strong> people in need
            </>
          ) : null}
          .
        </p>
      ),
    });
  }

  const context = campaign.beneficiaryContext.trim();
  if (context || campaign.beneficiariesReached > 0) {
    blocks.push({
      key: 'impact',
      heading: 'Your Impact',
      body: (
        <>
          {context ? <p>{context}</p> : null}
          {campaign.beneficiariesReached > 0 ? (
            <p>
              <Strong>{formatNumber(campaign.beneficiariesReached)}</Strong> people have been
              reached so far.
            </p>
          ) : null}
        </>
      ),
    });
  }

  const documents = campaign.documents.filter((document) => document.fileUrl);

  if (!hasAboutContent(campaign)) return null;

  return (
    <section id="campaign-about" aria-labelledby="about-heading" className="mt-12 scroll-mt-24">
      <h2 id="about-heading" className="text-h2 font-bold">
        About This Campaign
      </h2>

      <CampaignGallery images={campaign.gallery} title={campaign.title} />

      {/*
        ══════════════════════════════════════════════════════════════════════
        STORY CARDS, ALL ALIKE.

        Each block is the same card: white easing into the page's own soft
        blue at its right edge, a hairline border, centred text and a small
        gold sparkle in the corner — so the four read as one continuous account
        told in parts, rather than four differently coloured notices.

        The text is held to a readable measure inside the full-width card;
        centred lines as wide as the column would be hard to follow back to
        their start. The sparkle is decoration and hidden from assistive tech.
        ══════════════════════════════════════════════════════════════════════
      */}
      <div className="mt-4 space-y-3">
        {blocks.map((block) => (
          <article
            key={block.key}
            aria-labelledby={`about-${block.key}`}
            className="border-border/70 from-surface via-surface to-surface-tint relative overflow-hidden rounded-2xl border bg-gradient-to-r px-6 pb-6 pt-8 text-center shadow-sm sm:px-10 sm:pt-6"
          >
            <Sparkle
              aria-hidden="true"
              className="text-wash-gold-ink/60 absolute right-4 top-4 size-4 fill-current"
            />
            <div className="mx-auto max-w-3xl">
              <h3 id={`about-${block.key}`} className="text-body-lg font-bold">
                {block.heading}
              </h3>
              <div className="text-body text-foreground mt-1.5 space-y-1 leading-relaxed">
                {block.body}
              </div>
            </div>
          </article>
        ))}
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

/** The few figures worth stopping on — never whole sentences. */
function Strong({ children }: { children: React.ReactNode }) {
  return (
    <strong data-numeric="" className="text-foreground font-semibold">
      {children}
    </strong>
  );
}
