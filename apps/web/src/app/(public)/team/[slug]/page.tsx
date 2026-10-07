import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { Card } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFrame } from '@/components/media/media-frame';
import { TeamMemberCard } from '@/components/team/team-member-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { jsonLd } from '@/lib/seo/structured-data';
import { siteConfig } from '@/lib/site-config';
import { getTeam, getTeamMember } from '@/lib/content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const member = await getTeamMember((await params).slug);
  if (!member) {
    return buildMetadata({ title: 'Not found', path: '/team', noIndex: true });
  }

  return buildMetadata({
    title: `${member.name} — ${member.designation}`,
    /*
      The biography, trimmed, rather than a template.

      "Meet Anjali Menon, Director of Programmes at Sailent Foundation" tells a
      searcher nothing they cannot already see in the title. The first sentence
      of what the person actually does is the useful description.
    */
    description: member.bio?.slice(0, 180) || `${member.designation} at Sailent Foundation.`,
    path: `/team/${member.slug}`,
    /*
      Left as the default `website`, NOT `article`.

      A profile has no publication date and does not change when the
      organisation publishes something, so typing it as an article puts it into
      feeds and news surfaces where it does not belong. Open Graph has a
      `profile` type for exactly this, but `buildMetadata` only models the two
      the rest of the site uses, and widening it for one page is more
      invitation to misuse than it is worth.
    */
  });
}

/**
 * One person's page.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT HERE.
 *
 * No social proof, no "years of experience" counter, no testimonial. A team
 * page on an NGO site is read by three kinds of visitor — a donor checking who
 * is behind the organisation, a journalist looking for a name to quote, and a
 * prospective partner — and every one of them wants the same two things: what
 * this person is responsible for, and what they did before.
 *
 * `emailPublic` renders only when it is set, which for most of the directory
 * it is not. That is the right default: everything on this page is indexed and
 * scraped within the week, and an address on it is a decision somebody made
 * rather than a field that got filled in.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function TeamMemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const member = await getTeamMember((await params).slug);
  if (!member) notFound();

  const colleagues = (await getTeam())
    .filter((entry) => entry.slug !== member.slug)
    .filter((entry) => !member.department || entry.department === member.department)
    .slice(0, 3);

  const paragraphs = (body: string | null) =>
    (body ?? '')
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

  const bio = paragraphs(member.bio);
  const experience = paragraphs(member.experience);

  /**
   * `Person`, affiliated to the organisation.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * ONLY WHAT IS ALREADY ON THE PAGE goes in here.
   *
   * Structured data that asserts more than the visible page does is the
   * quickest way to earn a manual action, and on a page about a real person the
   * temptation is `email` and `telephone`. `emailPublic` is included ONLY when
   * it is set, because it is by name and intent a published address; nothing
   * else contactable exists on this record to leak.
   *
   * `sameAs` carries the social links, which is what that property is for — it
   * tells a search engine these profiles are the same person rather than
   * claiming anything new about them.
   * ══════════════════════════════════════════════════════════════════════════
   */
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: member.name,
    jobTitle: member.designation,
    url: `${siteConfig.url}/team/${member.slug}`,
    worksFor: { '@type': 'NGO', name: siteConfig.name },
    ...(member.bio ? { description: member.bio.slice(0, 300) } : {}),
    ...(member.emailPublic ? { email: member.emailPublic } : {}),
    ...(member.socialLinks?.length ? { sameAs: member.socialLinks.map((link) => link.url) } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(personSchema)} />

      <PageShell className="pt-8">
        <Breadcrumbs
          entries={[
            { name: 'Home', path: '/' },
            { name: 'Team', path: '/team' },
            { name: member.name, path: `/team/${member.slug}` },
          ]}
        />
      </PageShell>

      <PageShell>
        {/*
          The portrait is a COLUMN, not a banner. A wide hero photograph of one
          person reads as a personality page; a portrait beside the text reads
          as a directory entry, which is what this is.
        */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-12">
          <div className="mx-auto w-full max-w-xs lg:sticky lg:top-24 lg:mx-0 lg:self-start">
            <MediaFrame media={member.photo} aspect="portrait" />

            {member.emailPublic ? (
              <a
                href={`mailto:${member.emailPublic}`}
                className="text-body-sm text-info-action focus-visible:outline-ring mt-4 inline-flex items-center gap-2 rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Mail className="size-4" aria-hidden="true" />
                {member.emailPublic}
              </a>
            ) : null}

            {member.socialLinks?.length ? (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {member.socialLinks.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-caption text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-sm underline underline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {link.label}
                      <span className="sr-only"> profile for {member.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="prose-measure">
            <h1 className="text-display text-balance font-semibold">{member.name}</h1>
            <p className="text-body-lg text-primary mt-2 font-medium">{member.designation}</p>
            {member.department ? (
              <p className="text-caption text-muted-foreground mt-1">{member.department}</p>
            ) : null}

            {bio.length > 0 ? (
              <div className="mt-6 space-y-4">
                {bio.map((part) => (
                  <p
                    key={part.slice(0, 40)}
                    className="text-body text-muted-foreground leading-relaxed"
                  >
                    {part}
                  </p>
                ))}
              </div>
            ) : null}

            {experience.length > 0 ? (
              <Card className="mt-8 p-6">
                <h2 className="text-h4 font-semibold">Before Sailent</h2>
                <div className="mt-3 space-y-3">
                  {experience.map((part) => (
                    <p
                      key={part.slice(0, 40)}
                      className="text-body-sm text-muted-foreground leading-relaxed"
                    >
                      {part}
                    </p>
                  ))}
                </div>
              </Card>
            ) : null}

            <p className="text-body-sm mt-8">
              <Link
                href="/team"
                className="text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                See the whole team
              </Link>
            </p>
          </div>
        </div>
      </PageShell>

      {/* Colleagues, not "related people" — and only from the same department,
          because an arbitrary three faces is filler. Nothing renders when the
          department has nobody else in it. */}
      {colleagues.length > 0 ? (
        <Section
          title={member.department ? `Also in ${member.department}` : 'More of the team'}
          className="border-border border-t"
        >
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {colleagues.map((colleague) => (
              <TeamMemberCard key={colleague.slug} member={colleague} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
