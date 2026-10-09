import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarDays, MapPin, ShieldCheck } from 'lucide-react';
import { Card, formatDate } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFigure, MediaFrame } from '@/components/media/media-frame';
import { buildMetadata } from '@/lib/seo/metadata';
import { getImpact, getImpactRecord } from '@/lib/content';
import { localMedia } from '@/lib/media/public-asset';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const record = await getImpactRecord((await params).slug);
  if (!record) {
    return buildMetadata({ title: 'Not found', path: '/impact', noIndex: true });
  }

  return buildMetadata({
    title: record.title,
    description: record.description.slice(0, 180),
    path: `/impact/${record.slug}`,
    type: 'article',
    publishedAt: record.publishedAt ?? undefined,
  });
}

/** An integer with Indian digit grouping. Figures here are counts, never money. */
function count(value: number): string {
  return value.toLocaleString('en-IN');
}

/**
 * One impact record.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE FIGURE AND ITS METHOD ARE ON THE SAME SCREEN, ALWAYS.
 *
 * Decision A14: every public statistic traces to a database aggregate or to a
 * dated, sourced record. This page IS that record, and the thing that makes it
 * a source rather than a claim is `verificationMethod` — how the number was
 * arrived at.
 *
 * So the method is not a footnote, a tooltip or an expandable. It sits
 * directly beneath the figure, in a panel of its own. And when a record claims
 * a figure with no method recorded, the page says so in those words rather
 * than printing the number bare: the API refuses to publish that combination,
 * so this branch should be unreachable — but "should be unreachable" is not a
 * reason to print an unsourced number if it ever is.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function ImpactRecordPage({ params }: { params: Promise<{ slug: string }> }) {
  const record = await getImpactRecord((await params).slug);
  if (!record) notFound();

  const { updates } = await getImpact();
  const others = updates.filter((update) => update.slug && update.slug !== record.slug).slice(0, 3);

  /** The parent this record rolls up to, and the one link worth offering. */
  const parent = record.campaignSlug
    ? { href: `/campaigns/${record.campaignSlug}`, label: record.campaignTitle, kind: 'Campaign' }
    : record.eventSlug
      ? { href: `/events/${record.eventSlug}`, label: record.eventTitle, kind: 'Event' }
      : record.programSlug
        ? { href: `/programs/${record.programSlug}`, label: record.programTitle, kind: 'Programme' }
        : null;

  const claimsFigure = record.metricValue !== null;

  return (
    <>
      <PageShell className="pt-8">
        <Breadcrumbs
          entries={[
            { name: 'Home', path: '/' },
            { name: 'Impact', path: '/impact' },
            { name: record.title, path: `/impact/${record.slug}` },
          ]}
        />
      </PageShell>

      <article>
        <PageShell>
          <header className="prose-measure">
            {parent?.label ? (
              <Link
                href={parent.href}
                className="text-overline tracking-(--text-overline--letter-spacing) text-primary focus-visible:outline-ring rounded-sm uppercase underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {parent.label}
              </Link>
            ) : null}

            <h1 className="text-display mt-3 text-balance font-bold">{record.title}</h1>

            <p className="text-caption text-muted-foreground mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {/* The date is REQUIRED on every record. A claim without one is
                    not a claim (A14), which is why the column is NOT NULL. */}
                <time dateTime={record.impactDate}>{formatDate(record.impactDate)}</time>
              </span>
              {record.location ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {[record.location, record.state].filter(Boolean).join(', ')}
                </span>
              ) : null}
            </p>
          </header>
        </PageShell>

        {record.cover ? (
          <PageShell className="pt-8">
            <MediaFrame media={record.cover} aspect="landscape" />
          </PageShell>
        ) : null}

        <PageShell className="pt-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-12">
            <div className="prose-measure">
              {record.description
                .split(/\n{2,}/)
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => (
                  <p
                    key={part.slice(0, 40)}
                    className="text-body text-muted-foreground mt-4 leading-relaxed first:mt-0"
                  >
                    {part}
                  </p>
                ))}

              {record.statistics.length > 0 ? (
                <dl className="border-border mt-8 grid gap-6 border-t pt-6 sm:grid-cols-3">
                  {record.statistics.map((statistic) => (
                    <div key={statistic.label}>
                      <dt className="text-caption text-muted-foreground">{statistic.label}</dt>
                      <dd className="text-h3 mt-1 font-semibold">
                        {count(statistic.value)}
                        {statistic.unit ? (
                          <span className="text-body-sm text-muted-foreground ml-1 font-normal">
                            {statistic.unit}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>

            {/* The figure and its evidence, together, in one panel. */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              {claimsFigure ? (
                <Card className="p-6">
                  <p className="text-display font-semibold tabular-nums">
                    {count(record.metricValue!)}
                  </p>
                  {record.metricUnit ? (
                    <p className="text-body-sm text-muted-foreground mt-1">{record.metricUnit}</p>
                  ) : null}

                  <div className="border-border mt-5 border-t pt-5">
                    <h2 className="text-caption flex items-center gap-1.5 font-semibold">
                      <ShieldCheck className="text-wash-mint-ink size-4" aria-hidden="true" />
                      How this was counted
                    </h2>
                    {record.verificationMethod ? (
                      <p className="text-body-sm text-muted-foreground mt-2 leading-relaxed">
                        {record.verificationMethod}
                      </p>
                    ) : (
                      /*
                        Should be unreachable: the API refuses to publish a
                        figure with no method. It is here because printing an
                        unsourced number is the one outcome this page must never
                        produce, and a missing branch would do exactly that.
                      */
                      <p className="text-body-sm text-muted-foreground mt-2 leading-relaxed">
                        The method behind this figure has not been recorded, so we cannot yet show
                        you how it was arrived at.
                      </p>
                    )}
                  </div>
                </Card>
              ) : null}

              {parent?.label ? (
                <Card className="mt-6 p-6">
                  <p className="text-caption text-muted-foreground">{parent.kind}</p>
                  <p className="text-body mt-1 font-medium">{parent.label}</p>
                  <p className="text-body-sm mt-3">
                    <Link
                      href={parent.href}
                      className="text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      See the work behind this
                    </Link>
                  </p>
                </Card>
              ) : null}
            </aside>
          </div>
        </PageShell>

        {record.images.length > 0 ? (
          <PageShell className="pt-10">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {record.images.map((image, index) => (
                <MediaFigure
                  key={image.url ?? image.seed ?? index}
                  /* The caption travels ON the media reference, not as a prop —
                     `MediaFigure` reads `media.caption`, so a picture and its
                     caption cannot be separated by a careless call site. */
                  media={{
                    ...localMedia(image.seed ?? `impact-${record.slug}-${index}`, image.alt),
                    caption: image.caption,
                  }}
                  aspect="landscape"
                />
              ))}
            </div>
          </PageShell>
        ) : null}
      </article>

      {others.length > 0 ? (
        <Section title="More of what we have reported" className="border-border border-t">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((update) => (
              <li key={update.id}>
                <Card className="h-full p-6">
                  <p className="text-caption text-muted-foreground">
                    <time dateTime={update.impactDate}>{formatDate(update.impactDate)}</time>
                  </p>
                  <h3 className="text-h4 mt-2 font-semibold leading-tight">
                    <Link
                      href={`/impact/${update.slug}`}
                      className="focus-visible:outline-ring rounded-sm hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {update.title}
                    </Link>
                  </h3>
                  {update.metricValue !== null ? (
                    <p className="text-body-sm text-muted-foreground mt-2">
                      {count(update.metricValue)} {update.metricUnit ?? ''}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
