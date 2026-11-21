import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Droplets,
  GraduationCap,
  HeartPulse,
  MapPin,
  Sparkles,
  Sprout,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Button, cn, formatCurrency, formatNumber } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { MediaFigure, MediaFrame } from '@/components/media/media-frame';
import { BlueLeaves } from '@/components/programs/decor';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { storyDateLong } from '@/components/stories/featured-story';
import { StoryCard } from '@/components/stories/story-card';
import { getCampaign, getStories, getStory } from '@/lib/content';
import type { Campaign, Story } from '@/lib/mock/types';
import { buildMetadata } from '@/lib/seo/metadata';
import { blogPostingSchema, jsonLd } from '@/lib/seo/structured-data';
import { siteConfig } from '@/lib/site-config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const story = await getStory((await params).slug);
  if (!story) return buildMetadata({ title: 'Story not found', path: '/stories', noIndex: true });
  return buildMetadata({
    title: story.title,
    description: story.summary,
    path: `/stories/${story.slug}`,
    type: 'article',
    publishedAt: story.publishedAt,
  });
}

/**
 * The four chapters of the story's five-part structure, matched exactly to the
 * approved design (2026-10-16): a disc with an icon beside each heading,
 * joined by a timeline line. Chapter icons adapt contextually to the cause.
 */
function getChapterConfig(category?: string | null): {
  key: 'challenge' | 'intervention' | 'journey' | 'outcome';
  heading: string;
  icon: LucideIcon;
  iconTone: string;
  discTone: string;
}[] {
  const cat = (category ?? '').toLowerCase();

  let challengeIcon: LucideIcon = HeartPulse;
  let interventionIcon: LucideIcon = Stethoscope;

  if (cat.includes('education')) {
    challengeIcon = BookOpen;
    interventionIcon = GraduationCap;
  } else if (cat.includes('women') || cat.includes('livelihood')) {
    challengeIcon = Target;
    interventionIcon = Sparkles;
  } else if (cat.includes('environment')) {
    challengeIcon = Droplets;
    interventionIcon = Sprout;
  }

  return [
    {
      key: 'challenge',
      heading: 'The challenge',
      icon: challengeIcon,
      iconTone: 'text-primary',
      discTone: 'bg-muted',
    },
    {
      key: 'intervention',
      heading: 'What we did',
      icon: interventionIcon,
      iconTone: 'text-info',
      discTone: 'bg-info-subtle',
    },
    {
      key: 'journey',
      heading: 'The journey',
      icon: Users,
      iconTone: 'text-primary',
      discTone: 'bg-muted',
    },
    {
      key: 'outcome',
      heading: 'The outcome',
      icon: TrendingUp,
      iconTone: 'text-info',
      discTone: 'bg-info-subtle',
    },
  ];
}

/** Estimate reading minutes: matches the design's reading time. */
function readingMinutes(story: Story): number {
  const words = [
    story.summary,
    story.challenge,
    story.intervention,
    story.journey,
    story.outcome,
    story.impact,
  ]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(5, Math.round(words / 50));
}

export default async function StoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const story = await getStory((await params).slug);
  if (!story) notFound();

  const relatedCampaign = story.campaignSlug ? await getCampaign(story.campaignSlug) : null;
  const moreStories = (await getStories()).filter((item) => item.slug !== story.slug).slice(0, 3);

  const eyebrow = story.category ?? story.programName;
  const chapters = getChapterConfig(eyebrow).filter(
    (chapter) => story[chapter.key]?.trim().length > 0,
  );
  const minutes = readingMinutes(story);

  const schema = blogPostingSchema({
    type: 'Article',
    pathPrefix: '/stories',
    title: story.title,
    slug: story.slug,
    description: story.summary || null,
    imageUrl: story.cover.url ?? null,
    authorName: null,
    publishedAt: story.publishedAt,
    updatedAt: null,
  });

  return (
    <>
      {schema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
      ) : null}

      <article>
        {/* Soft background shape behind header */}
        <div className="relative overflow-x-clip">
          <span
            aria-hidden="true"
            className="bg-muted/40 pointer-events-none absolute -right-24 top-10 size-80 rounded-full blur-3xl lg:-right-16 lg:top-12 lg:size-[26rem]"
          />

          <PageShell className="relative pt-6">
            <Breadcrumbs
              className="mb-0 text-xs sm:text-[0.8125rem]"
              entries={[
                { name: 'Home', path: '/' },
                { name: 'Stories', path: '/stories' },
                { name: story.title, path: `/stories/${story.slug}` },
              ]}
            />

            <header className="mt-6 lg:mt-7">
              {eyebrow ? (
                story.programSlug ? (
                  <Link
                    href={`/programs/${story.programSlug}`}
                    className="text-primary border-border bg-muted hover:border-primary/40 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {eyebrow}
                  </Link>
                ) : (
                  <span className="text-primary border-border bg-muted inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em]">
                    {eyebrow}
                  </span>
                )
              ) : null}

              <h1
                className={cn(
                  'font-display font-semibold',
                  'text-foreground mt-3.5 max-w-[42rem] text-3xl leading-[1.12] tracking-[-0.02em] sm:text-4xl lg:text-[3.25rem]',
                )}
              >
                {story.title}
              </h1>

              {story.summary ? (
                <p className="dark:text-muted-foreground text-muted-foreground mt-3.5 max-w-[38rem] text-lg leading-relaxed sm:text-xl">
                  {story.summary}
                </p>
              ) : null}

              <p className="dark:text-muted-foreground text-muted-foreground mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
                {story.location ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin
                        className="text-muted-foreground size-4 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {story.location}
                    </span>
                    <span aria-hidden="true" className="dark:text-border text-muted-foreground">
                      ·
                    </span>
                  </>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays
                    className="text-muted-foreground size-4 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <time dateTime={story.publishedAt}>{storyDateLong(story.publishedAt)}</time>
                </span>
                {minutes > 0 ? (
                  <>
                    <span aria-hidden="true" className="dark:text-border text-muted-foreground">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock
                        className="text-muted-foreground size-4 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {minutes} min read
                    </span>
                  </>
                ) : null}
              </p>
            </header>

            {/* Hero photograph */}
            <div className="relative mt-7 lg:mt-8">
              <div className="relative aspect-[16/8] w-full overflow-hidden rounded-2xl sm:aspect-[2.15/1] lg:aspect-[2.2/1]">
                <MediaFrame
                  media={story.cover}
                  priority
                  rounded={false}
                  focus="center 25%"
                  className="absolute inset-0 aspect-auto size-full object-cover"
                  sizes="(max-width: 1440px) 100vw, 1360px"
                />
              </div>
            </div>
          </PageShell>
        </div>

        {/* Two-column layout: Timeline chapters + Sidebar */}
        <PageShell className="pb-16 pt-12 lg:pb-20 lg:pt-14">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:gap-x-16">
            <div className="min-w-0">
              {chapters.length > 0 ? (
                <ol className="space-y-12">
                  {chapters.map((chapter, index) => {
                    const Icon = chapter.icon;
                    const last = index === chapters.length - 1;
                    return (
                      <li
                        key={chapter.key}
                        className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 sm:grid-cols-[4.25rem_minmax(0,1fr)] sm:gap-x-7"
                      >
                        {!last ? (
                          <span
                            aria-hidden="true"
                            className="dark:border-border border-border-strong absolute bottom-[-3rem] left-6 top-14 w-px border-l border-dashed sm:left-[2.125rem] sm:top-16"
                          />
                        ) : null}
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-12 shrink-0 place-items-center rounded-full sm:size-[4.25rem]',
                            chapter.discTone,
                            chapter.iconTone,
                          )}
                        >
                          <Icon className="size-6 sm:size-7" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 pt-1 sm:pt-2">
                          <h2 className="font-display dark:text-foreground text-foreground text-xl font-bold leading-tight tracking-tight sm:text-2xl">
                            {chapter.heading}
                          </h2>
                          <p className="dark:text-muted-foreground text-muted-foreground mt-3 text-base font-normal leading-[1.75] sm:text-[1.0625rem]">
                            {story[chapter.key]}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {story.gallery.length > 0 ? (
                <div className="mt-12 grid gap-4 sm:grid-cols-2">
                  {story.gallery.map((media) => (
                    <MediaFigure key={media.seed} media={media} aspect="photo" />
                  ))}
                </div>
              ) : null}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              {relatedCampaign ? (
                <RelatedCampaign campaign={relatedCampaign} />
              ) : (
                <section
                  aria-labelledby="support-program"
                  className="dark:border-border dark:bg-surface-warm border-border bg-muted rounded-2xl border p-6 sm:p-7"
                >
                  <h2
                    id="support-program"
                    className="font-display dark:text-foreground text-foreground text-2xl font-bold"
                  >
                    Support this program
                  </h2>
                  <p className="dark:text-muted-foreground text-muted-foreground mt-3 text-[0.9375rem] leading-relaxed">
                    Fund a specific item, or give any amount.
                  </p>
                  <Button
                    asChild
                    fullWidth
                    size="lg"
                    variant="action"
                    className="mt-5 rounded-full"
                  >
                    <Link href="/donate">
                      Donate
                      <ArrowRight aria-hidden="true" className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </section>
              )}

              {/* What it means: Highlighted organisation quote card */}
              {story.impact.trim() ? (
                <figure className="shadow-xs dark:border-border dark:bg-wash-blue/15 border-info/30 bg-info-subtle relative overflow-hidden rounded-2xl border p-6 sm:p-7">
                  <div className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="text-info shrink-0 select-none font-serif text-3xl font-bold leading-none sm:text-4xl"
                    >
                      “
                    </span>
                    <div className="min-w-0 flex-1">
                      <blockquote className="dark:text-foreground text-foreground text-[0.9375rem] font-medium italic leading-relaxed">
                        “{story.impact}”
                      </blockquote>
                      <figcaption className="dark:text-muted-foreground text-muted-foreground mt-3 text-xs font-medium">
                        — {siteConfig.name}
                      </figcaption>
                    </div>
                  </div>
                  <BlueLeaves className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-auto opacity-75" />
                </figure>
              ) : null}
            </aside>
          </div>
        </PageShell>
      </article>

      {/* More stories section */}
      {moreStories.length > 0 ? (
        <section
          aria-labelledby="more-stories"
          className="dark:bg-surface-sunken bg-info-subtle py-14 lg:py-16"
        >
          <PageShell>
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div>
                <h2
                  id="more-stories"
                  className="font-display dark:text-foreground text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  More stories
                </h2>
                <p className="dark:text-muted-foreground text-muted-foreground mt-1 text-sm sm:text-base">
                  Discover more stories of change, resilience and hope from the communities we work
                  with.
                </p>
              </div>
              <Link
                href="/stories"
                className="text-primary mt-2 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 sm:mt-3"
              >
                View all stories
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {moreStories.map((item) => (
                <StoryCard key={item.slug} story={item} variant="compact" />
              ))}
            </div>
          </PageShell>
        </section>
      ) : null}
    </>
  );
}

/**
 * The campaign's own recorded figures — the same ones its card shows — and
 * nothing in their place: a donor count only from five donors (the card's
 * privacy floor), a goal only when one is set.
 */
function campaignFigures(campaign: Campaign): { value: string; label: string }[] {
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  return [
    { value: formatCurrency(raised), label: 'Raised' },
    ...(goal > 0 ? [{ value: formatCurrency(goal), label: 'Goal' }] : []),
    ...(campaign.donorCount >= 5
      ? [{ value: formatNumber(campaign.donorCount), label: 'Donors' }]
      : []),
  ];
}

/**
 * The campaign this story came from: title, photograph, what it does, and
 * its recorded figures.
 */
function RelatedCampaign({ campaign }: { campaign: Campaign }) {
  const href = `/campaigns/${campaign.slug}`;
  const figures = campaignFigures(campaign);

  return (
    <section
      aria-labelledby="related-campaign"
      className="shadow-xs dark:border-border dark:bg-surface-warm border-border bg-muted rounded-2xl border p-6 sm:p-7"
    >
      <p className="dark:text-muted-foreground text-muted-foreground text-xs font-bold uppercase tracking-wider">
        RELATED CAMPAIGN
      </p>
      <h2
        id="related-campaign"
        className="font-display dark:text-foreground text-foreground mt-2 text-xl font-bold leading-snug tracking-tight"
      >
        <Link
          href={href}
          className="hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {campaign.title}
        </Link>
      </h2>

      <div className="relative mt-4 aspect-[16/10] overflow-hidden rounded-xl">
        <MediaFrame
          media={campaign.cover}
          rounded={false}
          className="aspect-auto size-full object-cover"
          sizes="(max-width: 1024px) 100vw, 24rem"
        />
      </div>

      {campaign.shortDescription ? (
        <p className="dark:text-muted-foreground text-muted-foreground mt-4 text-sm leading-relaxed">
          {campaign.shortDescription}
        </p>
      ) : null}

      <Button
        asChild
        fullWidth
        size="lg"
        variant="action"
        className="shadow-xs mt-5 rounded-full py-3 text-sm font-semibold transition-colors"
      >
        <Link href={`${href}#give`} className="inline-flex items-center justify-center gap-1.5">
          Support this work
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>

      {/* The campaign's recorded figures, under the design's divider */}
      <div className="dark:border-border/70 border-border mt-6 border-t pt-5">
        <div className="relative -mt-7 mb-2 flex items-center justify-between">
          <div className="dark:bg-border/60 bg-muted h-px flex-1" />
          <span className="dark:bg-surface-warm bg-muted text-muted-foreground px-2">
            <Users
              className="text-muted-foreground size-3.5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </span>
          <div className="dark:bg-border/60 bg-muted h-px flex-1" />
          <span className="dark:bg-surface-warm bg-muted text-muted-foreground px-2">
            <MapPin
              className="text-muted-foreground size-3.5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </span>
          <div className="dark:bg-border/60 bg-muted h-px flex-1" />
          <span className="dark:bg-surface-warm bg-muted text-muted-foreground px-2">
            <CheckCircle2
              className="text-muted-foreground size-3.5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </span>
          <div className="dark:bg-border/60 bg-muted h-px flex-1" />
        </div>
        <dl
          className={cn(
            'grid gap-2 text-center',
            figures.length === 3
              ? 'grid-cols-3'
              : figures.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-1',
          )}
        >
          {figures.map((figure) => (
            <div key={figure.label} className="flex min-w-0 flex-col-reverse">
              <dt className="dark:text-muted-foreground text-muted-foreground mt-0.5 text-[0.6875rem] font-medium">
                {figure.label}
              </dt>
              <dd
                data-numeric=""
                className="font-display dark:text-foreground text-foreground text-base font-bold leading-tight sm:text-lg"
              >
                {figure.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
