import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { Button, Card, ImpactStat, formatNumber } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFrame } from '@/components/media/media-frame';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { StoryCard } from '@/components/stories/story-card';
import { EventCard } from '@/components/events/event-card';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  getCampaignsByProgram,
  getEvents,
  getProgramPage,
  getStoriesByProgram,
} from '@/lib/content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const page = await getProgramPage((await params).slug);
  if (!page) return buildMetadata({ title: 'Program not found', path: '/programs', noIndex: true });

  const { program } = page;
  return buildMetadata({
    title: program.name,
    description: program.shortDescription,
    path: `/programs/${program.slug}`,
  });
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;

  const page = await getProgramPage(slug);
  if (!page) notFound();

  const { program, impactUpdates: updates } = page;

  // The program response carries its related content, but the cards on this
  // page need the full campaign, story and event shapes — so those come from
  // their own endpoints, fetched together rather than one after another.
  const [relatedCampaigns, relatedStories, upcomingEvents] = await Promise.all([
    getCampaignsByProgram(slug),
    getStoriesByProgram(slug),
    getEvents('upcoming'),
  ]);

  const activeCampaigns = relatedCampaigns.filter((campaign) => campaign.status === 'active');
  const relatedEvents = upcomingEvents.filter((event) => event.programSlug === slug);

  return (
    <>
      <PageShell className="pt-8">
        <Breadcrumbs
          entries={[
            { name: 'Home', path: '/' },
            { name: 'Programs', path: '/programs' },
            { name: program.name, path: `/programs/${program.slug}` },
          ]}
        />
      </PageShell>

      <PageShell>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
              Program
            </p>
            <h1 className="text-display mt-3 text-balance font-semibold">{program.name}</h1>
            <p className="text-body-lg text-muted-foreground mt-4">{program.tagline}</p>
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
              {program.locations.map((location) => (
                <li
                  key={`${location.district}-${location.state}`}
                  className="text-body-sm text-muted-foreground flex items-center gap-1.5"
                >
                  <MapPin className="size-4" aria-hidden="true" />
                  {location.district}, {location.state}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              {activeCampaigns.length > 0 ? (
                <Button asChild size="lg">
                  <Link href={`/campaigns/${activeCampaigns[0]!.slug}#give`}>
                    Support this program
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href="/donate">Donate</Link>
                </Button>
              )}
              <Button asChild variant="secondary" size="lg">
                <Link href="/campaigns">Explore campaigns</Link>
              </Button>
            </div>
          </div>
          <MediaFrame media={program.cover} aspect="hero" priority />
        </div>
      </PageShell>

      {/* Problem and approach — editorial rather than a card grid. */}
      <Section>
        <PageShell>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="text-h1 text-balance font-semibold">The problem</h2>
              <p className="text-body text-muted-foreground mt-4 leading-relaxed">
                {program.problem}
              </p>
            </div>
            <div className="lg:col-span-7">
              <h2 className="text-h1 text-balance font-semibold">What we do about it</h2>
              <p className="text-body text-muted-foreground mt-4 leading-relaxed">
                {program.approach}
              </p>
            </div>
          </div>
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-y">
        <PageShell>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-h1 font-semibold">Goals</h2>
              <ol className="mt-6 space-y-5">
                {program.goals.map((goal, index) => (
                  <li key={goal.title} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="border-border bg-surface text-body-sm text-primary flex size-8 shrink-0 items-center justify-center rounded-full border font-semibold"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-body font-semibold">{goal.title}</h3>
                      <p className="text-body-sm text-muted-foreground mt-1">{goal.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h2 className="text-h1 font-semibold">Activities</h2>
              <ul className="mt-6 space-y-4">
                {program.activities.map((activity) => (
                  <li key={activity.title} className="border-border border-b pb-4 last:border-0">
                    <h3 className="text-body font-semibold">{activity.title}</h3>
                    <p className="text-body-sm text-muted-foreground mt-1">
                      {activity.description}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="border-border bg-surface mt-8 rounded-lg border p-5">
                <h3 className="text-body font-semibold">Who we serve</h3>
                <p className="text-body-sm text-muted-foreground mt-2">{program.beneficiaries}</p>
              </div>
            </div>
          </div>
        </PageShell>
      </Section>

      {program.metrics.length > 0 ? (
        <Section>
          <PageShell>
            <h2 className="text-h1 font-semibold">Where this program stands</h2>
            <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4">
              {program.metrics.map((metric) => (
                <ImpactStat
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  unit={metric.unit}
                  format={formatNumber}
                  source={{
                    kind: 'demo',
                    description: `Aggregated from ${program.name} program records.`,
                  }}
                />
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}

      {relatedCampaigns.length > 0 ? (
        <Section className="border-border border-t">
          <PageShell>
            <h2 className="text-h1 font-semibold">Campaigns in this program</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCampaigns.map((campaign) => (
                <CampaignCard key={campaign.slug} campaign={campaign} />
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}

      {updates.length > 0 ? (
        <Section className="border-border bg-surface-sunken border-t">
          <PageShell>
            <h2 className="text-h1 font-semibold">Latest updates</h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-2">
              {updates.map((update) => (
                <li key={update.id}>
                  <Card className="h-full p-5">
                    <p className="text-caption text-muted-foreground">
                      <time dateTime={update.occurredOn}>
                        {new Date(update.occurredOn).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </time>
                      {' · '}
                      {update.location}
                    </p>
                    <h3 className="text-h4 mt-2 font-semibold">{update.title}</h3>
                    <p className="text-body-sm text-muted-foreground mt-2">{update.body}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </PageShell>
        </Section>
      ) : null}

      {relatedStories.length > 0 ? (
        <Section className="border-border border-t">
          <PageShell>
            <h2 className="text-h1 font-semibold">Stories from this program</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {relatedStories.map((story) => (
                <StoryCard key={story.slug} story={story} />
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}

      {relatedEvents.length > 0 ? (
        <Section className="border-border bg-surface-sunken border-t">
          <PageShell>
            <h2 className="text-h1 font-semibold">Upcoming events</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {relatedEvents.map((event) => (
                <EventCard key={event.slug} event={event} />
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}

      <Section className="border-border border-t">
        <PageShell>
          <div className="border-border bg-surface rounded-xl border px-6 py-12 text-center md:px-12">
            <h2 className="text-h1 text-balance font-semibold">
              Support the {program.name} program
            </h2>
            <p className="text-body-lg text-muted-foreground mx-auto mt-3 max-w-prose">
              Fund a specific item in an active campaign, or give to the program and let the team
              allocate it.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/donate">Donate</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/volunteer">Volunteer with us</Link>
              </Button>
            </div>
          </div>
        </PageShell>
      </Section>
    </>
  );
}
