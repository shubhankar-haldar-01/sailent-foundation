import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { Button, Card, formatDate } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFrame, MediaFigure } from '@/components/media/media-frame';
import { StoryCard } from '@/components/stories/story-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { blogPostingSchema, jsonLd } from '@/lib/seo/structured-data';
import { getCampaign, getStories, getStory } from '@/lib/content';

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

/** The five-part structure Phase 0 specifies for success stories. */
const SECTIONS = [
  { key: 'challenge', heading: 'The challenge' },
  { key: 'intervention', heading: 'What we did' },
  { key: 'journey', heading: 'The journey' },
  { key: 'outcome', heading: 'The outcome' },
  { key: 'impact', heading: 'What it means' },
] as const;

export default async function StoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const story = await getStory((await params).slug);
  if (!story) notFound();

  const relatedCampaign = story.campaignSlug ? await getCampaign(story.campaignSlug) : null;
  const moreStories = (await getStories()).filter((item) => item.slug !== story.slug).slice(0, 3);

  /*
    `Article` markup, which `docs/seo-strategy.md` §5 asks for on "blog posts
    AND stories". The blog got it in Phase 10.7; stories never did.

    NO `author`. A success story is written up by the organisation, not
    bylined by a person, and there is no author column behind it — so the field
    is omitted rather than filled with the organisation's name or "Admin". The
    helper drops it when absent, which is the same A14 discipline the blog
    follows: every field here traces to a real value.

    An `Article` rather than a `BlogPosting` — it is a published account of
    somebody's life, not a post in a blog.
  */
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
      <PageShell className="pt-8">
        <Breadcrumbs
          entries={[
            { name: 'Home', path: '/' },
            { name: 'Stories', path: '/stories' },
            { name: story.title, path: `/stories/${story.slug}` },
          ]}
        />
      </PageShell>

      <article>
        <PageShell>
          <header className="prose-measure">
            {story.programName ? (
              <Link
                href={`/programs/${story.programSlug}`}
                className="text-overline tracking-(--text-overline--letter-spacing) text-primary focus-visible:outline-ring rounded-sm uppercase underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {story.programName}
              </Link>
            ) : null}
            <h1 className="text-display mt-3 text-balance font-semibold">{story.title}</h1>
            <p className="text-body-lg text-muted-foreground mt-4">{story.summary}</p>
            <p className="text-caption text-muted-foreground mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {story.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {story.location}
                </span>
              ) : null}
              <span aria-hidden="true">·</span>
              <time dateTime={story.publishedAt}>{formatDate(story.publishedAt)}</time>
            </p>
          </header>

          <MediaFrame media={story.cover} aspect="hero" className="mt-8" priority />
        </PageShell>

        <Section className="pt-12 md:pt-16">
          <PageShell>
            <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
              <div className="prose-measure space-y-10 lg:col-span-2">
                {SECTIONS.map((section) => (
                  <section key={section.key}>
                    <h2 className="text-h2 font-semibold">{section.heading}</h2>
                    <p className="text-body text-muted-foreground mt-3 leading-relaxed">
                      {story[section.key]}
                    </p>
                  </section>
                ))}

                {story.gallery.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {story.gallery.map((media) => (
                      <MediaFigure key={media.seed} media={media} aspect="photo" />
                    ))}
                  </div>
                ) : null}
              </div>

              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                {relatedCampaign ? (
                  <Card className="p-5">
                    <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
                      Related campaign
                    </p>
                    <h2 className="text-h4 mt-2 font-semibold">{relatedCampaign.title}</h2>
                    <p className="text-body-sm text-muted-foreground mt-2">
                      {relatedCampaign.shortDescription}
                    </p>
                    <Button asChild fullWidth className="mt-4">
                      <Link href={`/campaigns/${relatedCampaign.slug}#give`}>
                        Support this work
                      </Link>
                    </Button>
                  </Card>
                ) : (
                  <Card className="p-5">
                    <h2 className="text-h4 font-semibold">Support this program</h2>
                    <p className="text-body-sm text-muted-foreground mt-2">
                      Fund a specific item, or give any amount.
                    </p>
                    <Button asChild fullWidth className="mt-4">
                      <Link href="/donate">Donate</Link>
                    </Button>
                  </Card>
                )}

                {/* Consent is a publishing precondition, not a footnote. */}
                {story.subjectName ? (
                  <p className="text-caption text-muted-foreground">
                    Published with the consent of the person described. We do not publish a story
                    naming an identifiable person without it.
                  </p>
                ) : null}
              </aside>
            </div>
          </PageShell>
        </Section>
      </article>

      <Section className="border-border bg-surface-sunken border-t">
        <PageShell>
          <h2 className="text-h1 font-semibold">More stories</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {moreStories.map((item) => (
              <StoryCard key={item.slug} story={item} />
            ))}
          </div>
        </PageShell>
      </Section>
    </>
  );
}
