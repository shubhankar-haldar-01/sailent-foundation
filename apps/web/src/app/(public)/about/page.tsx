import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFrame } from '@/components/media/media-frame';
import { StatBand } from '@/components/impact/stat-band';
import { TeamMemberCard } from '@/components/team/team-member-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { getHeadlineMetrics, getImpact, getTeam } from '@/lib/content';
import { formatRegisteredOn, getOrganisation, type Organisation } from '@/lib/content/organisation';

/**
 * The statutory identifiers, verifiable against the public registers.
 *
 * Moved here when `/transparency` was removed. From Admin → Settings since
 * Phase 13 (`getOrganisation`); a field nobody has entered is left out. In
 * development an empty field shows the DEMO value, marked so it cannot be
 * mistaken for a real registration, and the note below the list says so.
 */
function registrationFields(organisation: Organisation) {
  return [
    { label: 'Registered name', value: organisation.name },
    { label: 'Registered as', value: organisation.registeredAs },
    { label: 'Registration number', value: organisation.registration.trustDeedNumber },
    {
      label: 'Date of registration',
      value: formatRegisteredOn(organisation.registration.registeredOn),
    },
    { label: 'Registered office', value: organisation.addressLine },
    { label: 'PAN', value: organisation.registration.pan },
    { label: 'Section 12A registration', value: organisation.registration.section12A },
    { label: 'Section 80G registration', value: organisation.registration.section80G },
    { label: 'CSR-1 registration', value: organisation.registration.csr1 },
  ].filter((field): field is { label: string; value: string } => Boolean(field.value));
}

export const metadata: Metadata = buildMetadata({
  title: 'About us',
  description:
    'Who we are, how we work, where we work, and how we hold ourselves accountable for what we claim.',
  path: '/about',
});

const values = [
  {
    title: 'Work with what exists',
    body: 'There is usually already a school, a health centre and a village committee. We remove the obstacle stopping them working rather than building alongside them.',
  },
  {
    title: 'Measure the outcome, not the activity',
    body: 'Kits distributed is a number we can always make go up. Whether children stayed in school is the number that matters.',
  },
  {
    title: 'Publish what fails',
    body: 'Three programs have been discontinued in four years. Each is written up alongside the ones that worked.',
  },
  {
    title: 'Decide locally',
    body: 'Village committees choose sites. Head teachers identify students. People closest to the problem have information no survey captures.',
  },
];

export default async function AboutPage() {
  const [team, headlineMetrics, impact, organisation] = await Promise.all([
    getTeam(),
    getHeadlineMetrics(),
    getImpact(),
    getOrganisation(),
  ]);
  const registration = registrationFields(organisation);

  const leadership = team.filter((member) => member.department === 'Leadership').slice(0, 3);
  const geographicReach = impact.reach.byState;

  return (
    <>
      <PageHero
        eyebrow="About us"
        title="A small organization, working narrowly, in six districts"
        lead="We are not trying to solve rural poverty. We are trying to remove a specific set of obstacles, in a specific set of places, and to be honest about how well that is going."
      />

      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'About', path: '/about' },
            ]}
          />

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="prose-measure space-y-5 lg:col-span-7">
              <h2 className="text-h1 text-balance font-semibold">How this started</h2>
              <p className="text-body-lg leading-relaxed">
                The organization began with a question that turned out to have an uncomfortable
                answer: why do children in these districts leave school?
              </p>
              <p className="text-body text-muted-foreground leading-relaxed">
                The assumption was that it would be complicated — attitudes, distance, quality of
                teaching. Those all matter. But when head teachers were asked to name the students
                most at risk and explain why, the answer was overwhelmingly financial, and
                overwhelmingly small. A uniform. A notebook. A bus fare of a few rupees a day.
              </p>
              <p className="text-body text-muted-foreground leading-relaxed">
                That is not a satisfying insight. It does not require expertise and it does not make
                for a compelling founding story. But it is cheap to act on, and acting on it works
                more reliably than most of the things that sound more ambitious.
              </p>
              <p className="text-body text-muted-foreground leading-relaxed">
                The same pattern held when we moved into healthcare and then livelihoods. The
                binding constraint is rarely the thing that sounds important. It is usually
                something mundane, local, and fixable.
              </p>
            </div>

            <div className="lg:col-span-5">
              <MediaFrame
                media={{
                  seed: 'about-origin',
                  alt: 'A field team meeting with a village committee',
                }}
                aspect="photo"
              />
            </div>
          </div>
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-y">
        <PageShell>
          <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-h1 font-semibold">Mission</h2>
              <p className="text-body-lg text-muted-foreground mt-4 leading-relaxed">
                To remove the practical, local obstacles that keep people out of schools, clinics
                and paid work — by strengthening the institutions already serving them.
              </p>
            </div>
            <div>
              <h2 className="text-h1 font-semibold">Vision</h2>
              <p className="text-body-lg text-muted-foreground mt-4 leading-relaxed">
                Districts where a family&rsquo;s income does not decide whether a child finishes
                school, whether an illness is treated, or whether a woman earns.
              </p>
            </div>
          </div>
        </PageShell>
      </Section>

      <Section>
        <PageShell>
          <h2 className="text-h1 font-semibold">How we work</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <Card key={value.title} className="p-6">
                <h3 className="text-h4 font-semibold">{value.title}</h3>
                <p className="text-body-sm text-muted-foreground mt-2">{value.body}</p>
              </Card>
            ))}
          </div>
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-t">
        <PageShell>
          <h2 className="text-h1 font-semibold">Where we work</h2>
          <p className="text-body-lg text-muted-foreground mt-3 max-w-prose">
            {impact.reach.districts} districts across {impact.reach.states} states. We add a
            district only when an existing program is running well enough that the field team can
            take on more.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {geographicReach.map((region) => (
              <li key={region.state}>
                <Card className="h-full p-5">
                  <h3 className="text-h4 font-semibold">{region.state}</h3>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    {region.districts.join(', ')}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {region.programmes.map((program) => (
                      <li
                        key={program}
                        className="bg-muted text-caption text-muted-foreground rounded px-2 py-0.5"
                      >
                        {program}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        </PageShell>
      </Section>

      <Section>
        <PageShell>
          <h2 className="text-h1 font-semibold">Where we stand</h2>
          <StatBand metrics={headlineMetrics} className="mt-8" />
          <Button asChild variant="secondary" className="mt-8">
            <Link href="/impact">How we measure impact</Link>
          </Button>
        </PageShell>
      </Section>

      <Section className="border-border bg-surface-sunken border-t">
        <PageShell>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-h1 font-semibold">Who runs it</h2>
            <Button asChild variant="secondary">
              <Link href="/team">Full team and board</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {leadership.map((member) => (
              <TeamMemberCard key={member.slug} member={member} />
            ))}
          </div>
        </PageShell>
      </Section>

      <Section>
        <PageShell>
          {/*
            REGISTRATION LIVES HERE NOW, not on a page of its own.

            There was a `/transparency` page carrying these identifiers plus
            document lists, and a `/reports` page carrying more document lists.
            Both are gone: the platform does not publish documents to the public
            (they are admin-only), and two pages of downloads for a single small
            NGO is more site than there is content to fill it.

            The identifiers themselves are NOT optional and could not go with
            them. A donor claiming relief under Section 80G needs the
            registration number, receipts reference it, and "verify us against
            the public register" is the single most useful thing an NGO site can
            offer someone deciding whether to give. So they sit on About, which
            is where a visitor already goes to ask who this organisation is.
          */}
          <div className="border-border bg-surface rounded-xl border px-6 py-10 md:px-12">
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                <h2 className="text-h1 text-balance font-semibold">Check us before you give</h2>
                <p className="text-body-lg text-muted-foreground mt-3">
                  These identifiers let you verify us independently against the public registers.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <Button asChild size="lg">
                    <Link href="/donate">Donate</Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/contact">Ask us anything</Link>
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-7">
                <dl className="divide-border divide-y">
                  {registration.map((field) => (
                    <div
                      key={field.label}
                      className="flex flex-wrap justify-between gap-2 py-3 first:pt-0"
                    >
                      <dt className="text-body-sm text-muted-foreground">{field.label}</dt>
                      <dd data-numeric="" className="text-body-sm font-medium">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {organisation.isDemo ? (
                  <p className="bg-warning-subtle text-caption text-warning-foreground mt-4 rounded-md p-3">
                    Development preview — identifiers not yet entered in Admin → Settings show a
                    dummy value, marked <span className="font-semibold">DEMO</span> so it cannot be
                    mistaken for a real registration.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </PageShell>
      </Section>
    </>
  );
}
