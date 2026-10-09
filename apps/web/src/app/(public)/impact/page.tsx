import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, formatNumber, EmptyState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { StatBand } from '@/components/impact/stat-band';
import { StoryCard } from '@/components/stories/story-card';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  getHeadlineMetrics,
  getImpact,
  getPrograms,
  getReachMetrics,
  getStories,
  methodologyNotes,
} from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Impact',
  description:
    'What we measure, how we measure it, and what the figures actually show — including where results fell short.',
  path: '/impact',
});

/**
 * Impact page.
 *
 * Phase 0 draws a hard line between /impact and /stories: this page is
 * verifiable numbers and dated updates; stories are human narrative. The
 * methodology section is placed HIGH rather than in a footnote, because it is
 * the most persuasive content here — it is the part no template site has.
 */
export default async function ImpactPage() {
  const [headlineMetrics, reachMetrics, impact, programs, stories] = await Promise.all([
    getHeadlineMetrics(),
    getReachMetrics(),
    getImpact(),
    getPrograms(),
    getStories(),
  ]);

  const { reach, updates } = impact;
  const featuredStories = stories.slice(0, 3);

  return (
    <>
      <PageHero
        eyebrow="Impact"
        title="The numbers, and how we arrived at them"
        lead="Every figure on this page traces to a program record or a database aggregate. Where a result is preliminary, we say so rather than rounding it into a headline."
      />

      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Impact', path: '/impact' },
            ]}
          />
          <StatBand metrics={headlineMetrics} size="lg" />
        </PageShell>
      </Section>

      {/* Methodology first — evidence before assertion. */}
      <Section className="border-border bg-surface-sunken border-y">
        <PageShell>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <h2 className="text-h1 text-balance font-bold">How we count</h2>
              <p className="text-body text-muted-foreground mt-4">
                Most impact pages present a number without saying where it came from. These are the
                rules we apply, including what we deliberately leave out.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
              {methodologyNotes.map((note) => (
                <li key={note.title}>
                  <h3 className="text-body font-semibold">{note.title}</h3>
                  <p className="text-body-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {note.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </PageShell>
      </Section>

      <Section>
        <PageShell>
          <h2 className="text-h1 font-bold">Geographic reach</h2>
          <StatBand metrics={reachMetrics} size="sm" className="mt-8" />

          {/* Focusable so the scroll region is reachable by keyboard. */}
          <div
            className="focus-visible:outline-ring mt-12 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2"
            tabIndex={0}
            role="region"
            aria-label="Programs and people reached by state, scrollable horizontally"
          >
            <table className="text-body-sm w-full min-w-[40rem] border-collapse">
              <caption className="sr-only">
                Programs and people reached, by state and district
              </caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="py-3 pr-4 text-left font-semibold">
                    State
                  </th>
                  <th scope="col" className="py-3 pr-4 text-left font-semibold">
                    Districts
                  </th>
                  <th scope="col" className="py-3 pr-4 text-left font-semibold">
                    Programs
                  </th>
                </tr>
              </thead>
              <tbody>
                {reach.byState.map((region) => (
                  <tr key={region.state} className="border-border border-b">
                    <th scope="row" className="py-3 pr-4 text-left font-medium">
                      {region.state}
                    </th>
                    <td className="text-muted-foreground py-3 pr-4">
                      {region.districts.join(', ')}
                    </td>
                    <td className="text-muted-foreground py-3 pr-4">
                      {region.programmes.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-caption text-muted-foreground mt-3">
            Derived from the recorded locations of every published program. A state appears here
            only while a program is running in it.
          </p>
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-t">
        <PageShell>
          <h2 className="text-h1 font-bold">By program</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <li key={program.slug}>
                <Card className="flex h-full flex-col p-5">
                  <h3 className="text-h4 font-semibold">
                    <Link
                      href={`/programs/${program.slug}`}
                      className="hover:text-primary focus-visible:outline-ring rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {program.name}
                    </Link>
                  </h3>
                  {program.metrics.length > 0 ? (
                    <dl className="mt-4 space-y-2">
                      {program.metrics.map((metric) => (
                        <div
                          key={metric.label}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <dt className="text-body-sm text-muted-foreground">{metric.label}</dt>
                          <dd data-numeric="" className="text-body font-semibold tabular-nums">
                            {formatNumber(metric.value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-body-sm text-muted-foreground mt-4">
                      This program has not yet reported measurable outcomes.
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </PageShell>
      </Section>

      <Section>
        <PageShell>
          <h2 className="text-h1 font-bold">Dated updates from the field</h2>
          {/*
            Rendered rather than hidden when there is nothing.

            Decision A14 says a section showing an INVENTED figure must not
            render; it does not say a section with nothing yet to report should
            vanish. Saying "these will appear here" is the honest version of an
            empty record, and it tells a reader the absence is a stage rather
            than an omission.
          */}
          {updates.length === 0 ? (
            <EmptyState
              kind="no-content"
              title="Impact updates will appear here as we share our progress"
              description="Every figure we publish is dated and says how it was counted, so they arrive as the work is verified rather than as it happens."
              className="mt-8"
            />
          ) : null}
          <ol className="mt-8 space-y-8">
            {updates.map((update) => (
              <li
                key={update.id}
                className="border-border grid gap-4 border-b pb-8 last:border-0 md:grid-cols-12"
              >
                <div className="md:col-span-3">
                  <time dateTime={update.impactDate} className="text-body-sm font-medium">
                    {new Date(update.impactDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                  <p className="text-caption text-muted-foreground">{update.location}</p>
                </div>
                <div className="md:col-span-7">
                  <h3 className="text-h4 font-semibold">
                    {/*
                      Linked only when a slug is present.

                      Every record has one — `impact_updates.slug` is NOT NULL
                      since migration `0012` — but this list also renders from
                      the fixture fallback when the API is unreachable, and a
                      link to `/impact/undefined` is worse than plain text.
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
                  </h3>
                  <p className="text-body text-muted-foreground mt-2 leading-relaxed">
                    {update.description}
                  </p>
                  {update.verificationMethod ? (
                    <p className="text-caption text-muted-foreground mt-3">
                      How we know: {update.verificationMethod}
                    </p>
                  ) : null}
                </div>
                {update.metricValue !== null ? (
                  <div className="md:col-span-2 md:text-right">
                    <p data-numeric="" className="font-display text-h2 font-semibold">
                      {formatNumber(update.metricValue)}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {update.metricUnit ?? update.metricType?.replace(/_/g, ' ')}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-t">
        <PageShell>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-h1 font-bold">What this looks like for one person</h2>
            <Button asChild variant="secondary">
              <Link href="/stories">All stories</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {featuredStories.map((story) => (
              <StoryCard key={story.slug} story={story} />
            ))}
          </div>
        </PageShell>
      </Section>

      <Section>
        <PageShell>
          <div className="border-border bg-surface rounded-xl border px-6 py-12 text-center md:px-12">
            {/*
              This offered "Read the full reports" and linked to `/reports`.
              That page is gone — documents are admin-only now — so the promise
              went with it rather than being left pointing at a 404. What the
              page can still honestly offer is the work behind the figures.
            */}
            <h2 className="text-h1 text-balance font-bold">See the work behind the figures</h2>
            <p className="text-body-lg text-muted-foreground mx-auto mt-3 max-w-prose">
              Every number here comes from a programme running on the ground. Read what they do, or
              ask us anything you want to check.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/programs">Explore programs</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/contact">Ask us anything</Link>
              </Button>
            </div>
          </div>
        </PageShell>
      </Section>
    </>
  );
}
