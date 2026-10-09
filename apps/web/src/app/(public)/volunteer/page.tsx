import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, Testimonial } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFrame } from '@/components/media/media-frame';
import { EventCard } from '@/components/events/event-card';
import { VolunteerApplicationForm } from '@/components/volunteers/volunteer-application-form';
import { buildMetadata } from '@/lib/seo/metadata';
import { getEvents } from '@/lib/content';
// Testimonials have no backing table yet; they arrive with the CMS.
import { getTestimonialsByKind } from '@/lib/mock';

export const metadata: Metadata = buildMetadata({
  title: 'Volunteer',
  description:
    'Field days are long, rural and often administrative. Here is what volunteering with us actually involves, and how to apply.',
  path: '/volunteer',
});

const OPPORTUNITIES = [
  {
    title: 'Distribution days',
    commitment: 'Full day, in the field',
    description:
      'Sorting kits by class level, checking uniform sizes, and keeping the distribution record. No experience needed.',
  },
  {
    title: 'Medical camp support',
    commitment: 'One to two days, in the field',
    description:
      'Registration, queue management and translation at extended camps. Medical qualifications welcome but not required.',
  },
  {
    title: 'Learning centre facilitation',
    commitment: 'Weekly, ongoing',
    description:
      'After-school sessions in reading and arithmetic for students who have missed schooling.',
  },
  {
    title: 'Translation and documentation',
    commitment: 'Remote, flexible',
    description: 'Translating program material and field reports between Hindi, Odia and English.',
  },
  {
    title: 'Design and photography',
    commitment: 'Remote or field',
    description: 'Documenting programs and producing material for schools and village committees.',
  },
  {
    title: 'Data and research support',
    commitment: 'Remote, flexible',
    description:
      'Entering attendance and growth measurement records, and helping analyse program outcomes.',
  },
];

const PROCESS = [
  { title: 'Apply', body: 'A short form covering skills, interests and availability.' },
  { title: 'Review', body: 'We review within two weeks, sometimes with a short call.' },
  { title: 'Approval', body: 'Approved volunteers receive a permanent volunteer ID.' },
  { title: 'Orientation', body: 'A half-day session before your first assignment. Required.' },
  { title: 'Assignment', body: 'Matched to a program based on interest and field need.' },
  {
    title: 'Hours and certificate',
    body: 'Verified attendance accumulates towards a certificate.',
  },
];

export default async function VolunteerPage() {
  const volunteerTestimonials = getTestimonialsByKind('volunteer');
  const upcoming = (await getEvents('upcoming'))
    .filter((event) => event.requiresVolunteers)
    .slice(0, 3);

  return (
    <>
      <PageHero
        eyebrow="Volunteer"
        title="Give time instead of money"
        lead="Field days start before seven, involve travel on poor roads, and are frequently administrative. We say so upfront, because volunteers who know that in advance are the ones who stay."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="#apply">Apply to volunteer</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="#how-it-works">How it works</Link>
          </Button>
        </div>
      </PageHero>

      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Volunteer', path: '/volunteer' },
            ]}
          />

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="prose-measure space-y-5 lg:col-span-7">
              <h2 className="text-h1 text-balance font-bold">Why volunteer with us</h2>
              <p className="text-body-lg leading-relaxed">
                Volunteer recruitment material tends to promise transformation. Ours used to. We
                changed it after too many people arrived expecting one thing and found another.
              </p>
              <p className="text-body text-muted-foreground leading-relaxed">
                What you get instead is a clear view of how a small organization actually operates —
                the procurement decisions, the measurement arguments, the days when a distribution
                runs three hours late because a road is out. People who find that interesting tend
                to stay for years.
              </p>
              <p className="text-body text-muted-foreground leading-relaxed">
                We ask for one day a month for six months. That is deliberately modest and
                deliberately sustained: the orientation and training we invest in each volunteer
                only pays back over time.
              </p>
            </div>
            <div className="lg:col-span-5">
              <MediaFrame
                media={{
                  seed: 'volunteer-hero',
                  alt: 'Volunteers working together at a distribution day',
                }}
                aspect="photo"
              />
            </div>
          </div>
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-y">
        <PageShell>
          <h2 className="text-h1 font-bold">Ways to contribute</h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {OPPORTUNITIES.map((opportunity) => (
              <li key={opportunity.title}>
                <Card className="flex h-full flex-col p-5">
                  <h3 className="text-h4 font-semibold">{opportunity.title}</h3>
                  <p className="text-caption text-primary mt-1 font-medium">
                    {opportunity.commitment}
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-3">
                    {opportunity.description}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </PageShell>
      </Section>

      <Section id="how-it-works" className="scroll-mt-24">
        <PageShell>
          <h2 className="text-h1 font-bold">How volunteering works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROCESS.map((stage, index) => (
              <li key={stage.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="border-border bg-surface text-body-sm text-primary flex size-9 shrink-0 items-center justify-center rounded-full border font-semibold"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-body font-semibold">{stage.title}</h3>
                  <p className="text-body-sm text-muted-foreground mt-1">{stage.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </PageShell>
      </Section>

      {volunteerTestimonials.length > 0 ? (
        <Section className="border-border bg-surface-sunken border-t">
          <PageShell>
            <h2 className="text-h1 font-bold">From our volunteers</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {volunteerTestimonials.map((testimonial) => (
                <Card key={testimonial.id} className="p-6">
                  <Testimonial testimonial={{ ...testimonial, photo: null }} />
                </Card>
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}

      {upcoming.length > 0 ? (
        <Section>
          <PageShell>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-h1 font-bold">Opportunities coming up</h2>
              <Button asChild variant="secondary">
                <Link href="/events">All events</Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => (
                <EventCard key={event.slug} event={event} />
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}

      <Section id="apply" className="border-border bg-surface-sunken scroll-mt-24 border-t">
        <PageShell>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <h2 className="text-h1 text-balance font-bold">Apply to volunteer</h2>
              <p className="text-body text-muted-foreground mt-4">
                Six short steps. Your application is reviewed within two weeks, and approved
                volunteers receive a permanent volunteer ID.
              </p>
              <p className="text-body-sm text-muted-foreground mt-4">
                Questions first? The{' '}
                <Link
                  href="/faq"
                  className="text-primary focus-visible:outline-ring rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  FAQ
                </Link>{' '}
                covers commitment, skills and certification.
              </p>
            </div>
            <div className="lg:col-span-8">
              <VolunteerApplicationForm />
            </div>
          </div>
        </PageShell>
      </Section>
    </>
  );
}
